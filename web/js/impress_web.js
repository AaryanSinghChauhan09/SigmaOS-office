/**
 * SigmaOS Impress Web (DeckCraft).
 * Inspired by: LibreOffice Impress, OnlyOffice Presentation, Deckset, Reveal.js.
 * Features: slide backgrounds, gradients, layouts, duplicate/move slides,
 *           transitions (fade/slide/zoom), text/image element insertion,
 *           HTML export, keyboard navigation (F5, Escape, arrow keys).
 */
class ImpressWeb {
  constructor(thumbnailListElement, stageElement, notesElement) {
    this.thumbList = thumbnailListElement;
    this.stage = stageElement;
    this.notesInput = notesElement;
    this.title = 'Untitled Presentation';
    this.docId = 'deck_' + Date.now();
    this.slides = [
      {
        title: 'Welcome to SigmaOS Office',
        content: '• Offline-first architecture in Chromium\n• Local IndexedDB & File System Access\n• Native Craft & ODF Interoperability',
        notes: 'Introduction slide for attendees.',
        bg: '#1e3a5f',
        textColor: '#ffffff',
        layout: 'content',
        transition: 'fade',
        elements: []
      }
    ];
    this.activeSlideIdx = 0;
    this._saveTimer = null;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.setupListeners();
  }

