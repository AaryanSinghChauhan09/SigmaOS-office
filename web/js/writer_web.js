/**
 * SigmaOS Writer Web (WordCraft).
 * Inspired by: LibreOffice Writer, OnlyOffice Document Server, OpenOffice Writer.
 * Fully offline WYSIWYG rich text document processor for Chromium-based browsers.
 * Features: font controls, alignment, find/replace, image insert, link insert,
 *           horizontal rule, print, undo/redo, keyboard shortcuts (Ctrl+S, Ctrl+H, Ctrl+P).
 */
class WriterWeb {
  constructor(editorElement, options = {}) {
    this.editor = editorElement;
    this.docId = options.docId || 'doc_' + Date.now();
    this.title = options.title || 'Untitled Document';
    this.onWordCountChange = options.onWordCountChange || null;
    this._saveTimer = null;
    this._findReplacePanel = null;
    this.setupListeners();
  }

  setupListeners() {
    this.editor.addEventListener('input', () => {
      this.updateStats();
      this.triggerAutoSave();
    });
    // Ctrl+S → immediate save; Ctrl+H → find/replace; Ctrl+P → print
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        this.triggerAutoSave(true);
        window.sigmaApp && window.sigmaApp.showNotification('Document saved', 'success');
      }
      if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        this.toggleFindReplace();
      }
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.print();
      }
    });
    this.updateStats();
  }

  // --- Core execCommand proxy (LibreOffice Writer-style) ---
  execCommand(cmd, val = null) {
    this.editor.focus();
    document.execCommand(cmd, false, val);
    this.updateStats();
  }

  setFontFamily(family) {
    this.execCommand('fontName', family);
  }

  setFontSize(size) {
    // execCommand fontSize expects 1–7; we map px sizes
    const sizeMap = { 10: 1, 12: 2, 14: 3, 16: 4, 18: 5, 24: 6, 36: 7 };
    const mapped = sizeMap[parseInt(size)] || 3;
    this.execCommand('fontSize', mapped);
    // Supplement with direct style for exact sizes
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!range.collapsed) {
        const span = document.createElement('span');
        span.style.fontSize = size + 'px';
        try { range.surroundContents(span); } catch (_) {}
      }
    }
  }

  setTextColor(color) {
    this.execCommand('foreColor', color);
  }

  setHighlight(color) {
    this.execCommand('hiliteColor', color);
  }

  setAlignment(align) {
    // align: 'Left' | 'Center' | 'Right' | 'Full'
    this.execCommand('justify' + align);
  }

  indent() { this.execCommand('indent'); }
  outdent() { this.execCommand('outdent'); }

  // --- Table insertion (OnlyOffice-style configurable) ---
  insertTable(rows = 3, cols = 3) {
    let html = '<table border="1" style="width:100%; border-collapse:collapse; margin:12px 0;">';
    html += '<thead><tr>';
    for (let c = 0; c < cols; c++) {
      html += `<th style="padding:8px; border:1px solid #444; background:#f0f0f0; font-weight:600;">Column ${c + 1}</th>`;
    }
    html += '</tr></thead><tbody>';
    for (let r = 0; r < rows - 1; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) {
        html += `<td style="padding:8px; border:1px solid #444; min-width:60px;" contenteditable="true"></td>`;
      }
      html += '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    this.execCommand('insertHTML', html);
  }

  insertHorizontalRule() {
    this.execCommand('insertHTML', '<hr style="border:none; border-top:2px solid #ccc; margin:16px 0;"><p><br></p>');
  }

  insertLink(url, text) {
    const display = text || url;
    this.execCommand('insertHTML', `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#4dabf7;">${display}</a>`);
  }

  insertImage(dataURL) {
    this.execCommand('insertHTML', `<img src="${dataURL}" style="max-width:100%; height:auto; display:block; margin:8px 0;" alt="Inserted image">`);
  }

  // --- Table of Contents Generator (LibreOffice TOC-inspired) ---
  generateTOC() {
    const headings = this.editor.querySelectorAll('h1, h2, h3');
    if (!headings || headings.length === 0) {
      window.sigmaApp && window.sigmaApp.showNotification('No headings (H1, H2, H3) found for TOC', 'info');
      return;
    }
    let tocHtml = `<div class="writer-toc-block" style="background:#181825; border:1px solid #313244; padding:16px; border-radius:6px; margin:16px 0;">
      <h4 style="margin:0 0 10px 0; color:#81c784; font-size:15px;">📑 Table of Contents</h4>
      <ul style="list-style:none; padding-left:4px; margin:0; line-height:1.8;">`;
    headings.forEach((h, idx) => {
      const id = h.id || `toc_h_${idx}`;
      h.id = id;
      const level = parseInt(h.tagName.substring(1));
      const indent = (level - 1) * 18;
      const title = h.innerText.trim() || `Section ${idx + 1}`;
      tocHtml += `<li style="padding-left:${indent}px; font-size:13px;">
        <a href="#${id}" style="color:#4dabf7; text-decoration:none;">${level === 1 ? '• ' : '- '}${title}</a>
      </li>`;
    });
    tocHtml += `</ul></div><p><br></p>`;
    this.execCommand('insertHTML', tocHtml);
    window.sigmaApp && window.sigmaApp.showNotification('Table of Contents generated', 'success');
  }

  // --- Footnotes Management (LibreOffice / Academic Style) ---
  insertFootnote(noteText = 'Footnote reference note') {
    const existingFootnotes = this.editor.querySelectorAll('.footnote-ref');
    const fnNum = existingFootnotes.length + 1;
    const fnId = `footnote_${fnNum}`;
    const fnRefHtml = `<sup class="footnote-ref" style="color:#81c784; font-weight:bold; cursor:pointer;" title="${noteText}"><a href="#${fnId}" style="text-decoration:none; color:inherit;">[${fnNum}]</a></sup>`;
    this.execCommand('insertHTML', fnRefHtml);

    // Append to or create footnotes section at document bottom
    let fnSection = this.editor.querySelector('.writer-footnotes-section');
    if (!fnSection) {
      fnSection = document.createElement('div');
      fnSection.className = 'writer-footnotes-section';
      fnSection.style.cssText = 'border-top:1px solid #444; margin-top:28px; padding-top:12px; font-size:12px; color:var(--text-muted);';
      fnSection.innerHTML = '<strong style="color:var(--text-muted);">Footnotes:</strong><ol style="margin-top:6px; padding-left:20px;"></ol>';
      this.editor.appendChild(fnSection);
    }
    const ol = fnSection.querySelector('ol');
    if (ol) {
      const li = document.createElement('li');
      li.id = fnId;
      li.innerHTML = `${noteText} <a href="#writer-editor" style="color:#4dabf7; text-decoration:none;">↩</a>`;
      ol.appendChild(li);
    }
    this.updateStats();
    this.triggerAutoSave();
  }

  // --- MathCraft Formula Insertion ---
  insertMathFormula(latex = '\\sum_{i=1}^n x_i') {
    const span = document.createElement('span');
    span.className = 'math-inline-pill';
    span.contentEditable = 'false';
    span.style.cssText = 'display:inline-block; background:#181825; border:1px solid #40a02b; padding:2px 8px; border-radius:4px; font-family:monospace; color:#81c784; margin:0 4px;';
    span.title = `LaTeX: ${latex}`;
    span.innerText = `📐 ${latex}`;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(span);
    } else {
      this.editor.appendChild(span);
    }
    this.updateStats();
    this.triggerAutoSave();
  }

  // --- Page Margins Configuration ---
  setPageMargins(type = 'normal') {
    // normal: 40px, narrow: 20px, wide: 60px
    const marginMap = { normal: '40px', narrow: '20px', wide: '70px' };
    const pad = marginMap[type] || '40px';
    this.editor.style.padding = pad;
    window.sigmaApp && window.sigmaApp.showNotification(`Margins set to ${type}`, 'info');
  }

  // --- Markdown Split View Mode ---
  toggleSplitView() {
    const container = document.querySelector('.writer-container');
    let mdPane = document.getElementById('writer-md-pane');
    if (!container) return;

    if (mdPane && mdPane.style.display !== 'none') {
      // Hide split view
      mdPane.style.display = 'none';
      container.classList.remove('split-view-active');
      window.sigmaApp && window.sigmaApp.showNotification('Split view closed', 'info');
    } else {
      if (!mdPane) {
        mdPane = document.createElement('textarea');
        mdPane.id = 'writer-md-pane';
        mdPane.className = 'writer-md-editor';
        mdPane.placeholder = 'Markdown source code…';
        mdPane.spellcheck = false;
        container.insertBefore(mdPane, this.editor);

        mdPane.addEventListener('input', () => {
          this.editor.innerHTML = this.markdownToHTML(mdPane.value);
          this.updateStats();
          this.triggerAutoSave();
        });
      }
      mdPane.value = this.toMarkdown();
      mdPane.style.display = 'block';
      container.classList.add('split-view-active');
      window.sigmaApp && window.sigmaApp.showNotification('Markdown split view active', 'info');
    }
  }

  markdownToHTML(md) {
    if (!md) return '<p><br></p>';
    let html = md
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/!\[(.*?)\]\((.*?)\)/gim, '<img alt="$1" src="$2" style="max-width:100%;" />')
      .replace(/\[(.*?)\]\((.*?)\)/gim, '<a href="$2" target="_blank">$1</a>')
      .replace(/\n\n/gim, '</p><p>')
      .replace(/^\- (.*$)/gim, '<li>$1</li>');
    return `<p>${html}</p>`;
  }

  // --- Interactive Checklist / To-Dos (Odoo Knowledge / Notion inspired) ---
  insertChecklist(itemText = 'To-do item') {
    const html = `<div class="writer-checklist-item" style="display:flex; align-items:center; gap:8px; margin:4px 0;"><input type="checkbox" style="cursor:pointer; width:16px; height:16px;"><span>${itemText}</span></div><p><br></p>`;
    this.execCommand('insertHTML', html);
  }

  // --- Document Watermark Overlay (MS Word / LibreOffice inspired) ---
  setWatermark(text = 'CONFIDENTIAL') {
    let wm = this.editor.querySelector('.writer-watermark-overlay');
    if (!text || text.trim() === '') {
      if (wm) wm.remove();
      window.sigmaApp && window.sigmaApp.showNotification('Watermark removed', 'info');
      return;
    }
    if (!wm) {
      wm = document.createElement('div');
      wm.className = 'writer-watermark-overlay';
      this.editor.style.position = 'relative';
      this.editor.appendChild(wm);
    }
    wm.innerText = text.toUpperCase();
    window.sigmaApp && window.sigmaApp.showNotification(`Watermark set: ${text.toUpperCase()}`, 'info');
    this.triggerAutoSave();
  }

  // --- Line Spacing & Page Color (MS Word / Google Docs inspired) ---
  setLineSpacing(factor = 1.5) {
    this.editor.style.lineHeight = String(factor);
    window.sigmaApp && window.sigmaApp.showNotification(`Line spacing: ${factor}`, 'info');
    this.triggerAutoSave();
  }

  setPageColor(color = '#ffffff') {
    this.editor.style.backgroundColor = color;
    this.triggerAutoSave();
  }

  // --- Mail Merge & Template Tokens (LibreOffice Writer / OpenOffice inspired) ---
  mailMerge(record = {}) {
    let content = this.editor.innerHTML;
    let matchCount = 0;
    for (const [key, val] of Object.entries(record)) {
      const tokenRegex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
      if (tokenRegex.test(content)) {
        content = content.replace(tokenRegex, String(val));
        matchCount++;
      }
    }
    this.editor.innerHTML = content;
    this.updateStats();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`Mail merge: ${matchCount} tokens replaced`, 'success');
    return matchCount;
  }

  // --- Callouts & Alerts (inspired by GitHub / Notion Callouts) ---
  insertCallout(type = 'NOTE', text = 'Important note content goes here.') {
    const borderColors = { NOTE: '#4dabf7', TIP: '#81c784', WARNING: '#ffb74d', CAUTION: '#e57373', IMPORTANT: '#ba68c8' };
    const bgColors     = { NOTE: '#182438', TIP: '#162e20', WARNING: '#382b18', CAUTION: '#3b1c1c', IMPORTANT: '#2c1a38' };
    const borderColor = borderColors[type] || '#4dabf7';
    const bgColor = bgColors[type] || '#182438';
    const html = `<div class="writer-callout" style="border-left: 4px solid ${borderColor}; background-color: ${bgColor}; padding: 12px 16px; margin: 14px 0; border-radius: 4px;">
      <strong style="color: ${borderColor}; font-size: 13px;">[!${type}]</strong>
      <p style="margin: 6px 0 0 0; font-size: 14px;">${text}</p>
    </div><p><br></p>`;
    this.execCommand('insertHTML', html);
  }

  insertCodeBlock(code = 'fn main() {\n    println!("Hello, SigmaOS!");\n}', lang = 'rust') {
    const html = `<pre class="writer-code-block" style="background:#11111b; color:#cdd6f4; padding:12px; border-radius:6px; font-family:monospace; font-size:13px; margin:12px 0; overflow-x:auto;"><code>// ${lang}\n${code}</code></pre><p><br></p>`;
    this.execCommand('insertHTML', html);
  }

  // --- Document Outline Navigator (LibreOffice Navigator-inspired) ---
  getOutline() {
    const headings = this.editor.querySelectorAll('h1, h2, h3');
    const outline = [];
    headings.forEach((h, idx) => {
      const id = 'heading_' + idx;
      h.id = id;
      outline.push({
        id,
        level: parseInt(h.tagName.substring(1)),
        text: h.innerText.trim() || 'Untitled Section'
      });
    });
    return outline;
  }

  // --- Find & Replace (inspired by LibreOffice Writer's Find toolbar) ---
  toggleFindReplace() {
    const panel = document.getElementById('writer-find-replace');
    if (panel) {
      const hidden = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = hidden ? 'flex' : 'none';
      if (hidden) {
        const findinput = panel.querySelector('.fr-find-input');
        if (findinput) findinput.focus();
      }
    }
  }

  findReplace(findText, replaceText, replaceAll = false) {
    if (!findText) return 0;
    const content = this.editor.innerHTML;
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(escaped, replaceAll ? 'gi' : 'i');
    const count = (content.match(new RegExp(escaped, 'gi')) || []).length;
    this.editor.innerHTML = content.replace(re, replaceText);
    this.triggerAutoSave();
    return count;
  }

  findNext(findText) {
    if (!findText) return;
    window.find(findText, false, false, true, false, false, false);
  }

  // --- Statistics ---
  getWordCount() {
    const text = this.editor.innerText.trim();
    if (!text) return 0;
    return text.split(/\s+/).filter(w => w.length > 0).length;
  }

  getCharacterCount() {
    return this.editor.innerText.length;
  }

  updateStats() {
    const wc = this.getWordCount();
    const cc = this.getCharacterCount();
    const readMinutes = Math.max(1, Math.ceil(wc / 200));
    const el = document.getElementById('writer-stats');
    if (el) el.textContent = `${wc} words | ${cc} chars | ~${readMinutes} min read`;
    if (this.onWordCountChange) this.onWordCountChange(wc, cc);
  }

  // --- Auto-save (LibreOffice Writer AutoRecovery-inspired) ---
  triggerAutoSave(immediate = false) {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    const delay = immediate ? 0 : 1500;
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument(this.toDocumentObject());
      }
    }, delay);
  }

  // --- Serialization ---
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
      format: 'SigmaOS.WordCraft',
      version: '2.0',
      title: this.title,
      html: this.editor.innerHTML,
      text: this.editor.innerText,
      wordCount: this.getWordCount(),
      timestamp: Date.now()
    }, null, 2);
  }

  toHTML() {
    return `<!DOCTYPE html>\n<html lang="en"><head><meta charset="UTF-8"><title>${this.title}</title><style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;line-height:1.7;color:#222;}h1,h2,h3{color:#111;}table{width:100%;border-collapse:collapse;}td,th{border:1px solid #ccc;padding:8px;}hr{border:none;border-top:2px solid #ccc;margin:20px 0;}</style></head>\n<body>\n${this.editor.innerHTML}\n</body></html>`;
  }

  toMarkdown() {
    let html = this.editor.innerHTML;
    return html
      .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
      .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
      .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
      .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
      .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
      .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
      .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
      .replace(/<u[^>]*>(.*?)<\/u>/gi, '_$1_')
      .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
      .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
      .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
      .replace(/<hr[^>]*>/gi, '\n---\n\n')
      .replace(/<br\s*[\/]?>/gi, '\n')
      .replace(/<[^>]+>/g, '');
  }

  toPlainText() {
    return this.editor.innerText;
  }

  clearDocument() {
    this.editor.innerHTML = '<p><br></p>';
    this.updateStats();
    this.triggerAutoSave();
  }

  print() {
    const content = this.toHTML();
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(content);
      win.document.close();
      win.print();
    }
  }
}

window.WriterWeb = WriterWeb;
