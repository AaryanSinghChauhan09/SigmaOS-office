"""Unit tests for SigmaOS-office Spreadsheet Engine (AAA Pattern, Deterministic, FIRST)."""

import unittest
from spreadsheet_engine import (
    Sheet, Spreadsheet, Workbook, col_name_to_idx, col_idx_to_name,
    parse_cell_coord, format_cell_coord
)


class TestSpreadsheetEngine(unittest.TestCase):

    def test_coordinate_parsing_and_formatting(self):
        # Arrange & Act & Assert
        self.assertEqual(col_name_to_idx("A"), 0)
        self.assertEqual(col_name_to_idx("Z"), 25)
        self.assertEqual(col_name_to_idx("AA"), 26)
        self.assertEqual(col_idx_to_name(0), "A")
        self.assertEqual(col_idx_to_name(25), "Z")
        self.assertEqual(col_idx_to_name(26), "AA")

        r, c = parse_cell_coord("B5")
        self.assertEqual((r, c), (4, 1))
        self.assertEqual(format_cell_coord(4, 1), "B5")

        with self.assertRaises(ValueError):
            parse_cell_coord("INVALID_COORD")

    def test_cell_values_and_formulas(self):
        # Arrange
        sheet = Sheet("Budget")
        
        # Act
        sheet.set_cell("A1", 10)
        sheet.set_cell("A2", 20)
        sheet.set_cell("A3", 30)
        sheet.set_cell("A4", "=SUM(A1:A3)")
        sheet.set_cell("B1", "=AVERAGE(A1:A3)")
        sheet.set_cell("B2", "=MIN(A1:A3)")
        sheet.set_cell("B3", "=MAX(A1:A3)")
        sheet.set_cell("B4", "=COUNT(A1:A3)")
        sheet.calculate()

        # Assert
        self.assertEqual(sheet.get_value("A4"), 60)
        self.assertEqual(sheet.get_value("B1"), 20.0)
        self.assertEqual(sheet.get_value("B2"), 10)
        self.assertEqual(sheet.get_value("B3"), 30)
        self.assertEqual(sheet.get_value("B4"), 3)

    def test_cell_arithmetic_formulas(self):
        # Arrange
        sheet = Sheet("Calculations")
        
        # Act
        sheet.set_cell("C1", 100)
        sheet.set_cell("C2", 25)
        sheet.set_cell("C3", "=C1 + C2")
        sheet.set_cell("C4", "=C1 - C2")
        sheet.set_cell("C5", "=C1 * C2")
        sheet.set_cell("C6", "=C1 / C2")
        sheet.calculate()

        # Assert
        self.assertEqual(sheet.get_value("C3"), 125.0)
        self.assertEqual(sheet.get_value("C4"), 75.0)
        self.assertEqual(sheet.get_value("C5"), 2500.0)
        self.assertEqual(sheet.get_value("C6"), 4.0)

    def test_csv_serialization_and_deserialization(self):
        # Arrange
        sheet = Sheet("Data")
        sheet.set_cell("A1", "Item")
        sheet.set_cell("B1", "Cost")
        sheet.set_cell("A2", "Widget")
        sheet.set_cell("B2", 15)
        
        # Act
        csv_str = sheet.to_csv()
        restored = Sheet.from_csv(csv_str, name="Restored")

        # Assert
        self.assertIn("Widget", csv_str)
        self.assertEqual(restored.get_value("A1"), "Item")
        self.assertEqual(restored.get_value("B2"), 15)

    def test_workbook_multi_sheet(self):
        # Arrange
        wb = Workbook("Corporate Financials")
        s1 = wb.active_sheet()
        s1.set_cell("A1", 500)
        
        # Act
        s2 = wb.add_sheet("Q2")
        s2.set_cell("A1", 700)
        wb.calculate_all()

        # Assert
        self.assertEqual(len(wb.sheets), 2)
        self.assertEqual(s1.get_value("A1"), 500)
        self.assertEqual(s2.get_value("A1"), 700)

    def test_openformula_functions(self):
        # Arrange
        sheet = Sheet("Formulas")
        sheet.set_cell("A1", "Alpha")
        sheet.set_cell("B1", 100)
        sheet.set_cell("A2", "Beta")
        sheet.set_cell("B2", 200)

        # Act
        sheet.set_cell("C1", '=VLOOKUP("Beta", A1:B2, 2)')
        sheet.set_cell("C2", '=INDEX(A1:B2, 1, 2)')
        sheet.set_cell("C3", '=CONCATENATE("Hello ", "World")')
        sheet.set_cell("C4", '=UPPER("sigmaos")')
        sheet.set_cell("C5", '=LOWER("OFFICE")')
        sheet.set_cell("C6", '=LEN("test")')
        sheet.set_cell("C7", '=ABS(-42.5)')
        sheet.set_cell("C8", '=ROUND(3.14159, 2)')
        sheet.set_cell("C9", '=STDEV(B1:B2)')
        sheet.calculate()

        # Assert
        self.assertEqual(sheet.get_value("C1"), 200)
        self.assertEqual(sheet.get_value("C2"), 100)
        self.assertEqual(sheet.get_value("C3"), "Hello World")
        self.assertEqual(sheet.get_value("C4"), "SIGMAOS")
        self.assertEqual(sheet.get_value("C5"), "office")
        self.assertEqual(sheet.get_value("C6"), 4)
        self.assertEqual(sheet.get_value("C7"), 42.5)
        self.assertEqual(sheet.get_value("C8"), 3.14)
        self.assertAlmostEqual(sheet.get_value("C9"), 70.71, places=1)

    def test_circular_reference_detection(self):
        # Arrange
        sheet = Sheet("Cycle")
        sheet.set_cell("A1", "=B1 + 1")
        sheet.set_cell("B1", "=A1 + 1")

        # Act & Assert
        with self.assertRaises(ValueError):
            sheet.calculate()


if __name__ == "__main__":
    unittest.main()
