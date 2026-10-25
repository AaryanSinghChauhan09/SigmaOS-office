/**
 * SigmaOS Math Web (MathCraft / LibreOffice Math inspired).
 * Fully offline mathematical typesetting & formula preview engine in Chromium.
 */
class MathWeb {
  constructor(inputElement, previewElement) {
    this.input = inputElement;
    this.preview = previewElement;
    this.docId = 'math_' + Date.now();
    this.title = 'Untitled Formula';
    this.symbols = {
      "\\alpha": "α", "\\beta": "β", "\\gamma": "γ", "\\delta": "δ",
      "\\epsilon": "ε", "\\theta": "θ", "\\lambda": "λ", "\\mu": "μ",
      "\\pi": "π", "\\sigma": "σ", "\\omega": "ω", "\\infty": "∞",
      "\\pm": "±", "\\neq": "≠", "\\leq": "≤", "\\geq": "≥",
      "\\times": "×", "\\div": "÷", "\\approx": "≈", "\\sum": "∑",
      "\\prod": "∏", "\\int": "∫", "\\sqrt": "√"
    };
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    this.input.addEventListener('input', () => this.render());
  }

  insertSymbol(sym) {
    const val = this.input.value;
    const start = this.input.selectionStart;
    const end = this.input.selectionEnd;
    this.input.value = val.substring(0, start) + sym + ' ' + val.substring(end);
    this.input.focus();
    this.input.setSelectionRange(start + sym.length + 1, start + sym.length + 1);
    this.render();
  }

  toUnicode(latex) {
    let s = latex;
    for (const [tex, uni] of Object.entries(this.symbols)) {
      s = s.replaceAll(tex, uni);
    }
    s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1 / $2)');
    s = s.replace(/\^\{([^}]+)\}/g, '^$1');
    s = s.replace(/_\{([^}]+)\}/g, '_$1');
    return s.replace(/[{}]/g, '');
  }

  toMathML(latex) {
    const tokens = latex.trim().split(/\s+/);
    const elements = [];
    tokens.forEach(tok => {
      if (this.symbols[tok]) {
        elements.push(`<mo>${this.symbols[tok]}</mo>`);
      } else if (!isNaN(Number(tok))) {
        elements.push(`<mn>${tok}</mn>`);
      } else if (/^[a-zA-Z]+$/.test(tok)) {
        elements.push(`<mi>${tok}</mi>`);
      } else if (['+', '-', '=', '*', '/'].includes(tok)) {
        elements.push(`<mo>${tok}</mo>`);
      } else {
        elements.push(`<mrow><mi>${tok}</mi></mrow>`);
      }
    });
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">\n  ${elements.join('\n  ')}\n</math>`;
  }

  render() {
    const latex = this.input.value.trim();
    const uni = this.toUnicode(latex);
    const mathml = this.toMathML(latex);
    this.preview.innerHTML = `
      <div class="math-unicode-preview">${uni || 'Formula Preview'}</div>
      <div class="math-mathml-preview">${mathml}</div>
    `;
    this.triggerAutoSave();
  }

  toMathCraftJSON() {
    return JSON.stringify({
      format: "SigmaOS.MathCraft",
      version: "1.0",
      title: this.title,
      latex: this.input.value,
      unicode: this.toUnicode(this.input.value),
      updatedAt: Date.now()
    }, null, 2);
  }

  triggerAutoSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(async () => {
      if (window.storageEngine) {
        await window.storageEngine.saveDocument({
          id: this.docId,
          type: 'math',
          title: this.title,
          latex: this.input.value,
          updatedAt: Date.now()
        });
      }
    }, 1000);
  }
}

window.MathWeb = MathWeb;
