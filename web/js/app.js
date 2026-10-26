/**
 * SigmaOS Office Shell Application Controller.
 * Inspired by: OnlyOffice portal shell, LibreOffice Start Center, Collabora Online.
 * Features: command palette (Ctrl+K), toast notifications, theme toggle (dark/light),
 *           keyboard shortcut help modal (?), auto-detected file-type open,
 *           multi-format export, print support, IndexedDB recent docs.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Register Service Worker for Offline PWA
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('SigmaOS Office ServiceWorker registered:', reg.scope);
    } catch (err) {
      console.warn('ServiceWorker registration error:', err);
    }
  }

  // 2. Initialize Storage Engine
  if (window.storageEngine) {
    await window.storageEngine.init();
    refreshDocumentList();
  }

  // 3. Network status indicator
  const statusEl = document.getElementById('offline-status');
  const updateOnlineStatus = () => {
    if (!statusEl) return;
    if (navigator.onLine) {
      statusEl.innerText = 'ONLINE (Cached)';
      statusEl.className = 'status-badge online';
    } else {
      statusEl.innerText = 'OFFLINE MODE';
      statusEl.className = 'status-badge offline';
    }
  };
  window.addEventListener('online',  updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // 4. Initialize Sub-Engines
  window.writerApp  = new WriterWeb(document.getElementById('writer-editor'), {});
  window.calcApp    = new CalcWeb(
    document.getElementById('calc-grid'),
    document.getElementById('calc-formula-bar'),
    document.getElementById('calc-active-cell')
  );
  window.impressApp = new ImpressWeb(
    document.getElementById('impress-thumbnails'),
    document.getElementById('impress-stage'),
    document.getElementById('impress-notes')
  );
  window.drawApp    = new DrawWeb(document.getElementById('draw-canvas'));
  window.mathApp    = new MathWeb(
    document.getElementById('math-latex-input'),
    document.getElementById('math-preview')
  );
  window.baseApp    = new BaseWeb(document.getElementById('base-container'));

  // 5. Tab Switching
  const tabs   = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.app-panel');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const activePanel = document.getElementById(tab.dataset.target);
      if (activePanel) activePanel.classList.add('active');
      if (tab.dataset.target === 'panel-storage') refreshDocumentList();
    });
  });

  // 6. Toast notifications (OnlyOffice-inspired)
  window.sigmaApp = {
    showNotification(message, type = 'info') {
      const container = document.getElementById('toast-container');
      if (!container) return;
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      container.appendChild(toast);
      setTimeout(() => toast.classList.add('visible'), 10);
      setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => container.removeChild(toast), 300);
      }, 3000);
    }
  };

  // 7. Theme toggle (dark ↔ light)
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    let isDark = true;
    themeBtn.addEventListener('click', () => {
      isDark = !isDark;
      document.body.dataset.theme = isDark ? 'dark' : 'light';
      themeBtn.textContent = isDark ? '🌙' : '☀️';
      window.sigmaApp.showNotification(isDark ? 'Dark theme' : 'Light theme', 'info');
    });
  }

  // 8. Command palette (Ctrl+K)
  const cmdPalette  = document.getElementById('command-palette');
  const cmdInput    = document.getElementById('cmd-input');
  const cmdResults  = document.getElementById('cmd-results');

  const COMMANDS = [
    { label: 'Writer – New Document',   action: () => { window.writerApp.clearDocument(); switchTab('panel-writer'); } },
    { label: 'Writer – Split Markdown', action: () => { switchTab('panel-writer'); window.writerApp.toggleSplitView(); } },
    { label: 'Writer – Generate TOC',   action: () => { switchTab('panel-writer'); window.writerApp.generateTOC(); } },
    { label: 'Writer – Insert Callout', action: () => { switchTab('panel-writer'); window.writerApp.insertCallout('NOTE'); } },
    { label: 'Writer – Insert Code',    action: () => { switchTab('panel-writer'); window.writerApp.insertCodeBlock(); } },
    { label: 'Calc – New Spreadsheet',  action: () => { switchTab('panel-calc'); } },
    { label: 'Calc – Generate Chart',   action: () => { switchTab('panel-calc'); showChartModal(); } },
    { label: 'Calc – Pivot Table',      action: () => { switchTab('panel-calc'); showPivotModal(); } },
    { label: 'Calc – Sort Ascending',   action: () => { switchTab('panel-calc'); window.calcApp.sortRange('A1:C10', 0, true); } },
    { label: 'Calc – Sort Descending',  action: () => { switchTab('panel-calc'); window.calcApp.sortRange('A1:C10', 0, false); } },
    { label: 'Impress – Add Slide',     action: () => { switchTab('panel-impress'); window.impressApp.addSlide(); } },
    { label: 'Impress – Presenter View',action: () => { switchTab('panel-impress'); window.impressApp.startPresenterMode(); } },
    { label: 'Draw – Sticky Note',      action: () => { switchTab('panel-draw'); window.drawApp.setTool('sticky'); } },
    { label: 'Draw – Highlighter',      action: () => { switchTab('panel-draw'); window.drawApp.setTool('highlighter'); } },
    { label: 'Draw – Smart Connector',  action: () => { switchTab('panel-draw'); window.drawApp.setTool('connector'); } },
    { label: 'Draw – Clear Canvas',     action: () => { switchTab('panel-draw'); window.drawApp.clearCanvas(); } },
    { label: 'Draw – Copy to Clipboard',action: () => { switchTab('panel-draw'); window.drawApp.copyToClipboard(); } },
    { label: 'Math – Copy MathML',      action: () => { switchTab('panel-math'); window.mathApp.copyMathML(); } },
    { label: 'Math – Insert in Writer', action: () => { window.mathApp.insertIntoWriter(); } },
    { label: 'Base – Open Database',    action: () => switchTab('panel-base') },
    { label: 'Base – Form View',        action: () => { switchTab('panel-base'); window.baseApp.setViewMode('form'); } },
    { label: 'Base – SQL Console',      action: () => { switchTab('panel-base'); window.baseApp.setViewMode('sql'); } },
    { label: 'Base – Add Record',       action: () => { switchTab('panel-base'); window.baseApp.insertRow(); } },
    { label: 'Workspace – Full Backup', action: () => backupWorkspace() },
    { label: 'Open Documents',          action: () => switchTab('panel-storage') },
    { label: 'Print Writer Document',   action: () => window.writerApp.print() },
    { label: 'Export Writer HTML',      action: () => { const h = window.writerApp.toHTML(); window.storageEngine.saveFileToDisk(h, 'document.html', 'text/html'); } },
    { label: 'Export Impress HTML',     action: () => { const h = window.impressApp.exportToHTML(); window.storageEngine.saveFileToDisk(h, 'presentation.html', 'text/html'); } },
    { label: 'Export Draw PNG',         action: () => window.drawApp.exportPNG() },
    { label: 'Toggle Grid Snap (Draw)', action: () => window.drawApp.toggleGrid() },
    { label: 'Undo (Draw)',             action: () => window.drawApp.undo() },
    { label: 'Redo (Draw)',             action: () => window.drawApp.redo() },
    { label: 'Find & Replace (Writer)', action: () => window.writerApp.toggleFindReplace() },
    { label: 'Add Sheet (Calc)',        action: () => window.calcApp.addSheet() },
    { label: 'Copy Math Formula',       action: () => window.mathApp.copyToClipboard() },
    { label: 'Keyboard Shortcuts Help', action: showShortcutHelp },
    { label: 'Toggle Dark/Light Theme', action: () => themeBtn && themeBtn.click() },
  ];

  function switchTab(panelId) {
    const tab = document.querySelector(`.nav-tab[data-target="${panelId}"]`);
    if (tab) tab.click();
  }

  if (cmdPalette && cmdInput && cmdResults) {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        cmdPalette.style.display = 'flex';
        cmdInput.value = '';
        cmdInput.focus();
        renderCmdResults('');
      }
      if (e.key === 'Escape' && cmdPalette.style.display !== 'none') {
        cmdPalette.style.display = 'none';
      }
      if (e.key === '?' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        showShortcutHelp();
      }
    });
    cmdPalette.addEventListener('click', (e) => { if (e.target === cmdPalette) cmdPalette.style.display = 'none'; });
    cmdInput.addEventListener('input', (e) => renderCmdResults(e.target.value));
  }

  function renderCmdResults(query) {
    if (!cmdResults) return;
    const q = query.toLowerCase();
    const filtered = q ? COMMANDS.filter(c => c.label.toLowerCase().includes(q)) : COMMANDS;
    cmdResults.innerHTML = '';
    filtered.slice(0, 8).forEach(cmd => {
      const btn = document.createElement('button');
      btn.className = 'cmd-result-btn';
      btn.textContent = cmd.label;
      btn.onclick = () => { cmd.action(); cmdPalette.style.display = 'none'; };
      cmdResults.appendChild(btn);
    });
    if (filtered.length === 0) {
      cmdResults.innerHTML = '<div class="cmd-no-result">No commands found</div>';
    }
  }

  // 9. Keyboard shortcut modal
  function showShortcutHelp() {
    const modal = document.getElementById('shortcut-modal');
    if (modal) modal.style.display = 'flex';
  }
  document.getElementById('shortcut-modal')?.addEventListener('click', (e) => {
    if (e.target === document.getElementById('shortcut-modal')) {
      document.getElementById('shortcut-modal').style.display = 'none';
    }
  });

  // 10. Export / Import handlers
  document.getElementById('btn-export-writer-wcf')?.addEventListener('click', () => {
    const json = window.writerApp.toWordCraftJSON();
    window.storageEngine.saveFileToDisk(json, 'document.wcf', 'application/json');
    window.sigmaApp.showNotification('Saved as .wcf', 'success');
  });

  document.getElementById('btn-export-writer-md')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.writerApp.toMarkdown(), 'document.md', 'text/markdown');
    window.sigmaApp.showNotification('Exported as Markdown', 'success');
  });

  document.getElementById('btn-export-writer-html')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.writerApp.toHTML(), 'document.html', 'text/html');
    window.sigmaApp.showNotification('Exported as HTML', 'success');
  });

  document.getElementById('btn-print-writer')?.addEventListener('click', () => window.writerApp.print());

  document.getElementById('btn-writer-find-replace')?.addEventListener('click', () => window.writerApp.toggleFindReplace());

  // Find/Replace panel controls
  document.getElementById('btn-fr-replace')?.addEventListener('click', () => {
    const f = document.getElementById('fr-find-input')?.value || '';
    const r = document.getElementById('fr-replace-input')?.value || '';
    const n = window.writerApp.findReplace(f, r, false);
    window.sigmaApp.showNotification(`Replaced 1 occurrence`, 'info');
  });
  document.getElementById('btn-fr-replace-all')?.addEventListener('click', () => {
    const f = document.getElementById('fr-find-input')?.value || '';
    const r = document.getElementById('fr-replace-input')?.value || '';
    const n = window.writerApp.findReplace(f, r, true);
    window.sigmaApp.showNotification(`Replaced occurrences`, 'info');
  });

  // Insert Link
  document.getElementById('btn-insert-link')?.addEventListener('click', () => {
    const url  = prompt('URL:', 'https://');
    const text = prompt('Link text (leave blank to use URL):', '');
    if (url) { window.writerApp.insertLink(url, text || url); }
  });

  // Insert Image
  document.getElementById('btn-insert-image')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => window.writerApp.insertImage(ev.target.result);
      reader.readAsDataURL(file);
    };
    input.click();
  });

  document.getElementById('btn-export-calc-csv')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.calcApp.toCSV(), 'sheet.csv', 'text/csv');
    window.sigmaApp.showNotification('Exported as CSV', 'success');
  });

  document.getElementById('btn-export-calc-gcf')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.calcApp.toGridCraftJSON(), 'sheet.gcf', 'application/json');
    window.sigmaApp.showNotification('Saved as .gcf', 'success');
  });

  document.getElementById('btn-export-impress-dcf')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.impressApp.toDeckCraftJSON(), 'presentation.dcf', 'application/json');
    window.sigmaApp.showNotification('Saved as .dcf', 'success');
  });

  document.getElementById('btn-export-impress-html')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.impressApp.exportToHTML(), 'presentation.html', 'text/html');
    window.sigmaApp.showNotification('Exported as HTML', 'success');
  });

  document.getElementById('btn-export-draw-svg')?.addEventListener('click', () => {
    window.storageEngine.saveFileToDisk(window.drawApp.exportSVG(), 'drawing.svg', 'image/svg+xml');
    window.sigmaApp.showNotification('Exported as SVG', 'success');
  });

  document.getElementById('btn-export-draw-png')?.addEventListener('click', () => {
    window.drawApp.exportPNG();
  });

  document.getElementById('btn-draw-undo')?.addEventListener('click', () => window.drawApp.undo());
  document.getElementById('btn-draw-redo')?.addEventListener('click', () => window.drawApp.redo());
  document.getElementById('btn-draw-delete')?.addEventListener('click', () => window.drawApp.deleteSelected());
  document.getElementById('btn-draw-duplicate')?.addEventListener('click', () => window.drawApp.duplicate());
  document.getElementById('btn-draw-front')?.addEventListener('click', () => window.drawApp.bringToFront());
  document.getElementById('btn-draw-back')?.addEventListener('click', () => window.drawApp.sendToBack());
  document.getElementById('btn-draw-grid')?.addEventListener('click', () => {
    window.drawApp.toggleGrid();
    window.sigmaApp.showNotification('Grid snap ' + (window.drawApp.gridSnap ? 'ON' : 'OFF'), 'info');
  });

  // Draw color pickers
  document.getElementById('draw-stroke-color')?.addEventListener('input', (e) => window.drawApp.setStrokeColor(e.target.value));
  document.getElementById('draw-fill-color')?.addEventListener('input',   (e) => window.drawApp.setFillColor(e.target.value));
  document.getElementById('draw-stroke-width')?.addEventListener('input', (e) => {
    window.drawApp.setStrokeWidth(e.target.value);
    const label = document.getElementById('draw-width-label');
    if (label) label.textContent = e.target.value + 'px';
  });

  // Writer font controls
  document.getElementById('writer-font-family')?.addEventListener('change', (e) => window.writerApp.setFontFamily(e.target.value));
  document.getElementById('writer-font-size')?.addEventListener('change',   (e) => window.writerApp.setFontSize(e.target.value));
  document.getElementById('writer-text-color')?.addEventListener('input',   (e) => window.writerApp.setTextColor(e.target.value));
  document.getElementById('writer-highlight-color')?.addEventListener('input', (e) => window.writerApp.setHighlight(e.target.value));

  // Impress slide background
  document.getElementById('impress-slide-bg')?.addEventListener('input', (e) => {
    window.impressApp.setSlideBackground(window.impressApp.activeSlideIdx, e.target.value);
  });

  // 11. Open file from disk (auto-detect by extension)
  document.getElementById('btn-open-file')?.addEventListener('click', async () => {
    const file = await window.storageEngine.pickAndOpenFile();
    if (!file) return;
    const name = file.name.toLowerCase();
    if      (name.endsWith('.wcf'))  { const d = JSON.parse(file.content); window.writerApp.loadDocumentObject(d); switchTab('panel-writer'); }
    else if (name.endsWith('.md') || name.endsWith('.txt') || name.endsWith('.html')) {
                                      window.writerApp.loadDocumentObject({ title: file.name, htmlContent: file.content }); switchTab('panel-writer'); }
    else if (name.endsWith('.csv'))  { window.calcApp.fromCSV(file.content); switchTab('panel-calc'); }
    else if (name.endsWith('.gcf'))  { const d = JSON.parse(file.content); window.calcApp.sheets = d.sheets || { Sheet1: d.cells || {} }; window.calcApp.recalculateAll(); switchTab('panel-calc'); }
    else if (name.endsWith('.dcf'))  { const d = JSON.parse(file.content); window.impressApp.slides = d.slides || []; window.impressApp.renderThumbnails(); window.impressApp.renderActiveSlide(); switchTab('panel-impress'); }
    else if (name.endsWith('.svg'))  { window.drawApp.svg.innerHTML = file.content; window.drawApp._syncShapes(); switchTab('panel-draw'); }
    else if (name.endsWith('.vcf'))  { window.drawApp.fromVectorCraftJSON(file.content); switchTab('panel-draw'); }
    else if (name.endsWith('.dbcf') || name.endsWith('.sql')) { window.baseApp.loadDataCraftJSON(file.content); switchTab('panel-base'); }
    else { window.writerApp.loadDocumentObject({ title: file.name, htmlContent: `<p>${file.content}</p>` }); switchTab('panel-writer'); }
    window.sigmaApp.showNotification('File opened: ' + file.name, 'success');
  });

  // Chart Generator Modal
  function showChartModal() {
    const type = prompt('Chart type (bar, line, pie):', 'bar') || 'bar';
    const lRange = prompt('Label range (e.g. A1:A5):', 'A1:A5') || 'A1:A5';
    const dRange = prompt('Data range (e.g. B1:B5):', 'B1:B5') || 'B1:B5';
    const svgChart = window.calcApp.generateSVGChart(type, lRange, dRange, 'SigmaOS Chart');

    const modal = document.getElementById('chart-modal');
    const container = document.getElementById('chart-preview-container');
    if (modal && container) {
      container.innerHTML = svgChart;
      modal.style.display = 'flex';
    }
  }

  document.getElementById('btn-calc-chart')?.addEventListener('click', showChartModal);

  // Pivot Modal & Generation
  function showPivotModal() {
    const modal = document.getElementById('pivot-modal');
    if (modal) modal.style.display = 'flex';
  }
  document.getElementById('btn-calc-pivot')?.addEventListener('click', showPivotModal);
  document.getElementById('btn-pivot-generate')?.addEventListener('click', () => {
    const r = document.getElementById('pivot-range')?.value || 'A1:C10';
    const rowOffset = parseInt(document.getElementById('pivot-row-offset')?.value || '0');
    const valOffset = parseInt(document.getElementById('pivot-val-offset')?.value || '2');
    const agg = document.getElementById('pivot-agg-func')?.value || 'SUM';
    window.calcApp.generatePivotTable(r, rowOffset, valOffset, agg);
    document.getElementById('pivot-modal').style.display = 'none';
  });

  // Range Sorting & Conditional Formatting
  document.getElementById('btn-calc-sort-asc')?.addEventListener('click', () => {
    const r = prompt('Range to sort (e.g. A1:C10):', 'A1:C10');
    if (r) window.calcApp.sortRange(r, 0, true);
  });
  document.getElementById('btn-calc-sort-desc')?.addEventListener('click', () => {
    const r = prompt('Range to sort (e.g. A1:C10):', 'A1:C10');
    if (r) window.calcApp.sortRange(r, 0, false);
  });
  document.getElementById('btn-calc-cond-fmt')?.addEventListener('click', () => {
    const r = prompt('Target range (e.g. B1:B10):', 'B1:B10');
    if (!r) return;
    const op = prompt('Condition operator (>, <, =, CONTAINS):', '>') || '>';
    const val = prompt('Threshold value:', '100') || '100';
    window.calcApp.applyConditionalFormat(r, op, val);
  });

  // Workspace Backup & Restore
  async function backupWorkspace() {
    if (!window.storageEngine) return;
    const bundle = await window.storageEngine.exportWorkspaceBundle();
    window.storageEngine.saveFileToDisk(bundle, 'sigmaos-workspace-backup.json', 'application/json');
    window.sigmaApp.showNotification('Workspace backup exported', 'success');
  }

  async function restoreWorkspace() {
    if (!window.storageEngine) return;
    const file = await window.storageEngine.pickAndOpenFile();
    if (!file) return;
    const ok = await window.storageEngine.importWorkspaceBundle(file.content);
    if (ok) {
      window.sigmaApp.showNotification('Workspace restored successfully!', 'success');
      refreshDocumentList();
    } else {
      window.sigmaApp.showNotification('Failed to restore workspace', 'info');
    }
  }

  document.getElementById('btn-backup-workspace')?.addEventListener('click', backupWorkspace);
  document.getElementById('btn-restore-workspace')?.addEventListener('click', restoreWorkspace);

  // 12. Documents panel
  async function refreshDocumentList() {
    const listEl = document.getElementById('doc-list-body');
    if (!listEl || !window.storageEngine) return;
    const docs = await window.storageEngine.listDocuments();
    listEl.innerHTML = '';
    if (docs.length === 0) {
      listEl.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">No saved documents. Files are stored locally in IndexedDB — no cloud required.</td></tr>';
      return;
    }
    docs.forEach(doc => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${doc.title || 'Untitled'}</strong></td>
        <td><span class="type-tag ${doc.type}">${(doc.type || 'doc').toUpperCase()}</span></td>
        <td>${new Date(doc.updatedAt).toLocaleString()}</td>
        <td>
          <button class="btn-action open" data-id="${doc.id}">Open</button>
          <button class="btn-action delete" data-id="${doc.id}">Delete</button>
        </td>`;
      tr.querySelector('.open').onclick   = () => openDoc(doc);
      tr.querySelector('.delete').onclick = async () => { await window.storageEngine.deleteDocument(doc.id); refreshDocumentList(); };
      listEl.appendChild(tr);
    });
  }

  function openDoc(doc) {
    if (doc.type === 'writer')  { window.writerApp.loadDocumentObject(doc); switchTab('panel-writer'); }
    else if (doc.type === 'calc')   {
      window.calcApp.sheets = doc.sheets || { Sheet1: doc.cells || {} };
      window.calcApp.title  = doc.title || 'Spreadsheet';
      window.calcApp.activeSheet = doc.activeSheet || 'Sheet1';
      window.calcApp.renderGrid();
      window.calcApp._renderSheetTabs();
      window.calcApp.recalculateAll();
      switchTab('panel-calc');
    } else if (doc.type === 'impress') {
      window.impressApp.slides = doc.slides || [];
      window.impressApp.title  = doc.title || 'Presentation';
      window.impressApp.activeSlideIdx = 0;
      window.impressApp.renderThumbnails();
      window.impressApp.renderActiveSlide();
      switchTab('panel-impress');
    } else if (doc.type === 'draw') {
      if (doc.svgContent) window.drawApp.svg.innerHTML = doc.svgContent;
      window.drawApp._syncShapes();
      switchTab('panel-draw');
    } else if (doc.type === 'base') {
      window.baseApp.loadDataCraftJSON(doc);
      switchTab('panel-base');
    }
    window.sigmaApp.showNotification('Opened: ' + (doc.title || 'Untitled'), 'success');
  }
});
