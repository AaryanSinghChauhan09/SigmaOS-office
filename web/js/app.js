/**
 * SigmaOS Office Shell Application Controller.
 * Manages PWA lifecycle, offline sync, module switching, and local storage orchestration.
 */
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Register Service Worker for Offline PWA execution
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('./sw.js');
      console.log('SigmaOS Office ServiceWorker registered successfully:', reg.scope);
    } catch (err) {
      console.warn('ServiceWorker registration error:', err);
    }
  }

  // 2. Initialize Storage Engine
  if (window.storageEngine) {
    await window.storageEngine.init();
    refreshDocumentList();
  }

  // 3. Network Offline Status Indicator
  const statusEl = document.getElementById('offline-status');
  const updateOnlineStatus = () => {
    if (statusEl) {
      if (navigator.onLine) {
        statusEl.innerText = 'ONLINE (Cached)';
        statusEl.className = 'status-badge online';
      } else {
        statusEl.innerText = 'OFFLINE MODE';
        statusEl.className = 'status-badge offline';
      }
    }
  };
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();

  // 4. Initialize Sub-Engines
  const writerEditor = document.getElementById('writer-editor');
  const writerStats = document.getElementById('writer-stats');
  window.writerApp = new WriterWeb(writerEditor, {
    onWordCountChange: (w, c) => {
      if (writerStats) writerStats.innerText = `${w} words | ${c} chars`;
    }
  });

  const calcTable = document.getElementById('calc-grid');
  const formulaInput = document.getElementById('calc-formula-bar');
  const activeCell = document.getElementById('calc-active-cell');
  window.calcApp = new CalcWeb(calcTable, formulaInput, activeCell);

  const slideThumbs = document.getElementById('impress-thumbnails');
  const slideStage = document.getElementById('impress-stage');
  const slideNotes = document.getElementById('impress-notes');
  window.impressApp = new ImpressWeb(slideThumbs, slideStage, slideNotes);

  const drawSvg = document.getElementById('draw-canvas');
  window.drawApp = new DrawWeb(drawSvg);

  const mathInput = document.getElementById('math-latex-input');
  const mathPreview = document.getElementById('math-preview');
  window.mathApp = new MathWeb(mathInput, mathPreview);

  // 5. Tab Switching
  const tabs = document.querySelectorAll('.nav-tab');
  const panels = document.querySelectorAll('.app-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const activePanel = document.getElementById(target);
      if (activePanel) activePanel.classList.add('active');
      if (target === 'panel-storage') refreshDocumentList();
    });
  });

  // 6. Action Handlers (Export / Import)
  document.getElementById('btn-export-writer-wcf')?.addEventListener('click', () => {
    const json = window.writerApp.toWordCraftJSON();
    window.storageEngine.saveFileToDisk(json, 'document.wcf', 'application/json');
  });

  document.getElementById('btn-export-writer-md')?.addEventListener('click', () => {
    const md = window.writerApp.toMarkdown();
    window.storageEngine.saveFileToDisk(md, 'document.md', 'text/markdown');
  });

  document.getElementById('btn-export-calc-csv')?.addEventListener('click', () => {
    const csv = window.calcApp.toCSV();
    window.storageEngine.saveFileToDisk(csv, 'sheet.csv', 'text/csv');
  });

  document.getElementById('btn-export-calc-gcf')?.addEventListener('click', () => {
    const json = window.calcApp.toGridCraftJSON();
    window.storageEngine.saveFileToDisk(json, 'sheet.gcf', 'application/json');
  });

  document.getElementById('btn-export-impress-dcf')?.addEventListener('click', () => {
    const json = window.impressApp.toDeckCraftJSON();
    window.storageEngine.saveFileToDisk(json, 'presentation.dcf', 'application/json');
  });

  document.getElementById('btn-export-draw-svg')?.addEventListener('click', () => {
    const svg = window.drawApp.exportSVG();
    window.storageEngine.saveFileToDisk(svg, 'drawing.svg', 'image/svg+xml');
  });

  document.getElementById('btn-open-file')?.addEventListener('click', async () => {
    const file = await window.storageEngine.pickAndOpenFile();
    if (file) {
      if (file.name.endsWith('.wcf') || file.name.endsWith('.md') || file.name.endsWith('.txt')) {
        window.writerApp.loadDocumentObject({ title: file.name, plainText: file.content });
        document.querySelector('.nav-tab[data-target="panel-writer"]').click();
      } else if (file.name.endsWith('.csv')) {
        window.calcApp.fromCSV(file.content);
        document.querySelector('.nav-tab[data-target="panel-calc"]').click();
      } else if (file.name.endsWith('.gcf')) {
        const d = JSON.parse(file.content);
        window.calcApp.cells = d.cells || {};
        window.calcApp.recalculateAll();
        document.querySelector('.nav-tab[data-target="panel-calc"]').click();
      }
    }
  });

  async function refreshDocumentList() {
    const listEl = document.getElementById('doc-list-body');
    if (!listEl) return;
    const docs = await window.storageEngine.listDocuments();
    listEl.innerHTML = '';
    if (docs.length === 0) {
      listEl.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px;">No saved documents. Created files are stored locally in IndexedDB.</td></tr>';
      return;
    }
    docs.forEach(doc => {
      const tr = document.createElement('tr');
      const dateStr = new Date(doc.updatedAt).toLocaleString();
      tr.innerHTML = `
        <td><strong>${doc.title || 'Untitled'}</strong></td>
        <td><span class="type-tag ${doc.type}">${doc.type.toUpperCase()}</span></td>
        <td>${dateStr}</td>
        <td>
          <button class="btn-action open" data-id="${doc.id}">Open</button>
          <button class="btn-action delete" data-id="${doc.id}">Delete</button>
        </td>
      `;
      tr.querySelector('.open').onclick = () => openDoc(doc);
      tr.querySelector('.delete').onclick = async () => {
        await window.storageEngine.deleteDocument(doc.id);
        refreshDocumentList();
      };
      listEl.appendChild(tr);
    });
  }

  function openDoc(doc) {
    if (doc.type === 'writer') {
      window.writerApp.loadDocumentObject(doc);
      document.querySelector('.nav-tab[data-target="panel-writer"]').click();
    } else if (doc.type === 'calc') {
      window.calcApp.cells = doc.cells || {};
      window.calcApp.title = doc.title || 'Spreadsheet';
      window.calcApp.recalculateAll();
      document.querySelector('.nav-tab[data-target="panel-calc"]').click();
    } else if (doc.type === 'impress') {
      window.impressApp.slides = doc.slides || [];
      window.impressApp.title = doc.title || 'Presentation';
      window.impressApp.renderThumbnails();
      window.impressApp.renderActiveSlide();
      document.querySelector('.nav-tab[data-target="panel-impress"]').click();
    }
  }
});
