/**
 * SigmaOS Draw Web (VectorCraft / LibreOffice Draw inspired).
 * Fully offline SVG vector illustration and flowchart editor in Chromium.
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
    this.setupListeners();
  }

  setTool(tool) {
    this.currentTool = tool;
  }

  setupListeners() {
    this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
    this.svg.addEventListener('mousemove', (e) => this.onMouseMove(e));
    this.svg.addEventListener('mouseup', () => this.onMouseUp());
  }

  getMousePos(e) {
    const rect = this.svg.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  onMouseDown(e) {
    this.isDrawing = true;
    const pos = this.getMousePos(e);
    this.startX = pos.x;
    this.startY = pos.y;

    if (this.currentTool === 'rect') {
      this.currentElement = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      this.currentElement.setAttribute('x', this.startX);
      this.currentElement.setAttribute('y', this.startY);
      this.currentElement.setAttribute('width', '0');
      this.currentElement.setAttribute('height', '0');
      this.currentElement.setAttribute('rx', '4');
      this.currentElement.setAttribute('fill', this.fillColor);
      this.currentElement.setAttribute('stroke', this.strokeColor);
      this.currentElement.setAttribute('stroke-width', this.strokeWidth);
      this.svg.appendChild(this.currentElement);
    } else if (this.currentTool === 'ellipse') {
      this.currentElement = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      this.currentElement.setAttribute('cx', this.startX);
      this.currentElement.setAttribute('cy', this.startY);
      this.currentElement.setAttribute('rx', '0');
      this.currentElement.setAttribute('ry', '0');
      this.currentElement.setAttribute('fill', this.fillColor);
      this.currentElement.setAttribute('stroke', this.strokeColor);
      this.currentElement.setAttribute('stroke-width', this.strokeWidth);
      this.svg.appendChild(this.currentElement);
    } else if (this.currentTool === 'line') {
      this.currentElement = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      this.currentElement.setAttribute('x1', this.startX);
      this.currentElement.setAttribute('y1', this.startY);
      this.currentElement.setAttribute('x2', this.startX);
      this.currentElement.setAttribute('y2', this.startY);
      this.currentElement.setAttribute('stroke', this.strokeColor);
      this.currentElement.setAttribute('stroke-width', this.strokeWidth);
      this.svg.appendChild(this.currentElement);
    }
  }

  onMouseMove(e) {
    if (!this.isDrawing || !this.currentElement) return;
    const pos = this.getMousePos(e);

    if (this.currentTool === 'rect') {
      const x = Math.min(this.startX, pos.x);
      const y = Math.min(this.startY, pos.y);
      const w = Math.abs(pos.x - this.startX);
      const h = Math.abs(pos.y - this.startY);
      this.currentElement.setAttribute('x', x);
      this.currentElement.setAttribute('y', y);
      this.currentElement.setAttribute('width', w);
      this.currentElement.setAttribute('height', h);
    } else if (this.currentTool === 'ellipse') {
      const rx = Math.abs(pos.x - this.startX);
      const ry = Math.abs(pos.y - this.startY);
      this.currentElement.setAttribute('rx', rx);
      this.currentElement.setAttribute('ry', ry);
    } else if (this.currentTool === 'line') {
      this.currentElement.setAttribute('x2', pos.x);
      this.currentElement.setAttribute('y2', pos.y);
    }
  }

  onMouseUp() {
    if (this.isDrawing && this.currentElement) {
      this.shapes.push(this.currentElement);
      this.isDrawing = false;
      this.currentElement = null;
      this.triggerAutoSave();
    }
  }

  clearCanvas() {
    this.svg.innerHTML = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#000000" />
        </marker>
      </defs>
    `;
    this.shapes = [];
    this.triggerAutoSave();
  }

  exportSVG() {
    return new XMLSerializer().serializeToString(this.svg);
  }

  toVectorCraftJSON() {
    return JSON.stringify({
      format: "SigmaOS.VectorCraft",
      version: "1.0",
      title: this.title,
      svg: this.exportSVG(),
      updatedAt: Date.now()
    }, null, 2);
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
    }, 1000);
  }
}

window.DrawWeb = DrawWeb;
