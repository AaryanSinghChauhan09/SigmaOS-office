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

  // --- Master Slide Themes (LibreOffice Impress / Google Slides inspired) ---
  applyMasterTheme(themeName = 'executive-dark', applyToAll = true) {
    const themes = {
      'executive-dark': { bg: '#0f172a', textColor: '#ffffff', gradient: 'linear-gradient(135deg, #0f172a, #1e293b)' },
      'emerald-clean':  { bg: '#064e3b', textColor: '#ecfdf5', gradient: 'linear-gradient(135deg, #064e3b, #047857)' },
      'crimson-modern': { bg: '#4c0519', textColor: '#fff1f2', gradient: 'linear-gradient(135deg, #4c0519, #881337)' },
      'cyber-neon':     { bg: '#030712', textColor: '#f0fdfa', gradient: 'linear-gradient(135deg, #030712, #083344)' },
      'minimal-light':  { bg: '#ffffff', textColor: '#11111b', gradient: null }
    };
    const t = themes[themeName] || themes['executive-dark'];
    const targetSlides = applyToAll ? this.slides : [this.slides[this.activeSlideIdx]];
    targetSlides.forEach(s => {
      s.bg = t.bg;
      s.textColor = t.textColor;
      s.gradient = t.gradient;
    });
    this.renderActiveSlide();
    this.renderThumbnails();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`Applied '${themeName}' master theme`, 'success');
  }

  // --- Presentation Rehearsal Coach (MS PowerPoint Rehearse inspired) ---
  startRehearsal() {
    const timings = [];
    let current = this.activeSlideIdx;
    let slideStartTime = Date.now();

    window.sigmaApp && window.sigmaApp.showNotification('Rehearsal mode started (Space / Arrows to advance)', 'info');

    const overlay = document.createElement('div');
    overlay.className = 'presentation-fullscreen';

    const render = () => {
      const s = this.slides[current];
      const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
      overlay.innerHTML = `
        <div class="fs-slide" style="${bgStyle}; color:${s.textColor || '#ffffff'};">
          <div style="position:absolute; top:20px; left:20px; background:#f59e0b; color:#111; padding:4px 10px; border-radius:4px; font-weight:bold; font-size:12px;">🎙️ REHEARSAL COACH</div>
          <h1>${this._esc(s.title)}</h1>
          <div class="fs-body">${(s.content || '').replace(/\n/g, '<br>')}</div>
          <div class="fs-counter">Slide ${current + 1} / ${this.slides.length}</div>
        </div>
      `;
    };

    const next = () => {
      const duration = Math.round((Date.now() - slideStartTime) / 1000);
      timings.push({ slide: current + 1, title: this.slides[current].title, duration });
      slideStartTime = Date.now();
      if (current + 1 < this.slides.length) {
        current++;
        render();
      } else {
        finish();
      }
    };

    const finish = () => {
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      window.removeEventListener('keydown', keyHandler);
      const totalSec = timings.reduce((a, b) => a + b.duration, 0);
      let summary = `Rehearsal Report (${totalSec}s total):\n`;
      timings.forEach(t => { summary += `• Slide ${t.slide} (${t.title}): ${t.duration}s\n`; });
      alert(summary);
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') finish();
      else if (e.key === ' ' || e.key === 'ArrowRight') { e.preventDefault(); next(); }
    };

    window.addEventListener('keydown', keyHandler);
    document.body.appendChild(overlay);
    render();
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
    } else if (layoutType === 'comparison') {
      s.title = 'Option A vs Option B';
      s.content = 'Advantages:\n+ Pure local speed\n+ Zero data leakage\n\nTrade-offs:\n- Local storage bound\n- Device specific cache';
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

  // --- Presenter Console / Dual Screen Mode (LibreOffice Presenter Console-inspired) ---
  startPresenterMode() {
    const overlay = document.createElement('div');
    overlay.className = 'presenter-console-overlay';
    let current = this.activeSlideIdx;
    let elapsedSec = 0;
    const timerInterval = setInterval(() => {
      elapsedSec++;
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      const timerEl = overlay.querySelector('#presenter-timer');
      if (timerEl) timerEl.textContent = `⏱ ${mins}:${secs}`;
    }, 1000);

    const render = () => {
      const s = this.slides[current];
      const nextSlide = this.slides[current + 1];
      const mins = String(Math.floor(elapsedSec / 60)).padStart(2, '0');
      const secs = String(elapsedSec % 60).padStart(2, '0');
      const bgStyle = s.gradient ? `background:${s.gradient}` : `background:${s.bg || '#1e3a5f'}`;
      const nextBgStyle = nextSlide ? (nextSlide.gradient ? `background:${nextSlide.gradient}` : `background:${nextSlide.bg || '#1e3a5f'}`) : 'background:#11111b';

      overlay.innerHTML = `
        <div class="presenter-header">
          <span style="font-weight:700; color:#81c784; font-size:15px;">DeckCraft Presenter Console</span>
          <span id="presenter-timer" style="font-family:monospace; font-size:16px; color:#4dabf7;">⏱ ${mins}:${secs}</span>
          <span style="color:var(--text-muted); font-size:13px;">Slide ${current + 1} of ${this.slides.length}</span>
          <div style="margin-left:auto; display:flex; gap:8px;">
            <button class="toolbar-btn" id="btn-pres-prev">◀ Prev</button>
            <button class="toolbar-btn primary" id="btn-pres-next">Next ▶</button>
            <button class="toolbar-btn" id="btn-pres-close">✕ Exit</button>
          </div>
        </div>
        <div class="presenter-body">
          <div class="presenter-main-view">
            <h4 style="color:var(--text-muted); margin-bottom:8px; font-size:12px;">CURRENT SLIDE (AUDIENCE VIEW)</h4>
            <div class="presenter-slide-card" style="${bgStyle}; color:${s.textColor || '#ffffff'};">
              <h2 style="font-size:2vw; margin-bottom:12px;">${this._esc(s.title)}</h2>
              <div style="font-size:1.3vw; line-height:1.6;">${(s.content || '').replace(/\n/g, '<br>')}</div>
            </div>
          </div>
          <div class="presenter-side-column">
            <div class="presenter-next-preview">
              <h4 style="color:var(--text-muted); margin-bottom:8px; font-size:12px;">NEXT SLIDE</h4>
              <div class="presenter-next-card" style="${nextBgStyle}; color:${nextSlide ? (nextSlide.textColor || '#ffffff') : '#666'};">
                <div style="font-weight:600; font-size:13px;">${nextSlide ? this._esc(nextSlide.title) : '(End of Presentation)'}</div>
              </div>
            </div>
            <div class="presenter-notes-box">
              <h4 style="color:#81c784; margin-bottom:8px; font-size:12px;">SPEAKER NOTES</h4>
              <div class="presenter-notes-content">${this._esc(s.notes || '(No notes for this slide)')}</div>
            </div>
          </div>
        </div>
      `;

      overlay.querySelector('#btn-pres-prev').onclick = prev;
      overlay.querySelector('#btn-pres-next').onclick = next;
      overlay.querySelector('#btn-pres-close').onclick = close;
    };

    const next = () => { if (current + 1 < this.slides.length) { current++; render(); } else close(); };
    const prev = () => { if (current > 0) { current--; render(); } };
    const close = () => {
      clearInterval(timerInterval);
      if (document.body.contains(overlay)) document.body.removeChild(overlay);
      window.removeEventListener('keydown', keyHandler);
    };

    const keyHandler = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', keyHandler);

    document.body.appendChild(overlay);
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

  // --- Slide Animation Builder (PowerPoint / LibreOffice Impress Animation Pane inspired) ---
  addSlideAnimation(slideIdx, elementId, animType = 'fade-in', delay = 0) {
    const slide = this.slides[slideIdx];
    if (!slide) return;
    if (!slide.animations) slide.animations = [];
    const anim = { id: 'anim_' + Date.now(), elementId, animType, delay };
    slide.animations.push(anim);
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`Animation "${animType}" added (delay: ${delay}ms)`, 'info');
    return anim.id;
  }

  removeSlideAnimation(slideIdx, animId) {
    const slide = this.slides[slideIdx];
    if (!slide || !slide.animations) return;
    slide.animations = slide.animations.filter(a => a.id !== animId);
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification('Animation removed', 'info');
  }

  showAnimationPane() {
    const slide = this.slides[this.activeSlideIdx];
    const anims = slide && slide.animations ? slide.animations : [];
    const rows = anims.length === 0
      ? '<tr><td colspan="3" style="padding:12px;text-align:center;color:var(--text-muted);">No animations on this slide</td></tr>'
      : anims.map((a, i) => `
          <tr>
            <td style="padding:8px 12px;">${this._esc(a.animType)}</td>
            <td style="padding:8px 12px;">${a.delay}ms</td>
            <td style="padding:8px 12px;">
              <button class="toolbar-btn" onclick="window.impressApp.removeSlideAnimation(${this.activeSlideIdx},'${a.id}');document.getElementById('impress-anim-modal').remove();window.impressApp.showAnimationPane();">🗑</button>
            </td>
          </tr>`).join('');

    const animTypes = ['fade-in','fly-from-left','fly-from-bottom','zoom-in','bounce','typewriter'];
    document.getElementById('impress-anim-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="impress-anim-modal" class="office-modal-backdrop">
        <div class="office-modal-card" style="min-width:460px;">
          <div class="office-modal-header">
            <h3>🎭 Animation Pane – Slide ${this.activeSlideIdx + 1}</h3>
            <button class="office-modal-close" onclick="document.getElementById('impress-anim-modal').remove()">✕</button>
          </div>
          <div class="office-modal-body">
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
              ${animTypes.map(a => `<button class="toolbar-btn" onclick="window.impressApp.addSlideAnimation(${this.activeSlideIdx},'text-main','${a}',0);document.getElementById('impress-anim-modal').remove();window.impressApp.showAnimationPane();">${a}</button>`).join('')}
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <thead><tr>
                <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--accent);">Animation</th>
                <th style="text-align:left;padding:8px 12px;border-bottom:2px solid var(--accent);">Delay</th>
                <th style="padding:8px 12px;border-bottom:2px solid var(--accent);"></th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
          <div class="office-modal-footer">
            <button class="toolbar-btn primary" onclick="document.getElementById('impress-anim-modal').remove()">Close</button>
          </div>
        </div>
      </div>`);
  }

  // --- Outline View (PowerPoint / LibreOffice Impress Outline Mode inspired) ---
  showOutlineView() {
    const lines = this.slides.map((s, i) =>
      `Slide ${i+1}: ${s.title || '(no title)'}\n  ${(s.content || '').split('\n').map(l => '  ' + l).join('\n')}`
    ).join('\n\n');

    document.getElementById('impress-outline-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', `
      <div id="impress-outline-modal" class="office-modal-backdrop">
        <div class="office-modal-card" style="min-width:560px;">
          <div class="office-modal-header">
            <h3>📝 Outline View</h3>
            <button class="office-modal-close" onclick="document.getElementById('impress-outline-modal').remove()">✕</button>
          </div>
          <div class="office-modal-body">
            <textarea id="impress-outline-textarea" style="width:100%;height:340px;font-family:monospace;font-size:13px;resize:vertical;background:var(--bg);color:var(--text);border:1px solid var(--border-color);border-radius:6px;padding:12px;">${this._esc(lines)}</textarea>
            <p style="font-size:12px;color:var(--text-muted);margin-top:8px;">Tip: Edit titles here. Each "Slide N:" line becomes a slide title.</p>
          </div>
          <div class="office-modal-footer">
            <button class="toolbar-btn primary" onclick="window.impressApp._applyOutlineEdit(document.getElementById('impress-outline-textarea').value);document.getElementById('impress-outline-modal').remove();">✓ Apply</button>
            <button class="toolbar-btn" onclick="document.getElementById('impress-outline-modal').remove()">Cancel</button>
          </div>
        </div>
      </div>`);
  }

  _applyOutlineEdit(outlineText) {
    const blocks = outlineText.trim().split(/\nSlide \d+:\s*/);
    blocks.forEach((block, i) => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (!lines.length) return;
      const title = lines[0];
      const content = lines.slice(1).map(l => l.replace(/^\s+/, '')).join('\n');
      if (!this.slides[i]) this.addSlide();
      this.slides[i].title = title;
      this.slides[i].content = content;
    });
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification('Outline applied to presentation', 'success');
  }

  // --- Summary Slide Generator (PowerPoint AI Summary inspired) ---
  generateSummarySlide() {
    const summaryLines = this.slides.map((s, i) =>
      `• Slide ${i + 1}: ${(s.title || '').slice(0, 50)}`
    );
    const newSlide = {
      title: 'Presentation Summary',
      content: summaryLines.join('\n'),
      notes: 'Auto-generated summary slide',
      bg: '#0f172a',
      textColor: '#ffffff',
      layout: 'content',
      transition: 'fade',
      elements: []
    };
    this.slides.push(newSlide);
    this.activeSlideIdx = this.slides.length - 1;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification('Summary slide generated at the end', 'success');
  }

  // --- QR Code Embed (Offline SVG-based) ---
  insertQRCode(text = null) {
    const qrText = text || prompt('Text or URL for QR code:', 'https://sigmaos.dev');
    if (!qrText) return;
    // Simple visual placeholder – encodes presence of a QR element on the slide
    const slide = this.slides[this.activeSlideIdx];
    if (!slide) return;
    if (!slide.elements) slide.elements = [];
    slide.elements.push({
      type: 'qr',
      text: qrText,
      x: 60, y: 60, w: 120, h: 120,
      id: 'qr_' + Date.now()
    });
    this.renderActiveSlide();
    this.triggerAutoSave();
    window.sigmaApp && window.sigmaApp.showNotification(`QR element for "${qrText.slice(0,30)}" added to slide`, 'info');
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
