/**
 * SigmaOS Impress Web (DeckCraft / LibreOffice Impress inspired).
 * Fully offline presentation deck authoring & slideshow engine.
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
        title: "Welcome to SigmaOS Office",
        content: "• Offline-first architecture in Chromium\n• Local IndexedDB & File System Access\n• Native Craft & ODF Interoperability",
        notes: "Introduction slide for attendees."
      }
    ];
    this.activeSlideIdx = 0;
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

    // Keyboard shortcuts: F5 for presentation mode
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F5') {
        e.preventDefault();
        this.startPresentation();
      }
    });
  }

  renderThumbnails() {
    this.thumbList.innerHTML = '';
    this.slides.forEach((s, idx) => {
      const item = document.createElement('div');
      item.className = `slide-thumb ${idx === this.activeSlideIdx ? 'active' : ''}`;
      item.innerHTML = `<span class="thumb-num">${idx + 1}</span><div class="thumb-preview">${s.title || 'Untitled'}</div>`;
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

    this.stage.innerHTML = `
      <div class="slide-canvas">
        <h1 class="slide-title" contenteditable="true">${s.title}</h1>
        <div class="slide-body" contenteditable="true">${s.content.replace(/\n/g, '<br>')}</div>
      </div>
    `;

    const titleEl = this.stage.querySelector('.slide-title');
    const bodyEl = this.stage.querySelector('.slide-body');

    titleEl.addEventListener('input', (e) => {
      s.title = e.target.innerText;
      this.renderThumbnails();
      this.triggerAutoSave();
    });

    bodyEl.addEventListener('input', (e) => {
      s.content = e.target.innerText;
      this.triggerAutoSave();
    });

    if (this.notesInput) {
      this.notesInput.value = s.notes || '';
    }
  }

  addSlide() {
    this.slides.push({
      title: `Slide ${this.slides.length + 1}`,
      content: "• Add key takeaway here\n• Add supporting points",
      notes: ""
    });
    this.activeSlideIdx = this.slides.length - 1;
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  deleteSlide() {
    if (this.slides.length <= 1) return;
    this.slides.splice(this.activeSlideIdx, 1);
    if (this.activeSlideIdx >= this.slides.length) {
      this.activeSlideIdx = this.slides.length - 1;
    }
    this.renderThumbnails();
    this.renderActiveSlide();
    this.triggerAutoSave();
  }

  startPresentation() {
    const overlay = document.createElement('div');
    overlay.className = 'presentation-fullscreen';
    let current = this.activeSlideIdx;

    const render = () => {
      const s = this.slides[current];
      overlay.innerHTML = `
        <div class="fs-slide">
          <h1>${s.title}</h1>
          <div class="fs-body">${s.content.replace(/\n/g, '<br>')}</div>
          <div class="fs-counter">${current + 1} / ${this.slides.length}</div>
        </div>
      `;
    };

    overlay.onclick = () => {
      current++;
      if (current >= this.slides.length) {
        document.body.removeChild(overlay);
        if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      } else {
        render();
      }
    };

    window.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        if (document.body.contains(overlay)) document.body.removeChild(overlay);
        window.removeEventListener('keydown', escHandler);
      }
    });

    document.body.appendChild(overlay);
    if (overlay.requestFullscreen) overlay.requestFullscreen().catch(() => {});
    render();
  }

  toDeckCraftJSON() {
    return JSON.stringify({
      format: "SigmaOS.DeckCraft",
      version: "1.0",
      title: this.title,
      slides: this.slides,
      updatedAt: Date.now()
    }, null, 2);
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
    }, 1000);
  }
}

window.ImpressWeb = ImpressWeb;
