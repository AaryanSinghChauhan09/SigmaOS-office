"""Unit tests for SigmaOS-office Math Engine (AAA Pattern, Deterministic, FIRST)."""

import unittest
from math_engine import MathFormula, MATH_SYMBOLS


class TestMathEngine(unittest.TestCase):

    def test_unicode_symbol_translation(self):
        # Arrange
        formula = MathFormula(r"\alpha + \beta = \gamma")

        # Act
        unicode_str = formula.to_unicode_text()

        # Assert
        self.assertIn("α", unicode_str)
        self.assertIn("β", unicode_str)
        self.assertIn("γ", unicode_str)

    def test_fractions_and_superscripts(self):
        # Arrange
        formula = MathFormula(r"\frac{x}{y} + z^{2}")

        # Act
        unicode_str = formula.to_unicode_text()

        # Assert
        self.assertEqual(unicode_str, "(x / y) + z^2")

    def test_mathml_generation(self):
        # Arrange
        formula = MathFormula(r"\sum x = 42")

        # Act
        mathml = formula.to_mathml()

        # Assert
        self.assertIn('<math xmlns="http://www.w3.org/1998/Math/MathML">', mathml)
        self.assertIn("<mo>∑</mo>", mathml)
        self.assertIn("<mi>x</mi>", mathml)
        self.assertIn("<mn>42</mn>", mathml)

    def test_formula_to_dict(self):
        # Arrange
        formula = MathFormula(r"\pi \times r^{2}")

        # Act
        d = formula.to_dict()

        # Assert
        self.assertEqual(d["latex"], r"\pi \times r^{2}")
        self.assertIn("π", d["unicode"])
        self.assertIn("<math", d["mathml"])


if __name__ == "__main__":
    unittest.main()
