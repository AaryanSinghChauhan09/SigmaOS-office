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
    } else if (this.currentTool === 'diamond') {
      const elDiamond = document.createElementNS(ns, 'polygon');
      elDiamond.dataset.sigmaTool = 'diamond';
      elDiamond.setAttribute('data-sigma-shape', '1');
      elDiamond.setAttribute('points', `${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y} ${pos.x},${pos.y}`);
      elDiamond.setAttribute('fill', this.fillColor);
      elDiamond.setAttribute('stroke', this.strokeColor);
      elDiamond.setAttribute('stroke-width', this.strokeWidth);
      return elDiamond;
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
    } else if (this.currentTool === 'line' || this.currentTool === 'arrow') {
      this.currentElement.setAttribute('x2', pos.x);
      this.currentElement.setAttribute('y2', pos.y);
    } else if (this.currentTool === 'diamond') {
      const minX = Math.min(this.startX, pos.x);
      const minY = Math.min(this.startY, pos.y);
      const w = Math.abs(pos.x - this.startX);
      const h = Math.abs(pos.y - this.startY);
      const midX = minX + w / 2;
      const midY = minY + h / 2;
      this.currentElement.setAttribute('points', `${midX},${minY} ${minX + w},${midY} ${midX},${minY + h} ${minX},${midY}`);
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
