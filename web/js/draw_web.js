/**
 * SigmaOS Draw Web (VectorCraft).
 * Inspired by: Excalidraw, diagrams.net (draw.io), LibreOffice Draw, Inkscape.
 * Features: select tool, text tool, arrow tool, freehand polygon, color pickers,
 *           grid snap, undo/redo stack (50), delete, duplicate, z-order,
 *           PNG export via <canvas>, SVG round-trip.
 */
class DrawWeb {
  constructor(svgElement) {
    this.svg = svgElement;
    this.currentTool = 'rect';
    this.strokeColor = '#000000';
    this.fillColor = '#81c784';
    this.strokeWidth = 2;
    this.shapes = [];
    this.docId = 'draw_' + Date.now();
    this.title = 'Untitled Drawing';
    this.isDrawing = false;
    this.startX = 0;
    this.startY = 0;
    this.currentElement = null;
    this.selectedElement = null;
    this.gridSnap = false;
    this.gridSize = 20;
    this._history = [];
    this._redoStack = [];
    this._dragging = false;
    this._dragOffsetX = 0;
    this._dragOffsetY = 0;
    this._polyPoints = [];
    this._highlighterPoints = [];
    this.zoom = 1.0;
    this.baseWidth = 900;
    this.baseHeight = 620;
    this._saveTimer = null;
    this._initDefs();
    this.setupListeners();
  }

