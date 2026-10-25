"""Unit tests for UNO & Macro Scripting Engine (AAA Pattern, Deterministic, FIRST)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from uno_macro_engine import XComponentContext, XMultiComponentFactory, MacroRunner, ScriptContext


class TestUNOMacro(unittest.TestCase):

    def test_component_context_and_service_factory(self):
        # Arrange
        ctx = XComponentContext()
        ctx.set_value_by_name("config/version", "2.1.0")

        # Act
        val = ctx.get_value_by_name("config/version")
        smgr = ctx.get_service_manager()
        smgr.register_service("com.sun.star.text.TextDocument", lambda c: {"type": "TextDocument"})
        instance = smgr.create_instance_with_context("com.sun.star.text.TextDocument")

        # Assert
        self.assertEqual(val, "2.1.0")
        self.assertEqual(instance["type"], "TextDocument")
        self.assertIn("com.sun.star.text.TextDocument", smgr.get_available_service_names())

    def test_macro_runner_registered_script(self):
        # Arrange
        runner = MacroRunner()
        mock_doc = {"title": "Sample Doc", "words": 150}

        def word_count_macro(script_ctx: ScriptContext) -> int:
            return script_ctx.get_document()["words"] * 2

        runner.register_script("DoubleWords", word_count_macro)

        # Act
        res = runner.run_script("DoubleWords", mock_doc)

        # Assert
        self.assertEqual(res, 300)

    def test_macro_event_dispatch(self):
        # Arrange
        runner = MacroRunner()
        mock_doc = {"title": "Event Doc"}
        events_called = []

        runner.register_script("OnSaveHook", lambda ctx: events_called.append("saved"))
        runner.bind_event("OnSave", "OnSaveHook")

        # Act
        runner.dispatch_event("OnSave", mock_doc)

        # Assert
        self.assertEqual(events_called, ["saved"])

    def test_sandboxed_snippet_execution(self):
        # Arrange
        runner = MacroRunner()
        mock_doc = {"x": 10, "y": 20}
        code = "result = ThisComponent['x'] + ThisComponent['y'] + 12"

        # Act
        scope = runner.execute_snippet(code, mock_doc)

        # Assert
        self.assertEqual(scope.get("result"), 42)


if __name__ == "__main__":
    unittest.main()
