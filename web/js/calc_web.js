/**
 * SigmaOS Calc Web (GridCraft / LibreOffice Calc inspired).
 * Fully offline interactive reactive spreadsheet engine in Chromium.
 */
class CalcWeb {
  constructor(tableElement, formulaBarInput, activeCellDisplay, rows = 30, cols = 15) {
    this.table = tableElement;
    this.formulaBar = formulaBarInput;
    this.activeCellDisplay = activeCellDisplay;
    this.numRows = rows;
    this.numCols = cols;
    this.cells = {}; // 'A1' -> { raw: '=SUM(...)', value: 100 }
    this.activeCoord = 'A1';
    this.title = 'Untitled Spreadsheet';
    this.docId = 'sheet_' + Date.now();
    this.renderGrid();
    this.setupListeners();
  }

  colName(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  renderGrid() {
    this.table.innerHTML = '';
    // Header row
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'grid-corner';
    headerRow.appendChild(corner);

    for (let c = 0; c < this.numCols; c++) {
      const th = document.createElement('th');
      th.innerText = this.colName(c);
      headerRow.appendChild(th);
    }
    this.table.appendChild(headerRow);

    // Grid rows
    for (let r = 0; r < this.numRows; r++) {
      const tr = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.innerText = (r + 1).toString();
      tr.appendChild(rowHeader);

      for (let c = 0; c < this.numCols; c++) {
        const coord = `${this.colName(c)}${r + 1}`;
        const td = document.createElement('td');
        td.dataset.coord = coord;
        td.contentEditable = "true";
        td.className = 'calc-cell';
        tr.appendChild(td);
      }
      this.table.appendChild(tr);
    }
  }

  setupListeners() {
    this.table.addEventListener('focusin', (e) => {
      const td = e.target.closest('td.calc-cell');
      if (td) {
        this.selectCell(td.dataset.coord);
      }
    });

    this.table.addEventListener('blur', (e) => {
      const td = e.target.closest('td.calc-cell');
      if (td) {
        this.setCellRaw(td.dataset.coord, td.innerText.trim());
        this.recalculateAll();
      }
    }, true);

    if (this.formulaBar) {
      this.formulaBar.addEventListener('input', (e) => {
        if (this.activeCoord) {
          this.setCellRaw(this.activeCoord, e.target.value);
        }
      });
      this.formulaBar.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.recalculateAll();
          this.focusNextRow();
        }
      });
    }
  }

  selectCell(coord) {
    this.activeCoord = coord;
    if (this.activeCellDisplay) this.activeCellDisplay.innerText = coord;
    const cellData = this.cells[coord];
    const rawVal = cellData ? cellData.raw : '';
    if (this.formulaBar) this.formulaBar.value = rawVal;

    document.querySelectorAll('td.calc-cell.selected').forEach(el => el.classList.remove('selected'));
    const td = this.table.querySelector(`td[data-coord="${coord}"]`);
    if (td) td.classList.add('selected');
  }

  focusNextRow() {
    const m = this.activeCoord.match(/^([A-Z]+)(\d+)$/);
    if (m) {
      const nextCoord = `${m[1]}${parseInt(m[2]) + 1}`;
      const nextTd = this.table.querySelector(`td[data-coord="${nextCoord}"]`);
      if (nextTd) nextTd.focus();
    }
  }

  setCellRaw(coord, raw) {
    if (!this.cells[coord]) this.cells[coord] = {};
    this.cells[coord].raw = raw;
  }

  getCellValue(coord) {
    const c = this.cells[coord];
    if (!c) return '';
    return c.value !== undefined ? c.value : (c.raw || '');
  }

  recalculateAll() {
    for (const [coord, c] of Object.entries(this.cells)) {
      if (c.raw && c.raw.startsWith('=')) {
        try {
          c.value = this.evalFormula(c.raw.substring(1));
        } catch (err) {
          c.value = '#ERROR!';
        }
      } else {
        const num = Number(c.raw);
        c.value = (!isNaN(num) && c.raw !== '') ? num : (c.raw || '');
      }
    }

    // Update DOM
    document.querySelectorAll('td.calc-cell').forEach(td => {
      const coord = td.dataset.coord;
      const c = this.cells[coord];
      td.innerText = c ? c.value : '';
    });

    this.triggerAutoSave();
  }

  evalFormula(formula) {
    let f = formula.trim();
    // Function call e.g. SUM(A1:A5)
    const m = f.match(/^([A-Z]+)\((.*)\)$/i);
    if (m) {
      const fn = m[1].toUpperCase();
      const argStr = m[2];
      if (argStr.includes(':')) {
        const [start, end] = argStr.split(':').map(s => s.trim());
        const vals = this.getRangeValues(start, end).filter(v => typeof v === 'number');
        if (fn === 'SUM') return vals.reduce((a, b) => a + b, 0);
        if (fn === 'AVERAGE') return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        if (fn === 'MIN') return vals.length ? Math.min(...vals) : 0;
        if (fn === 'MAX') return vals.length ? Math.max(...vals) : 0;
        if (fn === 'COUNT') return vals.length;
      }
      if (fn === 'IF') {
        const parts = argStr.split(',').map(s => s.trim());
        if (parts.length === 3) {
          return this.evalExpr(parts[0]) ? this.evalExpr(parts[1]) : this.evalExpr(parts[2]);
        }
      }
    }
    return this.evalExpr(f);
  }

  evalExpr(expr) {
    let exp = expr.replace(/[A-Z]+\d+/gi, (match) => {
      const val = this.getCellValue(match.toUpperCase());
      return typeof val === 'number' ? val : `"${val}"`;
    });
    try {
      return Function(`"use strict"; return (${exp})`)();
    } catch {
      return '#VALUE!';
    }
  }

  getRangeValues(start, end) {
    const parseCoord = (s) => {
      const m = s.match(/^([A-Z]+)(\d+)$/);
      let col = 0;
      for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
      return [parseInt(m[2]), col - 1];
    };
    const [r1, c1] = parseCoord(start);
    const [r2, c2] = parseCoord(end);
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);

    const values = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        const coord = `${this.colName(c)}${r}`;
        const val = this.getCellValue(coord);
        values.push(val);
      }
    }
    return values;
  }

  toCSV() {
    const rows = [];
    for (let r = 1; r <= this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        const coord = `${this.colName(c)}${r}`;
        row.push(`"${(this.getCellValue(coord) + '').replace(/"/g, '""')}"`);
      }
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  fromCSV(csvText) {
    const lines = csvText.split(/\r?\n/);
    this.cells = {};
    lines.forEach((line, r) => {
      const cols = line.split(',');
      cols.forEach((val, c) => {
        const cleanVal = val.replace(/^"|"$/g, '').trim();
        if (cleanVal) {
          const coord = `${this.colName(c)}${r + 1}`;
          this.setCellRaw(coord, cleanVal);
        }
      });
    });
    this.recalculateAll();
  }

  toGridCraftJSON() {
    return JSON.stringify({
      format: "SigmaOS.GridCraft",
      version: "1.0",
      title: this.title,
      cells: this.cells,
      updatedAt: Date.now()
    }, null, 2);
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'calc',
          title: this.title,
          cells: this.cells,
          updatedAt: Date.now()
        });
      }
    }, 1000);
  }
}

window.CalcWeb = CalcWeb;
