/**
 * SigmaOS Base Web (DataCraft / LibreOffice Base inspired).
 * Fully offline relational database, schema builder, SQL query engine & table viewer.
 * Principles: Zero Network Dependencies, Component Isolation, CQS, Safe Concurrency.
 */
class BaseWeb {
  constructor(containerElement) {
    this.container = containerElement;
    this.docId = 'db_' + Date.now();
    this.title = 'Untitled Database';
    this.tables = {
      users: {
        name: 'users',
        columns: [
          { name: 'id', type: 'INTEGER', primaryKey: true },
          { name: 'name', type: 'TEXT', primaryKey: false },
          { name: 'role', type: 'TEXT', primaryKey: false },
          { name: 'active', type: 'BOOLEAN', primaryKey: false }
        ],
        rows: [
          { id: 1, name: 'Alice Admin', role: 'DevOps', active: true },
          { id: 2, name: 'Bob Engineer', role: 'Kernel Dev', active: true },
          { id: 3, name: 'Charlie QA', role: 'Security', active: false }
        ]
      }
    };
    this.activeTable = 'users';
    this.filterColumn = '';
    this.filterOp = '=';
    this.filterValue = '';
    this.viewMode = 'grid'; // 'grid' | 'form' | 'sql'
    this.activeRecordIndex = 0;
    this.queryResults = null;
    this.sqlInputText = 'SELECT * FROM users WHERE active = true';
    this._saveTimer = null;
    this.render();
  }

  // --- Table Operations ---
  createTable(name, columns = null) {
    const tableName = (name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    if (!tableName) return;
    if (this.tables[tableName]) {
      window.sigmaApp && window.sigmaApp.showNotification('Table already exists', 'info');
      return;
    }
    this.tables[tableName] = {
      name: tableName,
      columns: columns || [
        { name: 'id', type: 'INTEGER', primaryKey: true },
        { name: 'item', type: 'TEXT', primaryKey: false },
        { name: 'value', type: 'REAL', primaryKey: false }
      ],
      rows: []
    };
    this.activeTable = tableName;
    this.render();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`Table '${tableName}' created`, 'success');
  }

  deleteTable(name) {
    if (Object.keys(this.tables).length <= 1) {
      window.sigmaApp && window.sigmaApp.showNotification('Cannot delete last table', 'info');
      return;
    }
    delete this.tables[name];
    if (this.activeTable === name) {
      this.activeTable = Object.keys(this.tables)[0];
    }
    this.render();
    this.triggerAutoSave();
  }

