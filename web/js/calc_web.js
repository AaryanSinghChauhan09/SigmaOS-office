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

      // Lookup & Reference Functions (LibreOffice / Excel parity)
      if (fn === 'VLOOKUP' && argList.length >= 3) {
        const lookupVal = String(this.evalExpr(argList[0])).toLowerCase();
        const rangeStr = argList[1].trim();
        const colIdx = parseInt(this.evalExpr(argList[2])) - 1;
        if (rangeStr.includes(':')) {
          const [start, end] = rangeStr.split(':');
          const s = this.parseCoord(start.trim()), e = this.parseCoord(end.trim());
          if (s && e) {
            for (let r = s[0]; r <= e[0]; r++) {
              const firstVal = String(this.getCellValue(`${this.colName(s[1])}${r}`)).toLowerCase();
              if (firstVal === lookupVal) {
                return this.getCellValue(`${this.colName(s[1] + colIdx)}${r}`);
              }
            }
          }
        }
        return '#N/A';
      }

      if (fn === 'INDEX' && argList.length >= 2) {
        const rangeStr = argList[0].trim();
        const rowIdx = parseInt(this.evalExpr(argList[1])) - 1;
        const colIdx = argList.length > 2 ? parseInt(this.evalExpr(argList[2])) - 1 : 0;
        if (rangeStr.includes(':')) {
          const [start] = rangeStr.split(':');
          const s = this.parseCoord(start.trim());
          if (s) {
            return this.getCellValue(`${this.colName(s[1] + colIdx)}${s[0] + rowIdx}`);
          }
        }
        return '#REF!';
      }

      if (fn === 'MATCH' && argList.length >= 2) {
        const lookupVal = String(this.evalExpr(argList[0])).toLowerCase();
        const rangeStr = argList[1].trim();
        if (rangeStr.includes(':')) {
          const [start, end] = rangeStr.split(':');
          const vals = this.getRangeValues(start.trim(), end.trim());
          for (let i = 0; i < vals.length; i++) {
            if (String(vals[i]).toLowerCase() === lookupVal) return i + 1;
          }
        }
        return '#N/A';
      }

      // Financial Functions
      if (fn === 'PMT' && argList.length >= 3) {
        const rate = Number(this.evalExpr(argList[0]));
        const nper = Number(this.evalExpr(argList[1]));
        const pv = Number(this.evalExpr(argList[2]));
        if (rate === 0) return -(pv / nper);
        const pmt = (rate * pv) / (1 - Math.pow(1 + rate, -nper));
        return -pmt;
      }

      if (fn === 'FV' && argList.length >= 3) {
        const rate = Number(this.evalExpr(argList[0]));
        const nper = Number(this.evalExpr(argList[1]));
        const pmt = Number(this.evalExpr(argList[2]));
        const pv = argList.length > 3 ? Number(this.evalExpr(argList[3])) : 0;
        if (rate === 0) return -(pv + pmt * nper);
        return -(pv * Math.pow(1 + rate, nper) + pmt * (Math.pow(1 + rate, nper) - 1) / rate);
      }

      if (fn === 'PV' && argList.length >= 3) {
        const rate = Number(this.evalExpr(argList[0]));
        const nper = Number(this.evalExpr(argList[1]));
        const pmt = Number(this.evalExpr(argList[2]));
        const fv = argList.length > 3 ? Number(this.evalExpr(argList[3])) : 0;
        if (rate === 0) return -(fv + pmt * nper);
        return -(fv + pmt * (Math.pow(1 + rate, nper) - 1) / rate) / Math.pow(1 + rate, nper);
      }

      // Engineering & Bitwise Functions
      if (fn === 'FACT') {
        const n = Math.floor(Number(this.evalExpr(argList[0])));
        if (n < 0) return '#NUM!';
        let res = 1; for (let i = 2; i <= n; i++) res *= i; return res;
      }

      if (fn === 'GCD' && argList.length >= 2) {
        const gcd2 = (a, b) => b === 0 ? a : gcd2(b, a % b);
        return argList.map(a => Math.abs(Number(this.evalExpr(a)))).reduce((a, b) => gcd2(a, b));
      }

      if (fn === 'LCM' && argList.length >= 2) {
        const gcd2 = (a, b) => b === 0 ? a : gcd2(b, a % b);
        const lcm2 = (a, b) => (a === 0 || b === 0) ? 0 : Math.abs(a * b) / gcd2(a, b);
        return argList.map(a => Math.abs(Number(this.evalExpr(a)))).reduce((a, b) => lcm2(a, b));
      }

      if (fn === 'BIN2DEC') return parseInt(String(this.evalExpr(argList[0])), 2);
      if (fn === 'DEC2BIN') return (Number(this.evalExpr(argList[0])) >>> 0).toString(2);
      if (fn === 'HEX2DEC') return parseInt(String(this.evalExpr(argList[0])), 16);
      if (fn === 'DEC2HEX') return (Number(this.evalExpr(argList[0])) >>> 0).toString(16).toUpperCase();

      // Statistical & Financial Functions (LibreOffice / Gnumeric Parity)
      if (fn === 'MEDIAN' && argList.length > 0) {
        let vals = [];
        argList.forEach(a => {
          if (a.includes(':')) {
            const [s, e] = a.split(':');
            vals.push(...this.getRangeValues(s.trim(), e.trim()).filter(v => typeof v === 'number' && !isNaN(v)));
          } else {
            const v = Number(this.evalExpr(a));
            if (!isNaN(v)) vals.push(v);
          }
        });
        if (vals.length === 0) return 0;
        vals.sort((a, b) => a - b);
        const mid = Math.floor(vals.length / 2);
        return vals.length % 2 !== 0 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
      }

      if (fn === 'STDEV' && argList.length > 0) {
        let vals = [];
        argList.forEach(a => {
          if (a.includes(':')) {
            const [s, e] = a.split(':');
            vals.push(...this.getRangeValues(s.trim(), e.trim()).filter(v => typeof v === 'number' && !isNaN(v)));
          } else {
            const v = Number(this.evalExpr(a));
            if (!isNaN(v)) vals.push(v);
          }
        });
        if (vals.length <= 1) return 0;
        const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
        const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length - 1);
        return Math.sqrt(variance);
      }

      if (fn === 'CONCATENATE' || fn === 'CONCAT') {
        return argList.map(a => {
          if (a.includes(':')) {
            const [s, e] = a.split(':');
            return this.getRangeValues(s.trim(), e.trim()).join('');
          }
          return String(this.evalExpr(a));
        }).join('');
      }

      if (fn === 'SUBSTITUTE' && argList.length >= 3) {
        const text = String(this.evalExpr(argList[0]));
        const oldText = String(this.evalExpr(argList[1]));
        const newText = String(this.evalExpr(argList[2]));
        return text.split(oldText).join(newText);
      }

      if (fn === 'REPLACE' && argList.length === 4) {
        const text = String(this.evalExpr(argList[0]));
        const start = parseInt(this.evalExpr(argList[1])) - 1;
        const num = parseInt(this.evalExpr(argList[2]));
        const newText = String(this.evalExpr(argList[3]));
        return text.slice(0, start) + newText + text.slice(start + num);
      }

      if (fn === 'NPV' && argList.length >= 2) {
        const rate = Number(this.evalExpr(argList[0]));
        let cf = [];
        for (let i = 1; i < argList.length; i++) {
          if (argList[i].includes(':')) {
            const [s, e] = argList[i].split(':');
            cf.push(...this.getRangeValues(s.trim(), e.trim()).filter(v => typeof v === 'number'));
          } else {
            cf.push(Number(this.evalExpr(argList[i])));
          }
        }
        return cf.reduce((acc, val, idx) => acc + val / Math.pow(1 + rate, idx + 1), 0);
      }
    }

    return this.evalExpr(formula.trim());
  }

  // --- SVG Chart Generator (Bar, Line, Pie) ---
  generateSVGChart(type = 'bar', labelRange = 'A1:A5', dataRange = 'B1:B5', title = 'Spreadsheet Chart') {
    const parseR = (rStr) => {
      if (!rStr.includes(':')) return [];
      const [s, e] = rStr.split(':');
      return this.getRangeValues(s.trim(), e.trim());
    };
    const labels = parseR(labelRange).map(v => String(v));
    const data = parseR(dataRange).map(v => parseFloat(v) || 0);

    const width = 560, height = 320, padding = 45;
    const maxVal = Math.max(...data, 1);
    const colors = ['#81c784', '#4dabf7', '#ffb74d', '#ba68c8', '#4db6ac', '#f06292', '#aed581'];

    let inner = '';
    if (type === 'bar') {
      const barWidth = Math.max(12, Math.min(50, (width - padding * 2) / (data.length || 1) - 10));
      data.forEach((val, i) => {
        const x = padding + i * (barWidth + 10) + 10;
        const barH = (val / maxVal) * (height - padding * 2);
        const y = height - padding - barH;
        const color = colors[i % colors.length];
        inner += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" fill="${color}" rx="3"/>`;
        inner += `<text x="${x + barWidth / 2}" y="${y - 6}" font-size="10" fill="#cdd6f4" text-anchor="middle">${val}</text>`;
        inner += `<text x="${x + barWidth / 2}" y="${height - padding + 15}" font-size="10" fill="#a6adc8" text-anchor="middle">${labels[i] || ''}</text>`;
      });
      // Axis lines
      inner += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#45475a" stroke-width="1"/>`;
      inner += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#45475a" stroke-width="1"/>`;
    } else if (type === 'line') {
      let points = [];
      data.forEach((val, i) => {
        const x = padding + (i / Math.max(1, data.length - 1)) * (width - padding * 2);
        const y = height - padding - (val / maxVal) * (height - padding * 2);
        points.push(`${x},${y}`);
        inner += `<circle cx="${x}" cy="${y}" r="4" fill="#81c784"/>`;
        inner += `<text x="${x}" y="${y - 8}" font-size="10" fill="#cdd6f4" text-anchor="middle">${val}</text>`;
        inner += `<text x="${x}" y="${height - padding + 15}" font-size="10" fill="#a6adc8" text-anchor="middle">${labels[i] || ''}</text>`;
      });
      inner += `<polyline points="${points.join(' ')}" fill="none" stroke="#81c784" stroke-width="2"/>`;
      inner += `<line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#45475a" stroke-width="1"/>`;
      inner += `<line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#45475a" stroke-width="1"/>`;
    } else if (type === 'pie') {
      const cx = width / 2, cy = height / 2, r = Math.min(width, height) / 3;
      const total = data.reduce((a, b) => a + b, 0) || 1;
      let startAngle = 0;
      data.forEach((val, i) => {
        const sliceAngle = (val / total) * 2 * Math.PI;
        const endAngle = startAngle + sliceAngle;
        const x1 = cx + r * Math.cos(startAngle);
        const y1 = cy + r * Math.sin(startAngle);
        const x2 = cx + r * Math.cos(endAngle);
        const y2 = cy + r * Math.sin(endAngle);
        const largeArc = sliceAngle > Math.PI ? 1 : 0;
        const color = colors[i % colors.length];
        const pathData = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
        inner += `<path d="${pathData}" fill="${color}" stroke="#1e1e2e" stroke-width="1"/>`;
        startAngle = endAngle;
      });
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background:#181825; border-radius:8px;">
      <text x="${width / 2}" y="24" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="middle">${title}</text>
      ${inner}
    </svg>`;
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

  // --- Pivot Table Engine (Excel / LibreOffice Calc Parity) ---
  generatePivotTable(rangeStr = 'A1:C10', rowColOffset = 0, valColOffset = 2, aggFunc = 'SUM') {
    if (!rangeStr.includes(':')) return null;
    const [start, end] = rangeStr.split(':');
    const s = this.parseCoord(start.trim()), e = this.parseCoord(end.trim());
    if (!s || !e) return null;

    const minR = Math.min(s[0], e[0]), maxR = Math.max(s[0], e[0]);
    const minC = Math.min(s[1], e[1]), maxC = Math.max(s[1], e[1]);

    const groups = {};
    for (let r = minR; r <= maxR; r++) {
      const rowKey = String(this.getCellValue(`${this.colName(minC + rowColOffset)}${r}`) || '(blank)');
      const rawVal = parseFloat(this.getCellValue(`${this.colName(minC + valColOffset)}${r}`)) || 0;
      if (!groups[rowKey]) groups[rowKey] = [];
      groups[rowKey].push(rawVal);
    }

    const summary = [];
    for (const [key, numbers] of Object.entries(groups)) {
      let metric = 0;
      if (aggFunc === 'SUM') metric = numbers.reduce((a, b) => a + b, 0);
      else if (aggFunc === 'COUNT') metric = numbers.length;
      else if (aggFunc === 'AVERAGE' || aggFunc === 'AVG') metric = numbers.reduce((a, b) => a + b, 0) / (numbers.length || 1);
      else if (aggFunc === 'MIN') metric = Math.min(...numbers);
      else if (aggFunc === 'MAX') metric = Math.max(...numbers);
      summary.push({ key, metric: Math.round(metric * 100) / 100 });
    }

    // Auto-create a Pivot Sheet
    const pivotSheetName = `Pivot_${this.activeSheet}`;
    this.addSheet(pivotSheetName);
    this.setCellRaw('A1', 'Row Labels');
    this.setCellRaw('B1', `${aggFunc} of Value`);
    summary.forEach((item, idx) => {
      this.setCellRaw(`A${idx + 2}`, item.key);
      this.setCellRaw(`B${idx + 2}`, String(item.metric));
    });
    this.recalculateAll();
    window.sigmaApp && window.sigmaApp.showNotification(`Pivot table generated in '${pivotSheetName}'`, 'success');
    return summary;
  }

  // --- Conditional Formatting ---
  applyConditionalFormat(rangeStr, op = '>', threshold = 100, bgColor = '#1b3b22', textColor = '#81c784') {
    if (!rangeStr.includes(':')) return;
    const [start, end] = rangeStr.split(':');
    const s = this.parseCoord(start.trim()), e = this.parseCoord(end.trim());
    if (!s || !e) return;

    let matchCount = 0;
    for (let r = Math.min(s[0], e[0]); r <= Math.max(s[0], e[0]); r++) {
      for (let c = Math.min(s[1], e[1]); c <= Math.max(s[1], e[1]); c++) {
        const coord = `${this.colName(c)}${r}`;
        const val = this.getCellValue(coord);
        let match = false;
        const numVal = parseFloat(val);
        const targetNum = parseFloat(threshold);

        if (op === '>' && !isNaN(numVal) && !isNaN(targetNum)) match = numVal > targetNum;
        else if (op === '<' && !isNaN(numVal) && !isNaN(targetNum)) match = numVal < targetNum;
        else if (op === '=' && String(val).toLowerCase() === String(threshold).toLowerCase()) match = true;
        else if (op === 'CONTAINS' && String(val).toLowerCase().includes(String(threshold).toLowerCase())) match = true;

        if (match) {
          matchCount++;
          if (!this.cellFormats[coord]) this.cellFormats[coord] = {};
          this.cellFormats[coord].bgColor = bgColor;
          this.cellFormats[coord].textColor = textColor;
          const td = this.table.querySelector(`td[data-coord="${coord}"]`);
          if (td) {
            td.style.backgroundColor = bgColor;
            td.style.color = textColor;
          }
        }
      }
    }
    window.sigmaApp && window.sigmaApp.showNotification(`Conditional formatting applied to ${matchCount} cells`, 'info');
    this.triggerAutoSave();
  }

  clearConditionalFormats() {
    this.cellFormats = {};
    this.renderGrid();
    window.sigmaApp && window.sigmaApp.showNotification('Conditional formatting cleared', 'info');
  }

  // --- Range Sorting ---
  sortRange(rangeStr, colOffset = 0, ascending = true) {
    if (!rangeStr.includes(':')) return;
    const [start, end] = rangeStr.split(':');
    const s = this.parseCoord(start.trim()), e = this.parseCoord(end.trim());
    if (!s || !e) return;

    const minR = Math.min(s[0], e[0]), maxR = Math.max(s[0], e[0]);
    const minC = Math.min(s[1], e[1]), maxC = Math.max(s[1], e[1]);
    const targetCol = minC + colOffset;

    // Collect 2D rows
    const rows = [];
    for (let r = minR; r <= maxR; r++) {
      const rowData = [];
      for (let c = minC; c <= maxC; c++) {
        rowData.push(this.getCellValue(`${this.colName(c)}${r}`));
      }
      rows.push(rowData);
    }

    // Sort rows based on targetCol offset
    rows.sort((a, b) => {
      const va = a[colOffset], vb = b[colOffset];
      const na = parseFloat(va), nb = parseFloat(vb);
      let cmp = 0;
      if (!isNaN(na) && !isNaN(nb)) cmp = na - nb;
      else cmp = String(va).localeCompare(String(vb));
      return ascending ? cmp : -cmp;
    });

    // Write back sorted rows
    rows.forEach((rowData, rIdx) => {
      const r = minR + rIdx;
      rowData.forEach((val, cIdx) => {
        const coord = `${this.colName(minC + cIdx)}${r}`;
        this.setCellRaw(coord, String(val));
      });
    });

    this.recalculateAll();
    window.sigmaApp && window.sigmaApp.showNotification(`Range sorted ${ascending ? 'A-Z' : 'Z-A'}`, 'success');
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