  setupListeners() {
    if (this.notesInput) {
      this.notesInput.addEventListener('input', (e) => {
        if (this.slides[this.activeSlideIdx]) {
          this.slides[this.activeSlideIdx].notes = e.target.value;
          this.triggerAutoSave();
        }
      });
    }
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5') { e.preventDefault(); this.startPresentation(); }
    });
  }

  // --- Slide background & theme (LibreOffice Impress Master Page-inspired) ---
  setSlideBackground(index, color) {
    if (!this.slides[index]) return;
    this.slides[index].bg = color;
    this.slides[index].gradient = null;
    this.renderActiveSlide();
    this.renderThumbnails();
    this.triggerAutoSave();
  }

  setSlideGradient(index, color1, color2) {
    if (!this.slides[index]) return;
    this.slides[index].gradient = `linear-gradient(135deg, ${color1}, ${color2})`;
    this.slides[index].bg = null;
    this.renderActiveSlide();
    this.renderThumbnails();
    this.triggerAutoSave();
  }

  setSlideTextColor(index, color) {
    if (!this.slides[index]) return;
    this.slides[index].textColor = color;
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  setTransition(index, type) {
    // type: 'fade' | 'slide' | 'zoom' | 'none'
    if (!this.slides[index]) return;
    this.slides[index].transition = type;
    this.triggerAutoSave();
  }

  // --- Extra element insertion ---
  addTextElement(slideIndex, text, x = 100, y = 100, fontSize = 18) {
    if (!this.slides[slideIndex]) return;
    if (!this.slides[slideIndex].elements) this.slides[slideIndex].elements = [];
    this.slides[slideIndex].elements.push({ type: 'text', text, x, y, fontSize });
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  addImageElement(slideIndex, dataURL, x = 50, y = 50, width = 200, height = 150) {
    if (!this.slides[slideIndex]) return;
    if (!this.slides[slideIndex].elements) this.slides[slideIndex].elements = [];
    this.slides[slideIndex].elements.push({ type: 'image', src: dataURL, x, y, width, height });
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  // --- Slide management ---
  renderThumbnails() {
    this.thumbList.innerHTML = '';
    this.slides.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `slide-thumb ${idx === this.activeSlideIdx ? 'active' : ''}`;
      const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
      const tc = s.textColor || '#ffffff';
      item.innerHTML = `
        <span class="thumb-num">${idx + 1}</span>
        <div class="thumb-preview" style="${bgStyle};color:${tc};font-size:9px;padding:6px;overflow:hidden;">
          <div style="font-weight:700;margin-bottom:2px;">${this._esc(s.title || 'Untitled')}</div>
          <div style="opacity:0.75;">${this._esc((s.content || '').slice(0, 50))}</div>
        </div>`;
      item.onclick = () => {
        this.activeSlideIdx = idx;
        this.renderThumbnails();
        this.renderActiveSlide();
      };
      this.thumbList.appendChild(item);
    });
  }

  renderActiveSlide() {
    const s = this.slides[this.activeSlideIdx];
    if (!s) return;
    const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
    const tc = s.textColor || '#ffffff';
    const extraEls = (s.elements || []).map(el => {
      if (el.type === 'text') {
        return `<div class="slide-extra-text" style="position:absolute;left:${el.x}px;top:${el.y}px;font-size:${el.fontSize}px;color:${tc};">${this._esc(el.text)}</div>`;
      }
      if (el.type === 'image') {
        return `<img src="${el.src}" style="position:absolute;left:${el.x}px;top:${el.y}px;width:${el.width}px;height:${el.height}px;object-fit:contain;" alt="slide image">`;
      }
      return '';
    }).join('');

    this.stage.innerHTML = `
      <div class="slide-canvas" style="${bgStyle};color:${tc};position:relative;">
        <h1 class="slide-title" contenteditable="true" style="color:${tc};">${this._esc(s.title)}</h1>
        <div class="slide-body" contenteditable="true" style="color:${tc};">${(s.content || '').replace(/\n/g, '<br>')}</div>
        ${extraEls}
      </div>`;

    const titleEl = this.stage.querySelector('.slide-title');
    const bodyEl  = this.stage.querySelector('.slide-body');
    titleEl.addEventListener('input', (e) => { s.title = e.target.innerText; this.renderThumbnails(); this.triggerAutoSave(); });
    bodyEl.addEventListener('input',  (e) => { s.content = e.target.innerText; this.triggerAutoSave(); });
    if (this.notesInput) this.notesInput.value = s.notes || '';
  }

  addSlide() {
    this.slides.splice(this.activeSlideIdx + 1, 0, {
      title: `Slide ${this.slides.length + 1}`,
      content: '• Add key takeaway here\n• Add supporting points',
      notes: '',
      bg: '#1e3a5f',
      textColor: '#ffffff',
      layout: 'content',
      transition: 'fade',
      elements: []
    });
    this.activeSlideIdx = this.activeSlideIdx + 1;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  // --- Slide Layout Presets (LibreOffice / Google Slides inspired) ---
  applyLayout(slideIndex, layoutType = 'content') {
    const idx = slideIndex !== undefined ? slideIndex : this.activeSlideIdx;
    const s = this.slides[idx];
    if (!s) return;
    s.layout = layoutType;
    if (layoutType === 'title') {
      s.title = s.title || 'Presentation Title';
      s.content = 'Presenter Name · Subtitle · ' + new Date().toLocaleDateString();
    } else if (layoutType === 'two-column') {
      s.content = 'Column A:\n• Core Principle 1\n• Architectural Benefit\n\nColumn B:\n• Implementation Detail\n• Measurable Outcome';
    } else if (layoutType === 'quote') {
      s.content = '"Simplicity is prerequisite for reliability."\n— Edsger W. Dijkstra';
    } else if (layoutType === 'stat') {
      s.title = '100% OFFLINE';
      s.content = 'Zero External CDN Dependencies · High Performance Chromium Runtime';
    }
    this.renderActiveSlide();
    this.renderThumbnails();
    this.triggerAutoSave();
  }

  deleteSlide() {
    if (this.slides.length <= 1) return;
    this.slides.splice(this.activeSlideIdx, 1);
    if (this.activeSlideIdx >= this.slides.length) this.activeSlideIdx = this.slides.length - 1;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  duplicateSlide(index) {
    const src = this.slides[index || this.activeSlideIdx];
    if (!src) return;
    const clone = JSON.parse(JSON.stringify(src));
    clone.title = clone.title + ' (Copy)';
    this.slides.splice((index || this.activeSlideIdx) + 1, 0, clone);
    this.activeSlideIdx = (index || this.activeSlideIdx) + 1;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  moveSlide(fromIndex, toIndex) {
    if (fromIndex < 0 || fromIndex >= this.slides.length) return;
    if (toIndex < 0 || toIndex >= this.slides.length) return;
    const [slide] = this.slides.splice(fromIndex, 1);
    this.slides.splice(toIndex, 0, slide);
    this.activeSlideIdx = toIndex;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  // --- Presentation mode (Reveal.js-inspired transitions) ---
  startPresentation() {
    const overlay = document.createElement('div');
    overlay.className = 'presentation-fullscreen';
    let current = this.activeSlideIdx;

    const applyTransition = (entering) => {
      const t = this.slides[current] && this.slides[current].transition || 'fade';
      entering.style.animation = t === 'fade'  ? 'fs-fade-in 0.4s ease'
                                 : t === 'slide' ? 'fs-slide-in 0.4s ease'
                                 : t === 'zoom'  ? 'fs-zoom-in 0.4s ease'
                                 : 'none';
    };

    let elapsedSec = 0;
    const timerInterval = setInterval(() => {
      elapsedSec++;
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      const timerEl = overlay.querySelector('.fs-timer');
      if (timerEl) timerEl.textContent = `⏱ ${mins}:${secs}`;
    }, 1000);

    const render = () => {
      const s = this.slides[current];
      const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
      const tc = s.textColor || '#ffffff';
      const slideDiv = document.createElement('div');
      slideDiv.className = 'fs-slide';
      slideDiv.style.cssText = `${bgStyle};color:${tc};`;
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      slideDiv.innerHTML = `
        <h1>${this._esc(s.title)}</h1>
        <div class="fs-body">${(s.content || '').replace(/\n/g, '<br>')}</div>
        <div class="fs-timer" style="position:absolute;bottom:20px;left:20px;font-size:1.2vw;color:#a6adc8;font-family:monospace;">⏱ ${mins}:${secs}</div>
        <div class="fs-counter">${current + 1} / ${this.slides.length}</div>
        <div class="fs-notes" style="opacity:0.5;font-size:12px;margin-top:20px;">${this._esc(s.notes || '')}</div>`;
      overlay.innerHTML = '';
      overlay.appendChild(slideDiv);
      applyTransition(slideDiv);
    };

    const next = () => { current++; if (current >= this.slides.length) { close(); } else render(); };
    const prev = () => { current = Math.max(0, current - 1); render(); };
    const close = () => {
      clearInterval(timerInterval);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    };

    overlay.onclick = (e) => { if (e.shiftKey) prev(); else next(); };

    const keyHandler = (e) => {
      if (e.key === 'Escape') { close(); window.removeEventListener('keydown', keyHandler); }
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', keyHandler);

    document.body.appendChild(overlay);
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    render();
  }

  // --- HTML export (Reveal.js-compatible) ---
  exportToHTML() {
    const slidesHtml = this.slides.map((s, i) => {
      const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
      const tc = s.textColor || '#ffffff';
      return `  <section class="slide" id="slide-${i+1}" style="${bgStyle};color:${tc};">
    <h1>${this._esc(s.title)}</h1>
    <div>${(s.content || '').replace(/\n/g, '<br>')}</div>
  </section>`;
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${this._esc(this.title)}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
.slide { display: none; width: 100vw; height: 100vh; padding: 80px; justify-content: center; flex-direction: column; }
.slide.active { display: flex; }
.slide h1 { font-size: 2.5em; margin-bottom: 30px; }
#nav { position: fixed; bottom: 20px; right: 20px; display: flex; gap: 10px; }
button { padding: 8px 18px; border-radius: 6px; border: none; cursor: pointer; background: rgba(255,255,255,0.2); color: inherit; font-size: 14px; }
</style>
</head>
<body>
${slidesHtml}
<div id="nav">
  <button onclick="navigate(-1)">◀ Prev</button>
  <span id="counter" style="line-height:34px;color:#fff;"></span>
  <button onclick="navigate(1)">Next ▶</button>
</div>
<script>
var current = 0;
var slides = document.querySelectorAll('.slide');
function show() { slides.forEach((s,i) => s.classList.toggle('active', i === current)); document.getElementById('counter').textContent = (current+1)+'/'+slides.length; }
function navigate(dir) { current = Math.max(0, Math.min(slides.length-1, current+dir)); show(); }
document.addEventListener('keydown', e => { if(e.key==='ArrowRight'||e.key===' ') navigate(1); if(e.key==='ArrowLeft') navigate(-1); });
show();
<\/script>
</body>
</html>`;
  }

  // --- Serialization ---
  toDeckCraftJSON() {
    return JSON.stringify({
      format: 'SigmaOS.DeckCraft',
      version: '2.0',
      title: this.title,
      slides: this.slides,
      updatedAt: Date.now()
    }, null, 2);
  }

  _esc(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'impress',
          title: this.title,
          slides: this.slides,
          updatedAt: Date.now()
        });
      }
    }, 1500);
  }
}

window.ImpressWeb = ImpressWeb;