  _initDefs() {
    this.svg.innerHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
                markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="${this.strokeColor}"/>
        </marker>
        <pattern id="grid" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
          <path d="M ${this.gridSize} 0 L 0 0 0 ${this.gridSize}" fill="none" stroke="#2a2a3e" stroke-width="0.5"/>
        </pattern>
      </defs>
      <rect id="draw-grid-bg" width="100%" height="100%" fill="url(#grid)" style="display:none;pointer-events:none;"/>
    `;
  }

  setTool(tool) {
    this.currentTool = tool;
    this._polyPoints = [];
    if (this.currentElement && !this.shapes.includes(this.currentElement)) {
      this.svg.removeChild(this.currentElement);
      this.currentElement = null;
    }
    if (tool !== 'select') this._deselectAll();
    // Update toolbar active states
    document.querySelectorAll('.draw-tool-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`[data-tool="${tool}"]`);
    if (btn) btn.classList.add('active');
  }

  setStrokeColor(color) {
    this.strokeColor = color;
    if (this.selectedElement) {
      this.selectedElement.setAttribute('stroke', color);
      this.triggerAutoSave();
    }
    // Update arrow marker fill
    const arrowPath = this.svg.querySelector('#arrow path');
    if (arrowPath) arrowPath.setAttribute('fill', color);
  }

  setFillColor(color) {
    this.fillColor = color;
    if (this.selectedElement) {
      if (this.selectedElement.tagName !== 'line') this.selectedElement.setAttribute('fill', color);
      this.triggerAutoSave();
    }
  }

  setStrokeWidth(width) {
    this.strokeWidth = parseInt(width);
    if (this.selectedElement) {
      this.selectedElement.setAttribute('stroke-width', this.strokeWidth);
      this.triggerAutoSave();
    }
  }

  toggleGrid() {
    this.gridSnap = !this.gridSnap;
    const bg = this.svg.querySelector('#draw-grid-bg');
    if (bg) bg.style.display = this.gridSnap ? '' : 'none';
  }

  _snap(v) {
    return this.gridSnap ? Math.round(v / this.gridSize) * this.gridSize : v;
  }

  setupListeners() {
    this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.svg.addEventListener('mouseup', (e) => this.onMouseUp(e));
    this.svg.addEventListener('dblclick', (e) => this.onDblClick(e));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (this.selectedElement && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
          e.preventDefault();
          this.deleteSelected();
        }
      }
      if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this.undo(); }
      if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this.redo(); }
      if (e.ctrlKey && e.key === 'd') { e.preventDefault(); this.duplicate(); }
      if (e.key === 'Escape') this._deselectAll();
    });
  }

  getMousePos(e) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: this._snap(e.clientX - rect.left),
      y: this._snap(e.clientY - rect.top)
    };
  }

  onMouseDown(e) {
    if (e.target === this.svg || e.target.id === 'draw-grid-bg') {
      this._deselectAll();
    }

    if (this.currentTool === 'select') {
      const shape = e.target.closest('[data-sigma-shape]');
      if (shape) {
        this._selectElement(shape);
        this._dragging = true;
        const pos = this.getMousePos(e);
        const bbox = shape.getBBox ? shape.getBBox() : { x: 0, y: 0 };
        this._dragOffsetX = pos.x - (parseFloat(shape.getAttribute('x') || shape.getAttribute('cx') || bbox.x) || 0);
        this._dragOffsetY = pos.y - (parseFloat(shape.getAttribute('y') || shape.getAttribute('cy') || bbox.y) || 0);
        e.preventDefault();
        return;
      }
    }

    if (this.currentTool === 'polygon') {
      const pos = this.getMousePos(e);
      this._polyPoints.push([pos.x, pos.y]);
      if (!this.currentElement) {
        this.currentElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        this.currentElement.setAttribute('fill', 'none');
        this.currentElement.setAttribute('stroke', this.strokeColor);
        this.currentElement.setAttribute('stroke-width', this.strokeWidth);
        this.currentElement.setAttribute('stroke-linejoin', 'round');
        this.svg.appendChild(this.currentElement);
      }
      this.currentElement.setAttribute('points', this._polyPoints.map(p => p.join(',')).join(' '));
      return;
    }

    if (this.currentTool === 'highlighter') {
      const pos = this.getMousePos(e);
      this._highlighterPoints = [[pos.x, pos.y]];
      this.isDrawing = true;
      this._saveHistory();
      this.currentElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      this.currentElement.setAttribute('fill', 'none');
      this.currentElement.setAttribute('stroke', '#ffeb3b');
      this.currentElement.setAttribute('stroke-opacity', '0.38');
      this.currentElement.setAttribute('stroke-width', '18');
      this.currentElement.setAttribute('stroke-linecap', 'round');
      this.currentElement.setAttribute('stroke-linejoin', 'round');
      this.currentElement.setAttribute('data-sigma-shape', '1');
      this.currentElement.setAttribute('points', `${pos.x},${pos.y}`);
      this.svg.appendChild(this.currentElement);
      return;
    }

    if (this.currentTool === 'text') return; // handled in dblclick

    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;
    this._saveHistory();
    this.currentElement = this._createElement(pos);
    if (this.currentElement) this.svg.appendChild(this.currentElement);
  }

  _createElement(pos) {
    const ns = 'http://www.w3.org/2000/svg';
    const el = document.createElementNS(ns, this.currentTool === 'arrow' ? 'line' : this.currentTool === 'ellipse' ? 'ellipse' : this.currentTool === 'line' ? 'line' : 'rect');
    el.dataset.sigmaTool = this.currentTool;
    el.setAttribute('data-sigma-shape', '1');

    if (this.currentTool === 'rect') {
      el.setAttribute('x', pos.x); el.setAttribute('y', pos.y);
      el.setAttribute('width', '0'); el.setAttribute('height', '0');
      el.setAttribute('rx', '3');
      el.setAttribute('fill', this.fillColor);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
    } else if (this.currentTool === 'ellipse') {
      el.setAttribute('cx', pos.x); el.setAttribute('cy', pos.y);
      el.setAttribute('rx', '0'); el.setAttribute('ry', '0');
      el.setAttribute('fill', this.fillColor);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
    } else if (this.currentTool === 'line') {
      el.setAttribute('x1', pos.x); el.setAttribute('y1', pos.y);
      el.setAttribute('x2', pos.x); el.setAttribute('y2', pos.y);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
    } else if (this.currentTool === 'arrow') {
      el.setAttribute('x1', pos.x); el.setAttribute('y1', pos.y);
      el.setAttribute('x2', pos.x); el.setAttribute('y2', pos.y);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
      el.setAttribute('marker-end', 'url(#arrow)');
    } else if (this.currentTool === 'connector') {
      el.setAttribute('x1', pos.x); el.setAttribute('y1', pos.y);
      el.setAttribute('x2', pos.x); el.setAttribute('y2', pos.y);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
      el.setAttribute('stroke-dasharray', '5,5');
      el.setAttribute('marker-end', 'url(#arrow)');
    } else if (this.currentTool === 'sticky') {
      const g = document.createElementNS(ns, 'g');
      g.dataset.sigmaTool = 'sticky';
      g.setAttribute('data-sigma-shape', '1');
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('x', pos.x); rect.setAttribute('y', pos.y);
      rect.setAttribute('width', '130'); rect.setAttribute('height', '130');
      rect.setAttribute('rx', '6');
      rect.setAttribute('fill', '#fff59d');
      rect.setAttribute('stroke', '#fbc02d');
      rect.setAttribute('stroke-width', '1');
      rect.style.filter = 'drop-shadow(2px 3px 4px rgba(0,0,0,0.25))';
      const text = document.createElementNS(ns, 'text');
      text.setAttribute('x', pos.x + 12);
      text.setAttribute('y', pos.y + 26);
      text.setAttribute('font-size', '13');
      text.setAttribute('fill', '#333333');
      text.setAttribute('font-family', 'sans-serif');
      text.textContent = 'Note…';
      g.appendChild(rect);
      g.appendChild(text);
      return g;
    } else if (this.currentTool === 'diamond') {
      const elDiamond = document.createElementNS(ns, 'polygon');
      elDiamond.dataset.sigmaTool = 'diamond';
      elDiamond.setAttribute('data-sigma-shape', '1');
      elDiamond.setAttribute('points', `${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y}`);
      elDiamond.setAttribute('fill', this.fillColor);
      elDiamond.setAttribute('stroke', this.strokeColor);
      elDiamond.setAttribute('stroke-width', this.strokeWidth);
      return elDiamond;
    } else if (this.currentTool === 'terminator') {
      el.setAttribute('x', pos.x); el.setAttribute('y', pos.y);
      el.setAttribute('width', '0'); el.setAttribute('height', '0');
      el.setAttribute('rx', '22');
      el.setAttribute('fill', this.fillColor);
      el.setAttribute('stroke', this.strokeColor);
      el.setAttribute('stroke-width', this.strokeWidth);
    } else if (this.currentTool === 'io') {
      const elIo = document.createElementNS(ns, 'polygon');
      elIo.dataset.sigmaTool = 'io';
      elIo.setAttribute('data-sigma-shape', '1');
      elIo.setAttribute('points', `${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y}`);
      elIo.setAttribute('fill', this.fillColor);
      elIo.setAttribute('stroke', this.strokeColor);
      elIo.setAttribute('stroke-width', this.strokeWidth);
      return elIo;
    } else if (this.currentTool === 'dimension') {
      const gDim = document.createElementNS(ns, 'g');
      gDim.dataset.sigmaTool = 'dimension';
      gDim.setAttribute('data-sigma-shape', '1');
      const line = document.createElementNS(ns, 'line');
      line.setAttribute('x1', pos.x); line.setAttribute('y1', pos.y);
      line.setAttribute('x2', pos.x); line.setAttribute('y2', pos.y);
      line.setAttribute('stroke', this.strokeColor);
      line.setAttribute('stroke-width', '1.5');
      const txt = document.createElementNS(ns, 'text');
      txt.setAttribute('x', pos.x); txt.setAttribute('y', pos.y - 6);
      txt.setAttribute('font-size', '11');
      txt.setAttribute('fill', this.strokeColor);
      txt.setAttribute('text-anchor', 'middle');
      txt.textContent = '0px';
      gDim.appendChild(line);
      gDim.appendChild(txt);
      return gDim;
    }
    return el;
  }

  onMouseMove(e) {
    if (this._dragging && this.selectedElement) {
      const pos = this.getMousePos(e);
      const el = this.selectedElement;
      if (el.tagName === 'rect') {
        el.setAttribute('x', pos.x - this._dragOffsetX);
        el.setAttribute('y', pos.y - this._dragOffsetY);
      } else if (el.tagName === 'ellipse') {
        el.setAttribute('cx', pos.x - this._dragOffsetX + parseFloat(el.getAttribute('rx')));
        el.setAttribute('cy', pos.y - this._dragOffsetY + parseFloat(el.getAttribute('ry')));
      } else if (el.tagName === 'line') {
        const dx = pos.x - this._dragOffsetX - parseFloat(el.getAttribute('x1') || 0);
        const dy = pos.y - this._dragOffsetY - parseFloat(el.getAttribute('y1') || 0);
        el.setAttribute('x1', parseFloat(el.getAttribute('x1')) + dx);
        el.setAttribute('y1', parseFloat(el.getAttribute('y1')) + dy);
        el.setAttribute('x2', parseFloat(el.getAttribute('x2')) + dx);
        el.setAttribute('y2', parseFloat(el.getAttribute('y2')) + dy);
      } else if (el.tagName === 'text') {
        el.setAttribute('x', pos.x - this._dragOffsetX);
        el.setAttribute('y', pos.y - this._dragOffsetY);
      } else if (el.tagName === 'g') {
        const rect = el.querySelector('rect');
        const text = el.querySelector('text');
        if (rect) {
          const rx = pos.x - this._dragOffsetX;
          const ry = pos.y - this._dragOffsetY;
          rect.setAttribute('x', rx);
          rect.setAttribute('y', ry);
          if (text) {
            text.setAttribute('x', rx + 12);
            text.setAttribute('y', ry + 26);
          }
        }
      }
      return;
    }

    if (!this.isDrawing || !this.currentElement) return;
    const pos = this.getMousePos(e);

    if (this.currentTool === 'rect') {
      this.currentElement.setAttribute('x', Math.min(this.startX, pos.x));
      this.currentElement.setAttribute('y', Math.min(this.startY, pos.y));
      this.currentElement.setAttribute('width', Math.abs(pos.x - this.startX));
      this.currentElement.setAttribute('height', Math.abs(pos.y - this.startY));
    } else if (this.currentTool === 'ellipse') {
      this.currentElement.setAttribute('rx', Math.abs(pos.x - this.startX));
      this.currentElement.setAttribute('ry', Math.abs(pos.y - this.startY));
    } else if (this.currentTool === 'line' || this.currentTool === 'arrow' || this.currentTool === 'connector') {
      this.currentElement.setAttribute('x2', pos.x);
      this.currentElement.setAttribute('y2', pos.y);
    } else if (this.currentTool === 'highlighter') {
      this._highlighterPoints.push([pos.x, pos.y]);
      this.currentElement.setAttribute('points', this._highlighterPoints.map(p => p.join(',')).join(' '));
    } else if (this.currentTool === 'sticky') {
      const rect = this.currentElement.querySelector('rect');
      const text = this.currentElement.querySelector('text');
      if (rect) {
        rect.setAttribute('x', Math.min(this.startX, pos.x));
        rect.setAttribute('y', Math.min(this.startY, pos.y));
        rect.setAttribute('width', Math.max(80, Math.abs(pos.x - this.startX)));
        rect.setAttribute('height', Math.max(80, Math.abs(pos.y - this.startY)));
      }
      if (text) {
        text.setAttribute('x', Math.min(this.startX, pos.x) + 12);
        text.setAttribute('y', Math.min(this.startY, pos.y) + 26);
      }
    } else if (this.currentTool === 'diamond') {
      const minX = Math.min(this.startX, pos.x);
      const minY = Math.min(this.startY, pos.y);
      const w = Math.abs(pos.x - this.startX);
      const h = Math.abs(pos.y - this.startY);
      const midX = minX + w / 2;
      const midY = minY + h / 2;
      this.currentElement.setAttribute('points', `${midX},${minY} ${minX + w},${midY} ${midX},${minY + h} ${minX},${midY}`);
    } else if (this.currentTool === 'terminator') {
      this.currentElement.setAttribute('x', Math.min(this.startX, pos.x));
      this.currentElement.setAttribute('y', Math.min(this.startY, pos.y));
      this.currentElement.setAttribute('width', Math.abs(pos.x - this.startX));
      this.currentElement.setAttribute('height', Math.abs(pos.y - this.startY));
    } else if (this.currentTool === 'io') {
      const minX = Math.min(this.startX, pos.x);
      const minY = Math.min(this.startY, pos.y);
      const w = Math.abs(pos.x - this.startX);
      const h = Math.abs(pos.y - this.startY);
      const slant = w * 0.22;
      this.currentElement.setAttribute('points', `${minX + slant},${minY} ${minX + w},${minY} ${minX + w - slant},${minY + h} ${minX},${minY + h}`);
    } else if (this.currentTool === 'dimension') {
      const line = this.currentElement.querySelector('line');
      const txt = this.currentElement.querySelector('text');
      if (line) {
        line.setAttribute('x2', pos.x);
        line.setAttribute('y2', pos.y);
      }
      const dist = Math.round(Math.hypot(pos.x - this.startX, pos.y - this.startY));
      if (txt) {
        txt.setAttribute('x', (this.startX + pos.x) / 2);
        txt.setAttribute('y', (this.startY + pos.y) / 2 - 6);
        txt.textContent = `|← ${dist}px →|`;
      }
    }
  }

  onMouseUp(e) {
    if (this._dragging) {
      this._dragging = false;
      this.triggerAutoSave();
      return;
    }
    if (this.isDrawing && this.currentElement) {
      this.shapes.push(this.currentElement);
      this.isDrawing = false;
      this.currentElement = null;
      this.triggerAutoSave();
    }
  }

  onDblClick(e) {
    const targetG = e.target.closest('g[data-sigma-tool="sticky"]');
    if (targetG) {
      const textEl = targetG.querySelector('text');
      const newText = prompt('Edit sticky note:', textEl ? textEl.textContent : '');
      if (newText !== null && textEl) {
        textEl.textContent = newText;
        this.triggerAutoSave();
        return;
      }
    }

    if (this.currentTool === 'text') {
      const pos = this.getMousePos(e);
      const text = prompt('Enter text:');
      if (!text) return;
      this._saveHistory();
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      el.setAttribute('x', pos.x);
      el.setAttribute('y', pos.y);
      el.setAttribute('font-size', '16');
      el.setAttribute('fill', this.strokeColor);
      el.setAttribute('font-family', 'sans-serif');
      el.setAttribute('data-sigma-shape', '1');
      el.textContent = text;
      this.svg.appendChild(el);
      this.shapes.push(el);
      this.triggerAutoSave();
    } else if (this.currentTool === 'polygon' && this._polyPoints.length >= 2) {
      // Close polygon
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', this._polyPoints.map(p => p.join(',')).join(' '));
      poly.setAttribute('fill', this.fillColor);
      poly.setAttribute('stroke', this.strokeColor);
      poly.setAttribute('stroke-width', this.strokeWidth);
      poly.setAttribute('data-sigma-shape', '1');
      if (this.currentElement) { this.svg.removeChild(this.currentElement); this.currentElement = null; }
      this.svg.appendChild(poly);
      this.shapes.push(poly);
      this._polyPoints = [];
      this.triggerAutoSave();
    }
  }

  // --- Canvas Zoom Controls ---
  zoomIn() {
    this.zoom = Math.min(3.0, Math.round((this.zoom + 0.15) * 100) / 100);
    this._applyZoom();
  }

  zoomOut() {
    this.zoom = Math.max(0.3, Math.round((this.zoom - 0.15) * 100) / 100);
    this._applyZoom();
  }

  resetZoom() {
    this.zoom = 1.0;
    this._applyZoom();
  }

  _applyZoom() {
    const w = this.baseWidth / this.zoom;
    const h = this.baseHeight / this.zoom;
    const ox = (this.baseWidth - w) / 2;
    const oy = (this.baseHeight - h) / 2;
    this.svg.setAttribute('viewBox', `${ox} ${oy} ${w} ${h}`);
    const lbl = document.getElementById('draw-zoom-level');
    if (lbl) lbl.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  _selectElement(el) {
    this._deselectAll();
    this.selectedElement = el;
    el.setAttribute('data-selected', '1');
    el.style.outline = '2px dashed #4dabf7';
    const oldOpacity = el.getAttribute('opacity') || 1;
    el.setAttribute('data-old-opacity', oldOpacity);
    el.setAttribute('opacity', Math.min(1, parseFloat(oldOpacity) * 0.85));
  }

  _deselectAll() {
    if (this.selectedElement) {
      this.selectedElement.removeAttribute('data-selected');
      this.selectedElement.style.outline = '';
      const old = this.selectedElement.getAttribute('data-old-opacity');
      if (old !== null) { this.selectedElement.setAttribute('opacity', old); this.selectedElement.removeAttribute('data-old-opacity'); }
      this.selectedElement = null;
    }
  }

  deleteSelected() {
    if (!this.selectedElement) return;
    this._saveHistory();
    this.svg.removeChild(this.selectedElement);
    this.shapes = this.shapes.filter(s => s !== this.selectedElement);
    this.selectedElement = null;
    this.triggerAutoSave();
  }

  duplicate() {
    if (!this.selectedElement) return;
    this._saveHistory();
    const clone = this.selectedElement.cloneNode(true);
    // Offset clone
    ['x', 'cx', 'x1', 'x2'].forEach(a => { const v = clone.getAttribute(a); if (v) clone.setAttribute(a, parseFloat(v) + 20); });
    ['y', 'cy', 'y1', 'y2'].forEach(a => { const v = clone.getAttribute(a); if (v) clone.setAttribute(a, parseFloat(v) + 20); });
    this.svg.appendChild(clone);
    this.shapes.push(clone);
    this._selectElement(clone);
    this.triggerAutoSave();
  }

  bringToFront() {
    if (!this.selectedElement) return;
    this._saveHistory();
    this.svg.appendChild(this.selectedElement);
    this.triggerAutoSave();
  }

  sendToBack() {
    if (!this.selectedElement) return;
    this._saveHistory();
    const firstShape = this.svg.querySelector('[data-sigma-shape]');
    if (firstShape) this.svg.insertBefore(this.selectedElement, firstShape);
    this.triggerAutoSave();
  }

  // --- Undo / Redo ---
  _saveHistory() {
    this._history.push(this.svg.innerHTML);
    if (this._history.length > 50) this._history.shift();
    this._redoStack = [];
  }

  undo() {
    if (this._history.length === 0) return;
    this._redoStack.push(this.svg.innerHTML);
    this.svg.innerHTML = this._history.pop();
    this._syncShapes();
    this.triggerAutoSave();
  }

  redo() {
    if (this._redoStack.length === 0) return;
    this._history.push(this.svg.innerHTML);
    this.svg.innerHTML = this._redoStack.pop();
    this._syncShapes();
    this.triggerAutoSave();
  }

  _syncShapes() {
    this.shapes = Array.from(this.svg.querySelectorAll('[data-sigma-shape]'));
    this.selectedElement = null;
  }

  clearCanvas() {
    this._saveHistory();
    this._initDefs();
    this.shapes = [];
    this.selectedElement = null;
    this.triggerAutoSave();
  }

  // --- Export ---
  exportSVG() {
    return new XMLSerializer().serializeToString(this.svg);
  }

  exportPNG() {
    const svgData = this.exportSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = this.svg.clientWidth || 800;
    canvas.height = this.svg.clientHeight || 600;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement('a');
      link.download = (this.title || 'drawing') + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = url;
  }

  copyToClipboard() {
    const svgData = this.exportSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    const canvas = document.createElement('canvas');
    canvas.width = this.svg.clientWidth || 800;
    canvas.height = this.svg.clientHeight || 600;
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((pngBlob) => {
        if (pngBlob && navigator.clipboard && navigator.clipboard.write) {
          navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]).then(() => {
            window.sigmaApp && window.sigmaApp.showNotification('Drawing copied to clipboard!', 'success');
          }).catch(() => {
            window.sigmaApp && window.sigmaApp.showNotification('Clipboard write restricted', 'info');
          });
        }
      });
    };
    img.src = url;
  }

  toVectorCraftJSON() {
    return JSON.stringify({
      format: 'SigmaOS.VectorCraft',
      version: '2.0',
      title: this.title,
      svg: this.exportSVG(),
      gridSnap: this.gridSnap,
      strokeColor: this.strokeColor,
      fillColor: this.fillColor,
      updatedAt: Date.now()
    }, null, 2);
  }

  fromVectorCraftJSON(json) {
    try {
      const data = typeof json === 'string' ? JSON.parse(json) : json;
      if (data.svg) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.svg, 'image/svg+xml');
        const svgEl = doc.querySelector('svg');
        if (svgEl) this.svg.innerHTML = svgEl.innerHTML;
      }
      if (data.strokeColor) this.strokeColor = data.strokeColor;
      if (data.fillColor)   this.fillColor   = data.fillColor;
      if (data.gridSnap !== undefined) this.gridSnap = data.gridSnap;
      this._syncShapes();
    } catch (e) { console.error('VectorCraft load error:', e); }
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'draw',
          title: this.title,
          svgContent: this.exportSVG(),
          updatedAt: Date.now()
        });
      }
    }, 1500);
  }
}

window.DrawWeb = DrawWeb;
