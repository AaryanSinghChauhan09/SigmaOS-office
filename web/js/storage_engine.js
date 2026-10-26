/**
 * SigmaOS Office Storage Engine
 * Provides persistent offline storage via IndexedDB and Chromium File System Access API.
 */
class OfficeStorageEngine {
  constructor() {
    this.dbName = 'SigmaOfficeDB';
    this.version = 1;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('documents')) {
          const docStore = db.createObjectStore('documents', { keyPath: 'id' });
          docStore.createIndex('type', 'type', { unique: false });
          docStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains('revisions')) {
          db.createObjectStore('revisions', { keyPath: 'revId', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  async saveDocument(doc) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['documents'], 'readwrite');
      const store = tx.objectStore('documents');
      doc.updatedAt = Date.now();
      const req = store.put(doc);
      req.onsuccess = () => resolve(doc);
      req.onerror = () => reject(req.error);
    });
  }

  async getDocument(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['documents'], 'readonly');
      const store = tx.objectStore('documents');
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async listDocuments(type = null) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['documents'], 'readonly');
      const store = tx.objectStore('documents');
      const req = store.getAll();
      req.onsuccess = () => {
        let docs = req.result || [];
        if (type) {
          docs = docs.filter(d => d.type === type);
        }
        docs.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
        resolve(docs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteDocument(id) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['documents'], 'readwrite');
      const store = tx.objectStore('documents');
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Revisions / Document Snapshots ---
  async createSnapshot(docId, label, data) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['revisions'], 'readwrite');
      const store = tx.objectStore('revisions');
      const entry = {
        docId: docId,
        label: label || `Snapshot ${new Date().toLocaleTimeString()}`,
        timestamp: Date.now(),
        data: data
      };
      const req = store.add(entry);
      req.onsuccess = () => resolve(entry);
      req.onerror = () => reject(req.error);
    });
  }

  async listSnapshots(docId) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['revisions'], 'readonly');
      const store = tx.objectStore('revisions');
      const req = store.getAll();
      req.onsuccess = () => {
        let revs = (req.result || []).filter(r => r.docId === docId);
        revs.sort((a, b) => b.timestamp - a.timestamp);
        resolve(revs);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteSnapshot(revId) {
    if (!this.db) await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['revisions'], 'readwrite');
      const store = tx.objectStore('revisions');
      const req = store.delete(revId);
      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // --- Workspace Backup / Restore ---
  async exportWorkspaceBundle() {
    if (!this.db) await this.init();
    const docs = await this.listDocuments();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['revisions'], 'readonly');
      const store = tx.objectStore('revisions');
      const req = store.getAll();
      req.onsuccess = () => {
        const bundle = {
          format: 'SigmaOS.WorkspaceBundle',
          version: '2.4.0',
          exportedAt: Date.now(),
          documents: docs,
          revisions: req.result || []
        };
        resolve(JSON.stringify(bundle, null, 2));
      };
      req.onerror = () => reject(req.error);
    });
  }

  async importWorkspaceBundle(jsonStr) {
    if (!this.db) await this.init();
    try {
      const bundle = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      if (bundle.documents && Array.isArray(bundle.documents)) {
        for (const doc of bundle.documents) {
          await this.saveDocument(doc);
        }
      }
      if (bundle.revisions && Array.isArray(bundle.revisions)) {
        const tx = this.db.transaction(['revisions'], 'readwrite');
        const store = tx.objectStore('revisions');
        for (const rev of bundle.revisions) {
          delete rev.revId; // let autoIncrement assign id
          store.add(rev);
        }
      }
      return true;
    } catch (err) {
      console.error('Workspace import error:', err);
      return false;
    }
  }

  // Chromium File System Access API
  async pickAndOpenFile(types = []) {
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: types.length ? types : [
            {
              description: 'Office Documents',
              accept: {
                'application/json': ['.wcf', '.gcf', '.dcf', '.json'],
                'text/csv': ['.csv'],
                'text/markdown': ['.md'],
                'text/plain': ['.txt']
              }
            }
          ]
        });
        const file = await handle.getFile();
        const content = await file.text();
        return { name: file.name, content: content };
      } catch (err) {
        if (err.name !== 'AbortError') console.error('File pick error:', err);
        return null;
      }
    } else {
      // Fallback for standard input
      return this._fallbackFileInput();
    }
  }

  async saveFileToDisk(content, filename, mimeType = 'text/plain') {
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: filename,
          types: [{ description: 'Office File', accept: { [mimeType]: ['.' + filename.split('.').pop()] } }]
        });
        const writable = await handle.createWritable();
        await writable.write(content);
        await writable.close();
        return true;
      } catch (err) {
        if (err.name !== 'AbortError') console.error('Save file error:', err);
        return false;
      }
    } else {
      // Fallback download blob
      this.downloadBlob(content, filename, mimeType);
      return true;
    }
  }

  downloadBlob(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _fallbackFileInput() {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) { resolve(null); return; }
        const reader = new FileReader();
        reader.onload = (re) => resolve({ name: file.name, content: re.target.result });
        reader.readAsText(file);
      };
      input.click();
    });
  }
}

window.storageEngine = new OfficeStorageEngine();
