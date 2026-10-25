/**
 * SigmaOS Calc Web (GridCraft).
 * Inspired by: LibreOffice Calc, EtherCalc, OnlyOffice Sheets, Gnumeric.
 * Fully offline reactive spreadsheet with multi-sheet tabs, 35+ functions,
 * fill-down, sort, cell formatting, keyboard navigation, and CSV import.
 */
class CalcWeb {
  constructor(tableElement, formulaBarInput, activeCellDisplay, rows = 30, cols = 15) {
    this.table = tableElement;
    this.formulaBar = formulaBarInput;
    this.activeCellDisplay = activeCellDisplay;
    this.numRows = rows;
    this.numCols = cols;
    this.activeCoord = 'A1';
    this.docId = 'sheet_' + Date.now();
    this.title = 'Untitled Spreadsheet';

    // Multi-sheet support (EtherCalc-inspired)
    this.sheets = { Sheet1: {} };    // sheetName -> cells map
    this.activeSheet = 'Sheet1';
    this.cellFormats = {};           // coord -> {bold, italic, underline, fmt}
    this._saveTimer = null;

    this.renderGrid();
    this.setupListeners();
    this._renderSheetTabs();
  }

  get cells() { return this.sheets[this.activeSheet]; }

  // --- Column name helper ---
  colName(n) {
    let s = '';
    while (n >= 0) {
      s = String.fromCharCode((n % 26) + 65) + s;
      n = Math.floor(n / 26) - 1;
    }
    return s;
  }

  parseCoord(s) {
    const m = (s || '').match(/^([A-Z]+)(\d+)$/);
    if (!m) return null;
    let col = 0;
    for (let i = 0; i < m[1].length; i++) col = col * 26 + (m[1].charCodeAt(i) - 64);
    return [parseInt(m[2]), col - 1]; // [rowNum, colIdx]
  }

  // --- Multi-sheet management (EtherCalc-inspired) ---
  addSheet(name) {
    const sheetName = name || `Sheet${Object.keys(this.sheets).length + 1}`;
    if (!this.sheets[sheetName]) this.sheets[sheetName] = {};
    this.switchSheet(sheetName);
  }

  switchSheet(name) {
    if (!this.sheets[name]) return;
    this.activeSheet = name;
    this.renderGrid();
    this._renderSheetTabs();
    this.recalculateAll();
  }

  deleteSheet(name) {
    if (Object.keys(this.sheets).length <= 1) return; // keep at least one
    delete this.sheets[name];
    if (this.activeSheet === name) {
      this.activeSheet = Object.keys(this.sheets)[0];
    }
    this.renderGrid();
    this._renderSheetTabs();
    this.recalculateAll();
  }

  _renderSheetTabs() {
    const container = document.getElementById('calc-sheet-tabs');
    if (!container) return;
    container.innerHTML = '';
    for (const name of Object.keys(this.sheets)) {
      const tab = document.createElement('button');
      tab.className = 'sheet-tab' + (name === this.activeSheet ? ' active' : '');
      tab.textContent = name;
      tab.onclick = () => this.switchSheet(name);
      container.appendChild(tab);
    }
    const addBtn = document.createElement('button');
    addBtn.className = 'sheet-tab sheet-tab-add';
    addBtn.textContent = '+';
    addBtn.title = 'Add Sheet';
    addBtn.onclick = () => this.addSheet();
    container.appendChild(addBtn);
  }

  // --- Grid rendering ---
  renderGrid() {
    this.table.innerHTML = '';
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'grid-corner';
    headerRow.appendChild(corner);
    for (let c = 0; c < this.numCols; c++) {
      const th = document.createElement('th');
      th.innerText = this.colName(c);
      th.dataset.colIdx = c;
      headerRow.appendChild(th);
    }
    this.table.appendChild(headerRow);

    for (let r = 0; r < this.numRows; r++) {
      const tr = document.createElement('tr');
      const rowHeader = document.createElement('th');
      rowHeader.innerText = (r + 1).toString();
      tr.appendChild(rowHeader);
      for (let c = 0; c < this.numCols; c++) {
        const coord = `${this.colName(c)}${r + 1}`;
        const td = document.createElement('td');
        td.dataset.coord = coord;
        td.contentEditable = 'true';
        td.className = 'calc-cell';
        tr.appendChild(td);
      }
      this.table.appendChild(tr);
    }
  }