  addColumn(name, type = 'TEXT') {
    const colName = (name || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const table = this.tables[this.activeTable];
    if (!colName || !table) return;
    if (table.columns.some(c => c.name === colName)) return;
    table.columns.push({ name: colName, type: type.toUpperCase(), primaryKey: false });
    // Default value for existing rows
    table.rows.forEach(r => {
      r[colName] = type === 'INTEGER' || type === 'REAL' ? 0 : type === 'BOOLEAN' ? false : '';
    });
    this.render();
    this.triggerAutoSave();
  }

  insertRow(rowObj = null) {
    const table = this.tables[this.activeTable];
    if (!table) return;
    const newRow = rowObj || {};
    table.columns.forEach(col => {
      if (newRow[col.name] === undefined) {
        if (col.primaryKey) {
          const maxId = table.rows.reduce((m, r) => Math.max(m, parseInt(r[col.name]) || 0), 0);
          newRow[col.name] = maxId + 1;
        } else {
          newRow[col.name] = col.type === 'INTEGER' || col.type === 'REAL' ? 0 : col.type === 'BOOLEAN' ? true : '';
        }
      }
    });
    table.rows.push(newRow);
    this.render();
    this.triggerAutoSave();
  }

  deleteRow(index) {
    const table = this.tables[this.activeTable];
    if (!table || index < 0 || index >= table.rows.length) return;
    table.rows.splice(index, 1);
    this.render();
    this.triggerAutoSave();
  }

  updateCell(rowIndex, colName, value) {
    const table = this.tables[this.activeTable];
    if (!table || !table.rows[rowIndex]) return;
    const col = table.columns.find(c => c.name === colName);
    let parsedVal = value;
    if (col) {
      if (col.type === 'INTEGER') parsedVal = parseInt(value) || 0;
      else if (col.type === 'REAL') parsedVal = parseFloat(value) || 0.0;
      else if (col.type === 'BOOLEAN') parsedVal = String(value).toLowerCase() === 'true';
    }
    table.rows[rowIndex][colName] = parsedVal;
    this.triggerAutoSave();
  }

  // --- Query & Filtering ---
  getFilteredRows() {
    const table = this.tables[this.activeTable];
    if (!table) return [];
    if (!this.filterColumn || !this.filterValue) return table.rows;

    return table.rows.filter(r => {
      const v = r[this.filterColumn];
      const q = this.filterValue;
      if (this.filterOp === '=') return String(v).toLowerCase() === q.toLowerCase();
      if (this.filterOp === '!=') return String(v).toLowerCase() !== q.toLowerCase();
      if (this.filterOp === '>') return parseFloat(v) > parseFloat(q);
      if (this.filterOp === '<') return parseFloat(v) < parseFloat(q);
      if (this.filterOp === 'CONTAINS') return String(v).toLowerCase().includes(q.toLowerCase());
      if (this.filterOp === 'STARTS_WITH') return String(v).toLowerCase().startsWith(q.toLowerCase());
      return true;
    });
  }

  // --- Aggregates (Count, Sum, Avg, Min, Max) ---
  calculateAggregate(colName, func = 'SUM') {
    const rows = this.getFilteredRows();
    const nums = rows.map(r => parseFloat(r[colName])).filter(n => !isNaN(n));
    if (func === 'COUNT') return rows.length;
    if (nums.length === 0) return 0;
    if (func === 'SUM') return nums.reduce((a, b) => a + b, 0);
    if (func === 'AVG') return nums.reduce((a, b) => a + b, 0) / nums.length;
    if (func === 'MIN') return Math.min(...nums);
    if (func === 'MAX') return Math.max(...nums);
    return 0;
  }

  // --- Export & SQL Generation ---
  toSQL() {
    const table = this.tables[this.activeTable];
    if (!table) return '';
    let sql = `-- SigmaOS Base SQL Export: ${table.name}\n`;
    sql += `CREATE TABLE ${table.name} (\n`;
    const colDefs = table.columns.map(c => `  ${c.name} ${c.type}${c.primaryKey ? ' PRIMARY KEY' : ''}`);
    sql += colDefs.join(',\n') + '\n);\n\n';

    table.rows.forEach(r => {
      const vals = table.columns.map(c => {
        const v = r[c.name];
        if (c.type === 'TEXT' || c.type === 'DATE') return `'${String(v).replace(/'/g, "''")}'`;
        if (c.type === 'BOOLEAN') return v ? '1' : '0';
        return v !== undefined ? v : 'NULL';
      });
      sql += `INSERT INTO ${table.name} VALUES (${vals.join(', ')});\n`;
    });
    return sql;
  }

  toCSV() {
    const table = this.tables[this.activeTable];
    if (!table) return '';
    const headers = table.columns.map(c => `"${c.name}"`).join(',');
    const rows = table.rows.map(r => {
      return table.columns.map(c => `"${String(r[c.name] || '').replace(/"/g, '""')}"`).join(',');
    });
    return [headers, ...rows].join('\n');
  }

  toDataCraftJSON() {
    return JSON.stringify({
      format: 'SigmaOS.DataCraft',
      version: '1.0',
      title: this.title,
      tables: this.tables,
      activeTable: this.activeTable,
      updatedAt: Date.now()
    }, null, 2);
  }

  loadDataCraftJSON(jsonStr) {
    try {
      const data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (data.tables) {
        this.tables = data.tables;
        this.activeTable = data.activeTable || Object.keys(data.tables)[0];
        this.title = data.title || this.title;
        this.render();
      }
    } catch (e) {
      console.error('DataCraft parse error:', e);
    }
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'base',
          title: this.title,
          tables: this.tables,
          activeTable: this.activeTable,
          updatedAt: Date.now()
        });
      }
    }, 1500);
  }

  // --- View Mode & Navigation ---
  setViewMode(mode) {
    this.viewMode = mode;
    this.render();
  }

  firstRecord() {
    this.activeRecordIndex = 0;
    this.render();
  }

  prevRecord() {
    const table = this.tables[this.activeTable];
    if (!table) return;
    this.activeRecordIndex = Math.max(0, this.activeRecordIndex - 1);
    this.render();
  }

  nextRecord() {
    const table = this.tables[this.activeTable];
    if (!table) return;
    this.activeRecordIndex = Math.min(table.rows.length - 1, this.activeRecordIndex + 1);
    this.render();
  }

  lastRecord() {
    const table = this.tables[this.activeTable];
    if (!table) return;
    this.activeRecordIndex = Math.max(0, table.rows.length - 1);
    this.render();
  }

  // --- SQL Query Engine (LibreOffice Base / MS Access Parity) ---
  querySQL(sqlStr) {
    const raw = (sqlStr || this.sqlInputText || '').trim();
    this.sqlInputText = raw;
    if (!raw) return [];

    // Simple parser: SELECT [cols] FROM [table] [WHERE col op val] [ORDER BY col [ASC|DESC]] [LIMIT n]
    const selectMatch = raw.match(/SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+(.+?))?(?:\s+ORDER\s+BY\s+(.+?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (!selectMatch) {
      window.sigmaApp && window.sigmaApp.showNotification('SQL syntax error (Only SELECT is supported)', 'info');
      return [];
    }

    const [, colsPart, tableName, wherePart, orderPart, limitPart] = selectMatch;
    const table = this.tables[tableName.toLowerCase()];
    if (!table) {
      window.sigmaApp && window.sigmaApp.showNotification(`Table '${tableName}' not found`, 'info');
      return [];
    }

    let rows = [...table.rows];

    // Filter WHERE
    if (wherePart) {
      const wMatch = wherePart.match(/([a-zA-Z0-9_]+)\s*(=|!=|>|<|LIKE)\s*['"]?([^'"]+)['"]?/i);
      if (wMatch) {
        const [, col, op, val] = wMatch;
        rows = rows.filter(r => {
          const cv = r[col];
          if (op === '=') return String(cv).toLowerCase() === val.toLowerCase();
          if (op === '!=') return String(cv).toLowerCase() !== val.toLowerCase();
          if (op === '>') return parseFloat(cv) > parseFloat(val);
          if (op === '<') return parseFloat(cv) < parseFloat(val);
          if (op.toUpperCase() === 'LIKE') return String(cv).toLowerCase().includes(val.replace(/%/g, '').toLowerCase());
          return true;
        });
      }
    }

    // ORDER BY
    if (orderPart) {
      const [orderCol, dir] = orderPart.trim().split(/\s+/);
      const isDesc = dir && dir.toUpperCase() === 'DESC';
      rows.sort((a, b) => {
        const va = a[orderCol], vb = b[orderCol];
        const na = parseFloat(va), nb = parseFloat(vb);
        let cmp = 0;
        if (!isNaN(na) && !isNaN(nb)) cmp = na - nb;
        else cmp = String(va || '').localeCompare(String(vb || ''));
        return isDesc ? -cmp : cmp;
      });
    }

    // LIMIT
    if (limitPart) {
      rows = rows.slice(0, parseInt(limitPart));
    }

    // Projection
    let columns = table.columns.map(c => c.name);
    if (colsPart.trim() !== '*') {
      const reqCols = colsPart.split(',').map(c => c.trim());
      columns = reqCols;
      rows = rows.map(r => {
        const rowObj = {};
        reqCols.forEach(c => { rowObj[c] = r[c]; });
        return rowObj;
      });
    }

    this.queryResults = { columns, rows };
    this.render();
    window.sigmaApp && window.sigmaApp.showNotification(`Query returned ${rows.length} rows`, 'success');
    return rows;
  }

  exportQueryCSV() {
    if (!this.queryResults || !this.queryResults.rows.length) return;
    const { columns, rows } = this.queryResults;
    const header = columns.map(c => `"${c}"`).join(',');
    const body = rows.map(r => columns.map(c => `"${String(r[c] !== undefined ? r[c] : '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const csv = `${header}\n${body}`;
    if (window.storageEngine) {
      window.storageEngine.saveFileToDisk(csv, `query_result.csv`, 'text/csv');
      window.sigmaApp && window.sigmaApp.showNotification('Query CSV exported', 'success');
    }
  }

  // --- CSV Import ---
  importCSV(csvText, newTableName = 'imported_data') {
    if (!csvText || !csvText.trim()) return;
    const lines = csvText.trim().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length < 2) return;

    const parseLine = (line) => {
      const res = []; let inQ = false, cur = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
          if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
          else inQ = !inQ;
        } else if (c === ',' && !inQ) {
          res.push(cur.trim()); cur = '';
        } else { cur += c; }
      }
      res.push(cur.trim());
      return res;
    };

    const header = parseLine(lines[0]);
    const firstRow = parseLine(lines[1]);
    const columns = header.map((name, i) => {
      const cleanName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || `col_${i + 1}`;
      const sampleVal = firstRow[i] || '';
      let type = 'TEXT';
      if (/^-?\d+$/.test(sampleVal)) type = 'INTEGER';
      else if (/^-?\d+\.\d+$/.test(sampleVal)) type = 'REAL';
      else if (/^(true|false)$/i.test(sampleVal)) type = 'BOOLEAN';
      return { name: cleanName, type: type, primaryKey: i === 0 };
    });

    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]);
      const row = {};
      columns.forEach((col, cIdx) => {
        let rawVal = vals[cIdx] !== undefined ? vals[cIdx] : '';
        if (col.type === 'INTEGER') row[col.name] = parseInt(rawVal) || 0;
        else if (col.type === 'REAL') row[col.name] = parseFloat(rawVal) || 0.0;
        else if (col.type === 'BOOLEAN') row[col.name] = rawVal.toLowerCase() === 'true';
        else row[col.name] = rawVal;
      });
      rows.push(row);
    }

    const tName = newTableName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    this.tables[tName] = { name: tName, columns, rows };
    this.activeTable = tName;
    this.render();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`Imported ${rows.length} rows into '${tName}'`, 'success');
  }

  // --- UI Rendering ---
  render() {
    if (!this.container) return;
    const table = this.tables[this.activeTable];
    const tableNames = Object.keys(this.tables);
    const rows = this.getFilteredRows();

    // Guard activeRecordIndex
    if (table && table.rows.length > 0) {
      if (this.activeRecordIndex >= table.rows.length) this.activeRecordIndex = table.rows.length - 1;
      if (this.activeRecordIndex < 0) this.activeRecordIndex = 0;
    }

    let viewContent = '';
    if (this.viewMode === 'grid') {
      viewContent = `
        <!-- Filter & Search Bar -->
        <div class="base-filter-bar">
          <span style="font-size:12px; font-weight:700; color:var(--text-muted);">Filter:</span>
          <select id="base-filter-col" class="toolbar-select">
            <option value="">(All Columns)</option>
            ${table ? table.columns.map(c => `<option value="${c.name}" ${c.name === this.filterColumn ? 'selected' : ''}>${c.name}</option>`).join('') : ''}
          </select>
          <select id="base-filter-op" class="toolbar-select toolbar-select-sm">
            <option value="=" ${this.filterOp === '=' ? 'selected' : ''}>=</option>
            <option value="!=" ${this.filterOp === '!=' ? 'selected' : ''}>!=</option>
            <option value="CONTAINS" ${this.filterOp === 'CONTAINS' ? 'selected' : ''}>Contains</option>
            <option value=">" ${this.filterOp === '>' ? 'selected' : ''}>&gt;</option>
            <option value="<" ${this.filterOp === '<' ? 'selected' : ''}>&lt;</option>
          </select>
          <input id="base-filter-val" class="fr-input" placeholder="Query term…" value="${this._esc(this.filterValue)}">
          <button class="toolbar-btn" onclick="window.baseApp.applyFilter()">Apply</button>
          <button class="toolbar-btn" onclick="window.baseApp.clearFilter()">Clear</button>
          <span style="margin-left:auto; font-size:12px; color:var(--text-muted);">${rows.length} records</span>
        </div>

        <!-- Data Grid -->
        <div class="base-grid-wrap">
          <table class="base-table">
            <thead>
              <tr>
                <th style="width:40px; text-align:center;">#</th>
                ${table ? table.columns.map(c => `
                  <th>
                    <span>${c.name}</span>
                    <span class="col-type-tag">${c.type}</span>
                  </th>
                `).join('') : ''}
                <th style="width:50px;">Act</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((r, rIdx) => `
                <tr>
                  <td style="text-align:center; color:var(--text-muted); font-size:11px;">${rIdx + 1}</td>
                  ${table.columns.map(c => `
                    <td contenteditable="true" onblur="window.baseApp.updateCell(${rIdx}, '${c.name}', this.innerText.trim())">
                      ${this._esc(r[c.name] !== undefined ? r[c.name] : '')}
                    </td>
                  `).join('')}
                  <td>
                    <button class="btn-del-record" onclick="window.baseApp.deleteRow(${rIdx})" title="Delete record">🗑</button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else if (this.viewMode === 'form') {
      const activeRecord = table && table.rows[this.activeRecordIndex] ? table.rows[this.activeRecordIndex] : null;
      viewContent = `
        <div class="base-form-view-container">
          <div class="base-form-nav">
            <button class="toolbar-btn" onclick="window.baseApp.firstRecord()" title="First Record">⏮ First</button>
            <button class="toolbar-btn" onclick="window.baseApp.prevRecord()" title="Previous Record">◀ Prev</button>
            <span class="form-record-indicator">Record ${table && table.rows.length > 0 ? this.activeRecordIndex + 1 : 0} of ${table ? table.rows.length : 0}</span>
            <button class="toolbar-btn" onclick="window.baseApp.nextRecord()" title="Next Record">Next ▶</button>
            <button class="toolbar-btn" onclick="window.baseApp.lastRecord()" title="Last Record">Last ⏭</button>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn primary" onclick="window.baseApp.insertRow()" title="Add New Record">+ New Record</button>
            <button class="toolbar-btn" onclick="window.baseApp.deleteRow(window.baseApp.activeRecordIndex)" title="Delete This Record">🗑 Delete</button>
          </div>
          ${activeRecord ? `
            <div class="base-form-card">
              <h3 style="margin-bottom:14px; color:#81c784;">Record Details (${table.name})</h3>
              <div class="base-form-fields">
                ${table.columns.map(col => `
                  <div class="base-form-group">
                    <label class="base-form-label">${col.name} <span class="col-type-tag">${col.type}</span>${col.primaryKey ? ' 🔑' : ''}</label>
                    <input class="base-form-input" value="${this._esc(activeRecord[col.name] !== undefined ? activeRecord[col.name] : '')}"
                      onchange="window.baseApp.updateCell(${this.activeRecordIndex}, '${col.name}', this.value)">
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `<div style="padding:40px; text-align:center; color:var(--text-muted);">No records in table. Click '+ New Record' to add one.</div>`}
        </div>
      `;
    } else if (this.viewMode === 'sql') {
      const qCols = this.queryResults ? this.queryResults.columns : [];
      const qRows = this.queryResults ? this.queryResults.rows : [];
      viewContent = `
        <div class="base-sql-container">
          <div class="base-sql-editor-box">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
              <strong style="color:#81c784; font-size:13px;">SQL Query Console</strong>
              <div>
                <button class="toolbar-btn primary" onclick="window.baseApp.querySQL(document.getElementById('base-sql-input').value)">▶ Run SQL</button>
                <button class="toolbar-btn" onclick="window.baseApp.exportQueryCSV()">Export CSV</button>
              </div>
            </div>
            <textarea id="base-sql-input" class="base-sql-textarea" rows="3" spellcheck="false">${this._esc(this.sqlInputText)}</textarea>
          </div>
          <div class="base-sql-results">
            <h4 style="margin:8px 0; color:var(--text-muted); font-size:13px;">Results (${qRows.length} rows)</h4>
            ${qRows.length > 0 ? `
              <div class="base-grid-wrap">
                <table class="base-table">
                  <thead>
                    <tr>${qCols.map(c => `<th>${c}</th>`).join('')}</tr>
                  </thead>
                  <tbody>
                    ${qRows.map(r => `
                      <tr>${qCols.map(c => `<td>${this._esc(r[c] !== undefined ? r[c] : '')}</td>`).join('')}</tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `<div style="padding:20px; color:var(--text-muted); font-size:13px;">Execute a SELECT query above to view results.</div>`}
          </div>
        </div>
      `;
    } else if (this.viewMode === 'relations') {
      // Visual ER / Table Relationships Diagram (MS Access inspired)
      viewContent = `
        <div class="base-relations-container" style="flex:1; padding:20px; overflow:auto; background:var(--bg-dark);">
          <div style="margin-bottom:14px; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="color:#81c784; font-size:15px;">🔗 Visual Schema Relationships (ER Diagram)</h3>
            <span style="font-size:12px; color:var(--text-muted);">${tableNames.length} tables in database</span>
          </div>
          <div class="base-relations-grid" style="display:flex; flex-wrap:wrap; gap:20px;">
            ${tableNames.map(tName => {
              const tbl = this.tables[tName];
              return `
                <div class="base-relation-card" style="width:240px; background:var(--bg-panel); border:1px solid var(--border-color); border-radius:6px; overflow:hidden; box-shadow:0 4px 12px rgba(0,0,0,0.3);">
                  <div style="background:#2e7d32; color:#ffffff; padding:8px 12px; font-weight:700; font-size:13px;">📁 ${tbl.name}</div>
                  <div style="padding:8px 12px;">
                    ${tbl.columns.map(c => `
                      <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #282838; font-size:12px;">
                        <span>${c.primaryKey ? '🔑 ' : '• '}${c.name}</span>
                        <span style="color:#81c784; font-size:10px; font-family:monospace;">${c.type}</span>
                      </div>
                    `).join('')}
                  </div>
                  <div style="background:var(--bg-sidebar); padding:6px 12px; font-size:11px; color:var(--text-muted); text-align:right;">${tbl.rows.length} records</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (this.viewMode === 'report') {
      // Printable Executive Summary Report (MS Access / Odoo Report inspired)
      const numCols = table ? table.columns.filter(c => c.type === 'INTEGER' || c.type === 'REAL') : [];
      viewContent = `
        <div class="base-report-container" style="flex:1; padding:24px; overflow:auto; background:#ffffff; color:#11111b;">
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #2e7d32; padding-bottom:12px; margin-bottom:20px;">
            <div>
              <h2 style="color:#2e7d32; font-size:20px; margin:0;">SigmaOS Executive Table Report</h2>
              <div style="font-size:13px; color:#555;">Table: <strong>${table ? table.name : ''}</strong> · Generated: ${new Date().toLocaleString()}</div>
            </div>
            <button class="toolbar-btn primary" onclick="window.print()">🖨️ Print Report</button>
          </div>
          <div style="display:flex; gap:16px; margin-bottom:20px;">
            <div style="flex:1; background:#f4fbf4; border:1px solid #c8e6c9; border-radius:6px; padding:12px; text-align:center;">
              <div style="font-size:12px; color:#555;">Total Records</div>
              <div style="font-size:24px; font-weight:bold; color:#2e7d32;">${table ? table.rows.length : 0}</div>
            </div>
            <div style="flex:1; background:#f4fbf4; border:1px solid #c8e6c9; border-radius:6px; padding:12px; text-align:center;">
              <div style="font-size:12px; color:#555;">Columns</div>
              <div style="font-size:24px; font-weight:bold; color:#2e7d32;">${table ? table.columns.length : 0}</div>
            </div>
            ${numCols.slice(0, 2).map(c => `
              <div style="flex:1; background:#f4fbf4; border:1px solid #c8e6c9; border-radius:6px; padding:12px; text-align:center;">
                <div style="font-size:12px; color:#555;">Sum of ${c.name}</div>
                <div style="font-size:24px; font-weight:bold; color:#2e7d32;">${Math.round(this.calculateAggregate(c.name, 'SUM') * 100) / 100}</div>
              </div>
            `).join('')}
          </div>
          <table style="width:100%; border-collapse:collapse; margin-top:12px; font-size:13px;">
            <thead>
              <tr style="background:#2e7d32; color:#ffffff;">
                <th style="padding:8px; border:1px solid #ccc; text-align:left;">#</th>
                ${table ? table.columns.map(c => `<th style="padding:8px; border:1px solid #ccc; text-align:left;">${c.name}</th>`).join('') : ''}
              </tr>
            </thead>
            <tbody>
              ${rows.slice(0, 50).map((r, rIdx) => `
                <tr style="border-bottom:1px solid #eee;">
                  <td style="padding:6px 8px; border:1px solid #ddd; color:#888;">${rIdx + 1}</td>
                  ${table.columns.map(c => `<td style="padding:6px 8px; border:1px solid #ddd;">${this._esc(r[c.name] !== undefined ? r[c.name] : '')}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    let html = `
      <div class="base-container">
        <!-- Tables Ribbon -->
        <div class="base-ribbon">
          <div class="base-tables-list">
            ${tableNames.map(t => `
              <button class="base-table-btn ${t === this.activeTable ? 'active' : ''}" onclick="window.baseApp.switchTable('${t}')">
                📁 ${t}
              </button>
            `).join('')}
            <button class="base-table-btn new-table" onclick="window.baseApp.promptNewTable()">+ Table</button>
          </div>
          <div class="base-actions">
            <div class="base-mode-toggle">
              <button class="toolbar-btn ${this.viewMode === 'grid' ? 'primary' : ''}" onclick="window.baseApp.setViewMode('grid')" title="Table Grid View">📊 Grid</button>
              <button class="toolbar-btn ${this.viewMode === 'form' ? 'primary' : ''}" onclick="window.baseApp.setViewMode('form')" title="Single Record Form View">📝 Form</button>
              <button class="toolbar-btn ${this.viewMode === 'sql' ? 'primary' : ''}" onclick="window.baseApp.setViewMode('sql')" title="SQL Query Console">🔍 SQL</button>
              <button class="toolbar-btn ${this.viewMode === 'relations' ? 'primary' : ''}" onclick="window.baseApp.setViewMode('relations')" title="Visual Relationships Diagram">🔗 Relations</button>
              <button class="toolbar-btn ${this.viewMode === 'report' ? 'primary' : ''}" onclick="window.baseApp.setViewMode('report')" title="Executive Summary Report">📄 Report</button>
            </div>
            <div class="toolbar-divider"></div>
            <button class="toolbar-btn" onclick="window.baseApp.promptNewColumn()">+ Column</button>
            <button class="toolbar-btn primary" onclick="window.baseApp.insertRow()">+ Add Record</button>
            <button class="toolbar-btn" onclick="window.baseApp.promptImportCSV()">Import CSV</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportSQL()">Export .sql</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportCSV()">Export .csv</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportDBCF()">Save .dbcf</button>
          </div>
        </div>
        ${viewContent}
      </div>
    `;

    this.container.innerHTML = html;
  }

  promptImportCSV() {
    const csv = prompt('Paste RFC 4180 CSV contents here:');
    if (csv) {
      const name = prompt('New Table Name:', 'imported_table') || 'imported_table';
      this.importCSV(csv, name);
    }
  }

  switchTable(name) {
    if (this.tables[name]) {
      this.activeTable = name;
      this.activeRecordIndex = 0;
      this.filterColumn = '';
      this.filterValue = '';
      this.render();
    }
  }

  promptNewTable() {
    const name = prompt('Table name:');
    if (name) this.createTable(name);
  }

  promptNewColumn() {
    const name = prompt('Column name:');
    if (!name) return;
    const type = prompt('Type (TEXT, INTEGER, REAL, BOOLEAN, DATE):', 'TEXT');
    this.addColumn(name, type || 'TEXT');
  }

  applyFilter() {
    const col = document.getElementById('base-filter-col')?.value;
    const op = document.getElementById('base-filter-op')?.value;
    const val = document.getElementById('base-filter-val')?.value;
    this.filterColumn = col || '';
    this.filterOp = op || '=';
    this.filterValue = val || '';
    this.render();
  }

  clearFilter() {
    this.filterColumn = '';
    this.filterValue = '';
    this.render();
  }

  exportSQL() {
    const sql = this.toSQL();
    if (window.storageEngine) {
      window.storageEngine.saveFileToDisk(sql, `${this.activeTable}.sql`, 'application/sql');
      window.sigmaApp && window.sigmaApp.showNotification('SQL export saved', 'success');
    }
  }

  exportCSV() {
    const csv = this.toCSV();
    if (window.storageEngine) {
      window.storageEngine.saveFileToDisk(csv, `${this.activeTable}.csv`, 'text/csv');
      window.sigmaApp && window.sigmaApp.showNotification('CSV export saved', 'success');
    }
  }

  exportDBCF() {
    const json = this.toDataCraftJSON();
    if (window.storageEngine) {
      window.storageEngine.saveFileToDisk(json, `${this.title || 'database'}.dbcf`, 'application/json');
      window.sigmaApp && window.sigmaApp.showNotification('DataCraft .dbcf saved', 'success');
    }
  }

  _esc(str) {
    return String(str === null || str === undefined ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }
}

window.BaseWeb = BaseWeb;
