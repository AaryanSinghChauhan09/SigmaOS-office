/**
 * SigmaOS Writer Web (WordCraft / LibreOffice Writer inspired).
 * Fully offline WYSIWYG rich text document processor.
 */
class WriterWeb {
  constructor(editorElement, options = {}) {
    this.editor = editorElement;
    this.docId = options.docId || 'doc_' + Date.now();
    this.title = options.title || 'Untitled Document';
    this.onWordCountChange = options.onWordCountChange || null;
    this.setupListeners();
  }

  setupListeners() {
    this.editor.addEventListener('input', () => {
      this.updateStats();
      this.triggerAutoSave();
    });
    this.updateStats();
  }

  execCommand(cmd, val = null) {
    document.execCommand(cmd, false, val);
    this.editor.focus();
    this.updateStats();
  }

  insertTable(rows = 3, cols = 3) {
    let html = '<table border="1" style="width:100%; border-collapse: collapse; margin: 12px 0;"><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="padding: 8px; border: 1px solid #444;">Cell ${r+1},${c+1}</td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    this.execCommand('insertHTML', html);
  }

  getWordCount() {
    const text = this.editor.innerText.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  getCharacterCount() {
    return this.editor.innerText.length;
  }

  updateStats() {
    if (this.onWordCountChange) {
      this.onWordCountChange(this.getWordCount(), this.getCharacterCount());
    }
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument(this.toDocumentObject());
      }
    }, 1000);
  }

  toDocumentObject() {
    return {
      id: this.docId,
      type: 'writer',
      title: this.title,
      htmlContent: this.editor.innerHTML,
      plainText: this.editor.innerText,
      wordCount: this.getWordCount(),
      charCount: this.getCharacterCount(),
      updatedAt: Date.now()
    };
  }

  loadDocumentObject(doc) {
    this.docId = doc.id || this.docId;
    this.title = doc.title || this.title;
    this.editor.innerHTML = doc.htmlContent || `<p>${doc.plainText || ''}</p>`;
    this.updateStats();
  }

  toWordCraftJSON() {
    return JSON.stringify({
      format: "SigmaOS.WordCraft",
      version: "1.0",
      title: this.title,
      html: this.editor.innerHTML,
      text: this.editor.innerText,
      timestamp: Date.now()
    }, null, 2);
  }

  toMarkdown() {
    let html = this.editor.innerHTML;
    // Basic HTML to Markdown converter
    return html
      .replace(/<h1>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<b>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u>(.*?)<\/u>/gi, '_$1_')
      .replace(/<li>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }
}

window.WriterWeb = WriterWeb;
