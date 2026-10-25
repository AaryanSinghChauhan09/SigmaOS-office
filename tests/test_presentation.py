"""Unit tests for SigmaOS-office Presentation Engine (AAA Pattern, Deterministic, FIRST)."""

import unittest
from presentation_engine import Presentation, SlideDeck, Slide, TextElement, SlideElement


class TestPresentationEngine(unittest.TestCase):

    def test_slide_elements_and_properties(self):
        # Arrange
        slide = Slide(title="Architecture Overview", layout="title_content")
        
        # Act
        slide.add_bullet_point("Microkernel Isolation")
        slide.add_bullet_point("Deterministic Schedulers")
        slide.notes = "Present this slide to system architects."
        d = slide.to_dict()

        # Assert
        self.assertEqual(slide.title, "Architecture Overview")
        self.assertEqual(slide.notes, "Present this slide to system architects.")
        self.assertEqual(len(slide.elements), 3)  # title + 2 bullets
        self.assertEqual(d["layout"], "title_content")
        self.assertEqual(d["speaker_notes"], "Present this slide to system architects.")

    def test_presentation_markdown_export_import(self):
        # Arrange
        pres = Presentation(title="SigmaOS Keynote")
        s1 = pres.add_slide("Introduction")
        s1.add_bullet_point("Goal 1: High Reliability")
        s1.speaker_notes = "Welcome notes"

        s2 = pres.add_slide("Roadmap")
        s2.add_bullet_point("Phase 1: Multi-Kernel Core")

        # Act
        md = pres.to_markdown()
        restored = Presentation.from_markdown(md)

        # Assert
        self.assertIn("# SigmaOS Keynote", md)
        self.assertIn("## Introduction", md)
        self.assertIn("High Reliability", md)
        self.assertEqual(restored.title, "SigmaOS Keynote")
        self.assertEqual(len(restored.slides), 2)
        self.assertEqual(restored.slides[0].title, "Introduction")
        self.assertEqual(restored.slides[0].speaker_notes, "Welcome notes")

    def test_presentation_json_serialization(self):
        # Arrange
        deck = SlideDeck(title="Quarterly Review", author="Lead Architect")
        s = deck.add_slide("Milestones")
        s.add_bullet_point("Delivered Zero-Copy IPC")
        
        # Act
        json_str = deck.to_json()
        restored = SlideDeck.from_json(json_str)

        # Assert
        self.assertEqual(restored.title, "Quarterly Review")
        self.assertEqual(restored.author, "Lead Architect")
        self.assertEqual(len(restored.slides), 1)
        self.assertEqual(restored.slides[0].title, "Milestones")


if __name__ == "__main__":
    unittest.main()
