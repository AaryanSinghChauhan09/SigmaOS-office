"""Unit tests for Vector Draw and Database Engines (AAA Pattern, Deterministic, FIRST)."""

import unittest
from vector_draw_engine import (
    DrawingCanvas, Rectangle, Ellipse, Line, Connector, TextShape,
    StrokeStyle, FillStyle, Transform
)
from database_engine import (
    Database, Table, Column, QueryBuilder, FormDesign, FormField, ReportGenerator
)


class TestVectorDrawEngine(unittest.TestCase):

    def test_shapes_bounding_box_and_svg(self):
        # Arrange
        canvas = DrawingCanvas(width=500, height=400, title="Diagram")
        rect = Rectangle("r1", 10, 20, 100, 50, stroke=StrokeStyle("#FF0000", 2.0), fill=FillStyle("#00FF00"))
        ellipse = Ellipse("e1", 200, 200, 40, 30)
        line = Line("l1", 0, 0, 100, 100)
        conn = Connector("c1", (100, 50), (200, 200), routing="orthogonal")
        text = TextShape("t1", "Hello Vector", 50, 50)

        # Act
        canvas.add_shape(rect)
        canvas.add_shape(ellipse)
        canvas.add_shape(line)
        canvas.add_shape(conn)
        canvas.add_shape(text)
        svg = canvas.to_svg()

        # Assert
        self.assertEqual(len(canvas.shapes), 5)
        self.assertIn('<rect id="r1"', svg)
        self.assertIn('<ellipse id="e1"', svg)
        self.assertIn('<line id="l1"', svg)
        self.assertIn('<path id="c1"', svg)
        self.assertIn('Hello Vector', svg)
        self.assertEqual(rect.bounding_box(), (10.0, 20.0, 100.0, 50.0))

    def test_canvas_json_roundtrip(self):
        # Arrange
        canvas = DrawingCanvas(width=800, height=600)
        canvas.add_shape(Rectangle("box", 10, 10, 80, 80))
        
        # Act
        json_data = canvas.to_dict()
        restored = DrawingCanvas.from_dict(json_data)

        # Assert
        self.assertEqual(restored.width, 800)
        self.assertEqual(len(restored.shapes), 1)
        self.assertEqual(restored.shapes[0].shape_id, "box")


class TestDatabaseEngine(unittest.TestCase):

    def setUp(self):
        self.db = Database("InventoryDB")
        self.table = self.db.create_table("items", [
            Column("id", "INTEGER", primary_key=True),
            Column("name", "TEXT", nullable=False),
            Column("price", "REAL"),
            Column("in_stock", "BOOLEAN", default_value=True),
        ])

    def test_table_insert_and_constraints(self):
        # Arrange & Act
        self.table.insert({"id": 1, "name": "Keyboard", "price": 49.99, "in_stock": True})
        self.table.insert({"id": 2, "name": "Mouse", "price": 19.99, "in_stock": False})

        # Assert
        self.assertEqual(self.table.count(), 2)

        # Primary key uniqueness check
        with self.assertRaises(ValueError):
            self.table.insert({"id": 1, "name": "Duplicate", "price": 10.0})

    def test_query_filtering_ordering_and_aggregation(self):
        # Arrange
        self.table.insert({"id": 1, "name": "Widget A", "price": 10.0})
        self.table.insert({"id": 2, "name": "Widget B", "price": 20.0})
        self.table.insert({"id": 3, "name": "Gadget C", "price": 30.0})

        # Act - Query WHERE price >= 20
        expensive = self.db.query("items").where("price", ">=", 20.0).order_by("price", descending=True).execute()

        # Act - Query LIKE %Widget%
        widgets = self.db.query("items").where("name", "LIKE", "%Widget%").execute()

        # Act - Aggregations
        total_price = self.db.query("items").aggregate("SUM", "price")
        avg_price = self.db.query("items").aggregate("AVG", "price")

        # Assert
        self.assertEqual(len(expensive), 2)
        self.assertEqual(expensive[0]["name"], "Gadget C")
        self.assertEqual(expensive[1]["name"], "Widget B")
        self.assertEqual(len(widgets), 2)
        self.assertEqual(total_price, 60.0)
        self.assertEqual(avg_price, 20.0)

    def test_report_generator(self):
        # Arrange
        self.table.insert({"id": 1, "name": "Server", "price": 999.0})
        rows = self.db.query("items").execute()
        rep = ReportGenerator("Hardware Assets", ["id", "name", "price"])

        # Act
        text_report = rep.generate_text_report(rows)

        # Assert
        self.assertIn("REPORT: HARDWARE ASSETS", text_report)
        self.assertIn("Server", text_report)
        self.assertIn("Total Records: 1", text_report)


if __name__ == "__main__":
    unittest.main()
