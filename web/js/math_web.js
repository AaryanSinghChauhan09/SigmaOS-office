/**
 * SigmaOS Math Web (MathCraft).
 * Inspired by: LibreOffice Math, KaTeX, MathJax, GeoGebra formula editor.
 * Features: categorised symbol palette, formula templates, LaTeX→Unicode,
 *           MathML generation, clipboard copy, history (last 10 formulas).
 */
class MathWeb {
  constructor(inputElement, previewElement) {
    this.input = inputElement;
    this.preview = previewElement;
    this._history = JSON.parse(localStorage.getItem('sigma_math_history') || '[]');
    this.setupListeners();
    this.render();
  }

  setupListeners() {
    if (this.input) {
      this.input.addEventListener('input', () => this.render());
    }
  }

  insertSymbol(sym) {
    if (!this.input) return;
    const start = this.input.selectionStart;
    const end = this.input.selectionEnd;
    const before = this.input.value.slice(0, start);
    const after  = this.input.value.slice(end);
    this.input.value = before + sym + ' ' + after;
    this.input.selectionStart = this.input.selectionEnd = start + sym.length + 1;
    this.input.focus();
    this.render();
  }

  // --- Templates (inspired by LibreOffice Math template gallery) ---
  insertTemplate(name) {
    const templates = {
      fraction:    '\\frac{a}{b}',
      integral:    '\\int_{a}^{b} f(x)\\,dx',
      sum:         '\\sum_{i=1}^{n} x_i',
      product:     '\\prod_{i=1}^{n} x_i',
      limit:       '\\lim_{x \\to \\infty} f(x)',
      derivative:  '\\frac{d}{dx}f(x)',
      matrix2x2:   '\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}',
      binomial:    '\\binom{n}{k}',
      sqrt:        '\\sqrt{x}',
      nthroot:     '\\sqrt[n]{x}',
      log:         '\\log_{b}(x)',
      euler:       'e^{i\\pi} + 1 = 0',
      quadratic:   'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}',
      gaussian:    '\\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{(x-\\mu)^2}{2\\sigma^2}}'
    };
    if (templates[name]) this.insertSymbol(templates[name]);
  }

  // --- Dynamic Matrix Generator (LibreOffice Math / LaTeX inspired) ---
  generateMatrix(rows = 3, cols = 3, env = 'pmatrix') {
    let rowsArr = [];
    for (let r = 0; r < rows; r++) {
      let cells = [];
      for (let c = 0; c < cols; c++) {
        cells.push(`a_{${r+1}${c+1}}`);
      }
      rowsArr.push(cells.join(' & '));
    }
    const snippet = `\\begin{${env}}\n${rowsArr.join(' \\\\\n')}\n\\end{${env}}`;
    this.insertSymbol(snippet);
  }

  // --- Academic Equation Numbering (LibreOffice Math / IEEE inspired) ---
  insertNumberedEquation(number = 1) {
    const cur = this.input ? this.input.value : '';
    this.input.value = `${cur.trim()} \\tag{${number}}`;
    this.render();
    window.sigmaApp && window.sigmaApp.showNotification(`Equation tagged (${number})`, 'info');
  }

