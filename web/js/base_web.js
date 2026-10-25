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

  // --- UI Rendering ---
  render() {
    if (!this.container) return;
    const table = this.tables[this.activeTable];
    const tableNames = Object.keys(this.tables);
    const rows = this.getFilteredRows();

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
            <button class="toolbar-btn" onclick="window.baseApp.promptNewColumn()">+ Column</button>
            <button class="toolbar-btn primary" onclick="window.baseApp.insertRow()">+ Add Record</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportSQL()">Export .sql</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportCSV()">Export .csv</button>
            <button class="toolbar-btn" onclick="window.baseApp.exportDBCF()">Save .dbcf</button>
          </div>
        </div>

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
      </div>
    `;

    this.container.innerHTML = html;
  }

  switchTable(name) {
    if (this.tables[name]) {
      this.activeTable = name;
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