  setupListeners() {
    this.table.addEventListener('focusin', (e) => {
      const td = e.target.closest('td.calc-cell');
      if (td) this.selectCell(td.dataset.coord);
    });

    this.table.addEventListener('blur', (e) => {
      const td = e.target.closest('td.calc-cell');
      if (td) {
        this.setCellRaw(td.dataset.coord, td.innerText.trim());
        this.recalculateAll();
      }
    }, true);

    // Keyboard navigation: Tab → right, Shift+Tab → left, Enter → down, Arrows
    this.table.addEventListener('keydown', (e) => {
      const td = e.target.closest('td.calc-cell');
      if (!td) return;
      const coord = td.dataset.coord;
      const parsed = this.parseCoord(coord);
      if (!parsed) return;
      const [row, col] = parsed;

      let nextCoord = null;
      if (e.key === 'Tab') {
        e.preventDefault();
        nextCoord = e.shiftKey ? `${this.colName(col - 1)}${row}` : `${this.colName(col + 1)}${row}`;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.setCellRaw(coord, td.innerText.trim());
        this.recalculateAll();
        nextCoord = `${this.colName(col)}${row + 1}`;
      } else if (e.key === 'ArrowUp')   { e.preventDefault(); nextCoord = `${this.colName(col)}${row - 1}`; }
        else if (e.key === 'ArrowDown')  { e.preventDefault(); nextCoord = `${this.colName(col)}${row + 1}`; }
        else if (e.key === 'ArrowLeft')  { e.preventDefault(); nextCoord = `${this.colName(col - 1)}${row}`; }
        else if (e.key === 'ArrowRight') { e.preventDefault(); nextCoord = `${this.colName(col + 1)}${row}`; }

      if (nextCoord) {
        const next = this.table.querySelector(`td[data-coord="${nextCoord}"]`);
        if (next) { next.focus(); this.selectCell(nextCoord); }
      }
    });

    if (this.formulaBar) {
      this.formulaBar.addEventListener('input', (e) => {
        if (this.activeCoord) this.setCellRaw(this.activeCoord, e.target.value);
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
    if (this.formulaBar) this.formulaBar.value = rawVal || '';
    document.querySelectorAll('td.calc-cell.selected').forEach(el => el.classList.remove('selected'));
    const td = this.table.querySelector(`td[data-coord="${coord}"]`);
    if (td) td.classList.add('selected');
  }

  focusNextRow() {
    const m = this.activeCoord && this.activeCoord.match(/^([A-Z]+)(\d+)$/);
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

  // --- Cell formatting (OnlyOffice-inspired) ---
  setCellFormat(coord, format) {
    if (!this.cellFormats[coord]) this.cellFormats[coord] = {};
    Object.assign(this.cellFormats[coord], format);
    const td = this.table.querySelector(`td[data-coord="${coord}"]`);
    if (td) {
      if (format.bold !== undefined)      td.style.fontWeight = format.bold ? 'bold' : '';
      if (format.italic !== undefined)    td.style.fontStyle  = format.italic ? 'italic' : '';
      if (format.underline !== undefined) td.style.textDecoration = format.underline ? 'underline' : '';
      if (format.color)                   td.style.color = format.color;
      if (format.bg)                      td.style.backgroundColor = format.bg;
    }
  }

  // --- Fill Down (EtherCalc-inspired) ---
  fillDown(startCoord, endCoord) {
    const s = this.parseCoord(startCoord);
    const e = this.parseCoord(endCoord);
    if (!s || !e) return;
    const [r1, c1] = s, [r2] = e;
    const srcCell = this.cells[startCoord];
    if (!srcCell) return;
    for (let r = r1 + 1; r <= r2; r++) {
      const coord = `${this.colName(c1)}${r}`;
      this.setCellRaw(coord, srcCell.raw || '');
    }
    this.recalculateAll();
  }

  // --- Sort range (Gnumeric-inspired) ---
  sortRange(startCoord, endCoord, colIndex = 0, ascending = true) {
    const s = this.parseCoord(startCoord);
    const e = this.parseCoord(endCoord);
    if (!s || !e) return;
    const [r1, c1] = s, [r2, c2] = e;
    const rows = [];
    for (let r = r1; r <= r2; r++) {
      const row = [];
      for (let c = c1; c <= c2; c++) {
        row.push(this.getCellValue(`${this.colName(c)}${r}`));
      }
      rows.push(row);
    }
    rows.sort((a, b) => {
      const av = a[colIndex], bv = b[colIndex];
      if (typeof av === 'number' && typeof bv === 'number') return ascending ? av - bv : bv - av;
      return ascending ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
    rows.forEach((row, ri) => {
      row.forEach((val, ci) => {
        const coord = `${this.colName(c1 + ci)}${r1 + ri}`;
        this.setCellRaw(coord, String(val));
      });
    });
    this.recalculateAll();
  }

  // --- Find cell ---
  findCell(query) {
    for (const [coord, c] of Object.entries(this.cells)) {
      const val = String(c.value || c.raw || '');
      if (val.toLowerCase().includes(String(query).toLowerCase())) return coord;
    }
    return null;
  }

  // --- Recalculate ---
  recalculateAll() {
    for (const [coord, c] of Object.entries(this.cells)) {
      if (c.raw && c.raw.startsWith('=')) {
        try {
          c.value = this.evalFormula(c.raw.substring(1));
        } catch {
          c.value = '#ERROR!';
        }
      } else {
        const num = Number(c.raw);
        c.value = (!isNaN(num) && c.raw !== '') ? num : (c.raw || '');
      }
    }
    document.querySelectorAll('td.calc-cell').forEach(td => {
      const coord = td.dataset.coord;
      const c = this.cells[coord];
      const val = c ? c.value : '';
      td.innerText = val !== undefined ? val : '';
      // Reapply formats
      const fmt = this.cellFormats[coord];
      if (fmt) {
        if (fmt.bold)      td.style.fontWeight = 'bold';
        if (fmt.italic)    td.style.fontStyle = 'italic';
        if (fmt.underline) td.style.textDecoration = 'underline';
        if (fmt.color)     td.style.color = fmt.color;
        if (fmt.bg)        td.style.backgroundColor = fmt.bg;
      }
    });
    this.triggerAutoSave();
  }

  // --- Formula engine (35+ functions inspired by LibreOffice Calc / Gnumeric) ---
  evalFormula(formula) {
    let f = formula.trim().toUpperCase();

    // Nested function calls: IFERROR(expr, fallback)
    if (f.startsWith('IFERROR(')) {
      const inner = f.slice(8, -1);
      const commaIdx = this._splitArgs(inner)[1];
      if (commaIdx !== -1) {
        const tryExpr = inner.slice(0, commaIdx).trim();
        const fallback = inner.slice(commaIdx + 1).trim();
        try {
          const r = this.evalFormula(tryExpr);
          if (typeof r === 'string' && r.startsWith('#')) return this.evalFormula(fallback);
          return r;
        } catch { return this.evalFormula(fallback); }
      }
    }

    const m = f.match(/^([A-Z]+)\(([\s\S]*)\)$/);
    if (m) {
      const fn = m[1];
      const argStr = m[2].trim();

      // Range functions
      if (argStr.includes(':')) {
        const parts = this._splitArgs(argStr);
        const rangeArg = argStr.slice(0, parts[0] !== -1 ? parts[0] : argStr.length).trim();
        if (rangeArg.includes(':')) {
          const [start, end] = rangeArg.split(':');
          const vals = this.getRangeValues(start.trim(), end.trim()).filter(v => typeof v === 'number');
          const allVals = this.getRangeValues(start.trim(), end.trim());
          if (fn === 'SUM')     return vals.reduce((a, b) => a + b, 0);
          if (fn === 'AVERAGE') return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
          if (fn === 'MIN')     return vals.length ? Math.min(...vals) : 0;
          if (fn === 'MAX')     return vals.length ? Math.max(...vals) : 0;
          if (fn === 'COUNT')   return vals.length;
          if (fn === 'COUNTA')  return allVals.filter(v => v !== '' && v !== undefined && v !== null).length;
          if (fn === 'STDEV') {
            if (vals.length < 2) return 0;
            const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
            return Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((a, b) => a + b, 0) / (vals.length - 1));
          }
          if (fn === 'MEDIAN') {
            const sorted = [...vals].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
          }
          if (fn === 'MODE') {
            const freq = {}; let maxF = 0; let modeVal = vals[0];
            vals.forEach(v => { freq[v] = (freq[v] || 0) + 1; if (freq[v] > maxF) { maxF = freq[v]; modeVal = v; } });
            return modeVal;
          }
          if (fn === 'PRODUCT') return vals.reduce((a, b) => a * b, 1);
        }
      }

      // Multi-arg functions
      const args = this._splitArgs(argStr);
      const argList = this._extractArgs(argStr, args);

      if (fn === 'IF' && argList.length === 3) {
        const cond = this.evalExpr(argList[0]);
        return (cond && cond !== '0' && cond !== 'FALSE') ? this.evalExpr(argList[1]) : this.evalExpr(argList[2]);
      }
      if (fn === 'AND') return argList.every(a => this.evalExpr(a)) ? 'TRUE' : 'FALSE';
      if (fn === 'OR')  return argList.some(a => this.evalExpr(a)) ? 'TRUE' : 'FALSE';
      if (fn === 'NOT') return !this.evalExpr(argList[0]) ? 'TRUE' : 'FALSE';
      if (fn === 'CONCAT' || fn === 'CONCATENATE') {
        return argList.map(a => String(this.evalExpr(a))).join('');
      }
      if (fn === 'LEFT' && argList.length >= 2) {
        const s = String(this.evalExpr(argList[0]));
        return s.slice(0, parseInt(this.evalExpr(argList[1])));
      }
      if (fn === 'RIGHT' && argList.length >= 2) {
        const s = String(this.evalExpr(argList[0]));
        const n = parseInt(this.evalExpr(argList[1]));
        return s.slice(-n);
      }
      if (fn === 'MID' && argList.length === 3) {
        const s = String(this.evalExpr(argList[0]));
        const start = parseInt(this.evalExpr(argList[1])) - 1;
        const len = parseInt(this.evalExpr(argList[2]));
        return s.substr(start, len);
      }
      if (fn === 'LEN')   return String(this.evalExpr(argList[0])).length;
      if (fn === 'UPPER') return String(this.evalExpr(argList[0])).toUpperCase();
      if (fn === 'LOWER') return String(this.evalExpr(argList[0])).toLowerCase();
      if (fn === 'TRIM')  return String(this.evalExpr(argList[0])).trim();
      if (fn === 'ABS')   return Math.abs(Number(this.evalExpr(argList[0])));
      if (fn === 'ROUND' && argList.length === 2) {
        const n = Number(this.evalExpr(argList[0])), d = Number(this.evalExpr(argList[1]));
        return Math.round(n * 10 ** d) / 10 ** d;
      }
      if (fn === 'FLOOR' && argList.length === 2) {
        const n = Number(this.evalExpr(argList[0])), sig = Number(this.evalExpr(argList[1]));
        return Math.floor(n / sig) * sig;
      }
      if (fn === 'CEILING' || fn === 'CEIL') {
        const n = Number(this.evalExpr(argList[0])), sig = argList.length > 1 ? Number(this.evalExpr(argList[1])) : 1;
        return Math.ceil(n / sig) * sig;
      }
      if (fn === 'MOD' && argList.length === 2) {
        return Number(this.evalExpr(argList[0])) % Number(this.evalExpr(argList[1]));
      }
      if (fn === 'POWER' && argList.length === 2) {
        return Math.pow(Number(this.evalExpr(argList[0])), Number(this.evalExpr(argList[1])));
      }
      if (fn === 'SQRT')  return Math.sqrt(Number(this.evalExpr(argList[0])));
      if (fn === 'PI')    return Math.PI;
      if (fn === 'EXP')   return Math.exp(Number(this.evalExpr(argList[0])));
      if (fn === 'LN')    return Math.log(Number(this.evalExpr(argList[0])));
      if (fn === 'LOG') {
        const n = Number(this.evalExpr(argList[0]));
        const base = argList.length > 1 ? Number(this.evalExpr(argList[1])) : 10;
        return Math.log(n) / Math.log(base);
      }
      if (fn === 'NOW')   return new Date().toISOString().slice(0, 19).replace('T', ' ');
      if (fn === 'TODAY') return new Date().toISOString().slice(0, 10);
      if (fn === 'YEAR')  return new Date(String(this.evalExpr(argList[0]))).getFullYear();
      if (fn === 'MONTH') return new Date(String(this.evalExpr(argList[0]))).getMonth() + 1;
      if (fn === 'DAY')   return new Date(String(this.evalExpr(argList[0]))).getDate();
      if (fn === 'ISERROR') {
        try { const v = this.evalExpr(argList[0]); return (typeof v === 'string' && v.startsWith('#')) ? 'TRUE' : 'FALSE'; }
        catch { return 'TRUE'; }
      }
      if (fn === 'COUNTIF' && argList.length === 2) {
        const rangeStr = argList[0].trim();
        const criterion = String(this.evalExpr(argList[1]));
        if (rangeStr.includes(':')) {
          const [s, e] = rangeStr.split(':');
          const vals = this.getRangeValues(s.trim(), e.trim());
          return vals.filter(v => String(v) === criterion).length;
        }
        return 0;
      }
      if (fn === 'SUMIF' && argList.length === 3) {
        const rangeStr = argList[0].trim();
        const criterion = String(this.evalExpr(argList[1]));
        const sumRangeStr = argList[2].trim();
        if (rangeStr.includes(':') && sumRangeStr.includes(':')) {
          const [rs, re] = rangeStr.split(':');
          const [ss, se] = sumRangeStr.split(':');
          const criteria = this.getRangeValues(rs.trim(), re.trim());
          const sums = this.getRangeValues(ss.trim(), se.trim());
          let total = 0;
          criteria.forEach((v, i) => { if (String(v) === criterion && typeof sums[i] === 'number') total += sums[i]; });
          return total;
        }
        return 0;
      }
    }

    return this.evalExpr(formula.trim());
  }

  _splitArgs(argStr) {
    // Return index of first top-level comma
    let depth = 0, firstComma = -1;
    for (let i = 0; i < argStr.length; i++) {
      const c = argStr[i];
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0 && firstComma === -1) firstComma = i;
    }
    return [firstComma];
  }

  _extractArgs(argStr, _splitResult) {
    // Split by top-level commas
    const args = []; let depth = 0, start = 0;
    for (let i = 0; i <= argStr.length; i++) {
      const c = i < argStr.length ? argStr[i] : ',';
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === ',' && depth === 0) {
        args.push(argStr.slice(start, i).trim());
        start = i + 1;
      }
    }
    return args;
  }

  evalExpr(expr) {
    if (!expr || String(expr).trim() === '') return '';
    // Resolve cell references
    let exp = String(expr).replace(/\b([A-Z]+\d+)\b/gi, (match) => {
      const val = this.getCellValue(match.toUpperCase());
      return typeof val === 'number' ? val : `"${String(val).replace(/"/g, '\\"')}"`;
    });
    // Boolean literals
    exp = exp.replace(/\bTRUE\b/gi, 'true').replace(/\bFALSE\b/gi, 'false');
    try {
      // eslint-disable-next-line no-new-func
      return Function('"use strict"; return (' + exp + ')')();
    } catch {
      return '#VALUE!';
    }
  }

  getRangeValues(start, end) {
    const s = this.parseCoord(start);
    const e = this.parseCoord(end);
    if (!s || !e) return [];
    const [r1, c1] = s, [r2, c2] = e;
    const minR = Math.min(r1, r2), maxR = Math.max(r1, r2);
    const minC = Math.min(c1, c2), maxC = Math.max(c1, c2);
    const values = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        values.push(this.getCellValue(`${this.colName(c)}${r}`));
      }
    }
    return values;
  }

  // --- CSV I/O (improved quoted-field handling) ---
  toCSV() {
    const rows = [];
    for (let r = 1; r <= this.numRows; r++) {
      const row = [];
      for (let c = 0; c < this.numCols; c++) {
        const v = String(this.getCellValue(`${this.colName(c)}${r}`));
        row.push(`"${v.replace(/"/g, '""')}"`);
      }
      rows.push(row.join(','));
    }
    return rows.join('\n');
  }

  fromCSV(csvText) {
    this.sheets[this.activeSheet] = {};
    const parseCSVLine = (line) => {
      const result = []; let inQuotes = false, current = '';
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = !inQuotes;
        } else if (ch === ',' && !inQuotes) {
          result.push(current); current = '';
        } else { current += ch; }
      }
      result.push(current);
      return result;
    };
    const lines = csvText.split(/\r?\n/);
    lines.forEach((line, r) => {
      if (!line.trim()) return;
      parseCSVLine(line).forEach((val, c) => {
        const clean = val.trim();
        if (clean) this.setCellRaw(`${this.colName(c)}${r + 1}`, clean);
      });
    });
    this.recalculateAll();
  }

  // --- Format export (OnlyOffice-inspired) ---
  toGridCraftJSON() {
    return JSON.stringify({
      format: 'SigmaOS.GridCraft',
      version: '2.0',
      title: this.title,
      sheets: this.sheets,
      activeSheet: this.activeSheet,
      cellFormats: this.cellFormats,
      updatedAt: Date.now()
    }, null, 2);
  }

  toXLSXLike() {
    // JSON representation compatible with SheetJS-style XLSX structure
    const wb = { SheetNames: Object.keys(this.sheets), Sheets: {} };
    for (const [name, cells] of Object.entries(this.sheets)) {
      const sheet = {};
      for (const [coord, c] of Object.entries(cells)) {
        sheet[coord] = { v: c.value !== undefined ? c.value : c.raw, f: c.raw && c.raw.startsWith('=') ? c.raw.slice(1) : undefined };
      }
      wb.Sheets[name] = sheet;
    }
    return JSON.stringify(wb, null, 2);
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'calc',
          title: this.title,
          sheets: this.sheets,
          activeSheet: this.activeSheet,
          cellFormats: this.cellFormats,
          updatedAt: Date.now()
        });
      }
    }, 1500);
  }
}

window.CalcWeb = CalcWeb;
