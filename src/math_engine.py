"""SigmaOS-office Math & Formula Engine (LibreOffice Math / OpenOffice Math / MathCraft inspired).

Provides mathematical AST, LaTeX to MathML and OpenFormula converters,
and symbolic equation rendering stubs for technical typography.

Principles: Pure Functions, Deterministic Testing, Clear Abstraction.
"""

from typing import Dict, Any, List, Optional
import re

MATH_SYMBOLS = {
    r"\alpha": "α", r"\beta": "β", r"\gamma": "γ", r"\delta": "δ",
    r"\epsilon": "ε", r"\theta": "θ", r"\lambda": "λ", r"\mu": "μ",
    r"\pi": "π", r"\sigma": "σ", r"\tau": "τ", r"\omega": "ω",
    r"\infty": "∞", r"\pm": "±", r"\neq": "≠", r"\leq": "≤",
    r"\geq": "≥", r"\times": "×", r"\div": "÷", r"\approx": "≈",
    r"\sum": "∑", r"\prod": "∏", r"\int": "∫", r"\sqrt": "√",
}


class MathFormula:
    """Mathematical equation container supporting LaTeX, MathML, and plain Unicode."""
    def __init__(self, latex_source: str = ""):
        self.latex_source = latex_source.strip()

    def to_unicode_text(self) -> str:
        """Translate LaTeX tokens into human-readable Unicode representation."""
        s = self.latex_source
        for tex, uni in MATH_SYMBOLS.items():
            s = s.replace(tex, uni)

        # Basic fraction conversion: \frac{a}{b} -> (a / b)
        s = re.sub(r"\\frac\{([^}]+)\}\{([^}]+)\}", r"(\1 / \2)", s)
        # Power conversion: x^{2} -> x^2
        s = re.sub(r"\^\{([^}]+)\}", r"^\1", s)
        # Subscript conversion: x_{i} -> x_i
        s = re.sub(r"_\{([^}]+)\}", r"_\1", s)
        return s.replace("{", "").replace("}", "").strip()

    def to_mathml(self) -> str:
        """Generate W3C MathML XML representation."""
        elements = []
        tokens = self.latex_source.split()
        for tok in tokens:
            if tok in MATH_SYMBOLS:
                elements.append(f"<mo>{MATH_SYMBOLS[tok]}</mo>")
            elif tok.isdigit():
                elements.append(f"<mn>{tok}</mn>")
            elif tok.isalpha():
                elements.append(f"<mi>{tok}</mi>")
            elif tok in ("+", "-", "=", "*", "/"):
                elements.append(f"<mo>{tok}</mo>")
            else:
                elements.append(f"<mrow><mi>{tok}</mi></mrow>")

        inner = "\n  ".join(elements)
        return f'<math xmlns="http://www.w3.org/1998/Math/MathML">\n  {inner}\n</math>'

    def to_dict(self) -> Dict[str, Any]:
        return {
            "latex": self.latex_source,
            "unicode": self.to_unicode_text(),
            "mathml": self.to_mathml(),
        }