  // --- Unicode LaTeX translation ---
  toUnicode() {
    const latex = this.input ? this.input.value : '';
    return latex
      // Greek lowercase
      .replace(/\\alpha/g,'α').replace(/\\beta/g,'β').replace(/\\gamma/g,'γ')
      .replace(/\\delta/g,'δ').replace(/\\epsilon/g,'ε').replace(/\\zeta/g,'ζ')
      .replace(/\\eta/g,'η').replace(/\\theta/g,'θ').replace(/\\iota/g,'ι')
      .replace(/\\kappa/g,'κ').replace(/\\lambda/g,'λ').replace(/\\mu/g,'μ')
      .replace(/\\nu/g,'ν').replace(/\\xi/g,'ξ').replace(/\\pi/g,'π')
      .replace(/\\rho/g,'ρ').replace(/\\sigma/g,'σ').replace(/\\tau/g,'τ')
      .replace(/\\upsilon/g,'υ').replace(/\\phi/g,'φ').replace(/\\chi/g,'χ')
      .replace(/\\psi/g,'ψ').replace(/\\omega/g,'ω')
      // Greek uppercase
      .replace(/\\Gamma/g,'Γ').replace(/\\Delta/g,'Δ').replace(/\\Theta/g,'Θ')
      .replace(/\\Lambda/g,'Λ').replace(/\\Xi/g,'Ξ').replace(/\\Pi/g,'Π')
      .replace(/\\Sigma/g,'Σ').replace(/\\Upsilon/g,'Υ').replace(/\\Phi/g,'Φ')
      .replace(/\\Psi/g,'Ψ').replace(/\\Omega/g,'Ω')
      // Operators
      .replace(/\\pm/g,'±').replace(/\\mp/g,'∓').replace(/\\times/g,'×')
      .replace(/\\div/g,'÷').replace(/\\cdot/g,'·').replace(/\\circ/g,'∘')
      .replace(/\\ast/g,'∗').replace(/\\star/g,'★').replace(/\\oplus/g,'⊕')
      .replace(/\\otimes/g,'⊗')
      // Relations
      .replace(/\\leq/g,'≤').replace(/\\geq/g,'≥').replace(/\\neq/g,'≠')
      .replace(/\\approx/g,'≈').replace(/\\equiv/g,'≡').replace(/\\sim/g,'∼')
      .replace(/\\propto/g,'∝').replace(/\\prec/g,'≺').replace(/\\succ/g,'≻')
      // Arrows
      .replace(/\\rightarrow/g,'→').replace(/\\leftarrow/g,'←').replace(/\\leftrightarrow/g,'↔')
      .replace(/\\Rightarrow/g,'⇒').replace(/\\Leftarrow/g,'⇐').replace(/\\Leftrightarrow/g,'⇔')
      .replace(/\\uparrow/g,'↑').replace(/\\downarrow/g,'↓')
      // Sets
      .replace(/\\in/g,'∈').replace(/\\notin/g,'∉').replace(/\\subset/g,'⊂')
      .replace(/\\supset/g,'⊃').replace(/\\subseteq/g,'⊆').replace(/\\supseteq/g,'⊇')
      .replace(/\\cap/g,'∩').replace(/\\cup/g,'∪').replace(/\\setminus/g,'∖')
      .replace(/\\emptyset/g,'∅').replace(/\\forall/g,'∀').replace(/\\exists/g,'∃')
      .replace(/\\nexists/g,'∄').replace(/\\nabla/g,'∇').replace(/\\partial/g,'∂')
      // Large operators
      .replace(/\\sum/g,'∑').replace(/\\prod/g,'∏').replace(/\\int/g,'∫')
      .replace(/\\oint/g,'∮').replace(/\\iint/g,'∬').replace(/\\infty/g,'∞')
      // Misc
      .replace(/\\sqrt\{([^}]+)\}/g,'√($1)').replace(/\\sqrt/g,'√')
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g,'($1)/($2)')
      .replace(/\\cdots/g,'⋯').replace(/\\ldots/g,'…').replace(/\\vdots/g,'⋮')
      .replace(/\\ddots/g,'⋱').replace(/\\hbar/g,'ℏ').replace(/\\ell/g,'ℓ')
      .replace(/\\\\/g,' | ')  // newline in matrix
      .replace(/\{|\}/g,'')
      .replace(/\^([^ ]+)/g,(m,p)=> p.length===1 ? '^'+p : '^('+p+')')
      .replace(/_([^ ]+)/g,(m,p)=> p.length===1 ? '_'+p : '_(' +p+')');
  }

  // --- MathML generation ---
  toMathML() {
    const latex = this.input ? this.input.value.trim() : '';
    let tokens = latex
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '<mfrac><mrow>$1</mrow><mrow>$2</mrow></mfrac>')
      .replace(/\\sqrt\{([^}]+)\}/g, '<msqrt><mrow>$1</mrow></msqrt>')
      .replace(/\\sqrt/g, '<msqrt><mi>x</mi></msqrt>')
      .replace(/\\sum/g, '<mo>∑</mo>').replace(/\\prod/g, '<mo>∏</mo>')
      .replace(/\\int/g, '<mo>∫</mo>').replace(/\\infty/g, '<mn>∞</mn>')
      .replace(/\\alpha/g,'<mi>α</mi>').replace(/\\beta/g,'<mi>β</mi>')
      .replace(/\\gamma/g,'<mi>γ</mi>').replace(/\\pi/g,'<mi>π</mi>')
      .replace(/\\sigma/g,'<mi>σ</mi>').replace(/\\mu/g,'<mi>μ</mi>')
      .replace(/\\pm/g,'<mo>±</mo>').replace(/\\times/g,'<mo>×</mo>')
      .replace(/\\leq/g,'<mo>≤</mo>').replace(/\\geq/g,'<mo>≥</mo>')
      .replace(/\\neq/g,'<mo>≠</mo>').replace(/\\approx/g,'<mo>≈</mo>')
      .replace(/\\rightarrow/g,'<mo>→</mo>').replace(/\\leftarrow/g,'<mo>←</mo>')
      .replace(/\\in/g,'<mo>∈</mo>').replace(/\\subset/g,'<mo>⊂</mo>')
      .replace(/\\partial/g,'<mo>∂</mo>').replace(/\\nabla/g,'<mo>∇</mo>')
      .replace(/\\forall/g,'<mo>∀</mo>').replace(/\\exists/g,'<mo>∃</mo>')
      .replace(/([a-zA-Z])\^(\{[^}]+\}|[^\s{])/g, (m, base, exp) => {
        const e = exp.startsWith('{') ? exp.slice(1,-1) : exp;
        return `<msup><mi>${base}</mi><mn>${e}</mn></msup>`;
      })
      .replace(/([a-zA-Z])_(\{[^}]+\}|[^\s{])/g, (m, base, sub) => {
        const s = sub.startsWith('{') ? sub.slice(1,-1) : sub;
        return `<msub><mi>${base}</mi><mn>${s}</mn></msub>`;
      })
      .replace(/\{|\}/g, '')
      .replace(/\\([a-z]+)/gi, (m, name) => `<mi>${name}</mi>`)
      .replace(/([0-9]+\.?[0-9]*)/g, '<mn>$1</mn>')
      .replace(/([a-zA-Z])/g, '<mi>$1</mi>')
      .replace(/([+\-*\/=<>])/g, '<mo>$1</mo>');
    return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block">\n  <mrow>${tokens}</mrow>\n</math>`;
  }

  toFormulaDictionary() {
    const latex = this.input ? this.input.value : '';
    return {
      format: 'SigmaOS.MathCraft',
      version: '2.0',
      latex,
      unicode: this.toUnicode(),
      mathml: this.toMathML(),
      timestamp: Date.now()
    };
  }

  // --- Clipboard copy ---
  copyToClipboard() {
    const text = this.toUnicode();
    navigator.clipboard.writeText(text).then(() => {
      window.sigmaApp && window.sigmaApp.showNotification('Formula copied!', 'success');
    }).catch(() => {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
    });
  }

  copyMathML() {
    const mathml = this.toMathML();
    navigator.clipboard.writeText(mathml).then(() => {
      window.sigmaApp && window.sigmaApp.showNotification('MathML copied to clipboard!', 'success');
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = mathml; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      window.sigmaApp && window.sigmaApp.showNotification('MathML copied!', 'success');
    });
  }

  insertIntoWriter() {
    const latex = this.input ? this.input.value : '';
    if (!latex.trim()) return;
    if (window.writerApp) {
      window.writerApp.insertMathFormula(latex);
      const writerTab = document.querySelector('[data-target="panel-writer"]');
      if (writerTab) writerTab.click();
      window.sigmaApp && window.sigmaApp.showNotification('Formula inserted into WordCraft', 'success');
    }
  }

  // --- History ---
  _addToHistory(latex) {
    this._history = [latex, ...this._history.filter(f => f !== latex)].slice(0, 10);
    localStorage.setItem('sigma_math_history', JSON.stringify(this._history));
    this._renderHistory();
  }

  _renderHistory() {
    const el = document.getElementById('math-history-list');
    if (!el) return;
    el.innerHTML = '';
    this._history.forEach(f => {
      const btn = document.createElement('button');
      btn.className = 'math-history-item';
      btn.title = f;
      btn.textContent = f.length > 30 ? f.slice(0, 30) + '…' : f;
      btn.onclick = () => { if (this.input) { this.input.value = f; this.render(); } };
      el.appendChild(btn);
    });
  }

  // --- Render preview ---
  render() {
    const latex = this.input ? this.input.value : '';
    const unicode = this.toUnicode();
    const mathml = this.toMathML();

    if (this.preview) {
      this.preview.innerHTML = `
        <div class="math-result-unicode">${this._escapeHtml(unicode)}</div>
        <div class="math-result-mathml">
          <details>
            <summary style="font-size:11px;cursor:pointer;color:var(--text-muted);">MathML</summary>
            <pre style="font-size:11px;overflow:auto;max-height:120px;">${this._escapeHtml(mathml)}</pre>
          </details>
        </div>`;
    }

    if (latex.trim()) this._addToHistory(latex);
  }

  _escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

window.MathWeb = MathWeb;
