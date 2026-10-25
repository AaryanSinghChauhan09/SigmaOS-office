"""Unit tests for GenOffice AI and OnlyOffice Collab Engines (AAA Pattern, Deterministic, FIRST)."""

import unittest
from genoffice_ai import GenOfficeAI
from onlyoffice_collab import (
    Operation, ChangeSet, OperationalTransform, CommentThread, CommentReply,
    UserPresence, DocumentLockManager
)


class TestGenOfficeAI(unittest.TestCase):

    def test_prompt_to_document_synthesis(self):
        # Arrange & Act
        doc = GenOfficeAI.generate_document_from_prompt("Microkernel Systems", ["Overview", "Roadmap"])

        # Assert
        self.assertEqual(doc.title, "Microkernel Systems")
        self.assertGreaterEqual(len(doc.elements), 4)
        plain = doc.to_markdown()
        self.assertIn("# Microkernel Systems", plain)
        self.assertIn("Roadmap", plain)

    def test_prompt_to_presentation_synthesis(self):
        # Arrange & Act
        deck = GenOfficeAI.generate_presentation_from_prompt("Distributed Consensus", slide_count=4)

        # Assert
        self.assertEqual(deck.title, "Distributed Consensus")
        self.assertEqual(len(deck.slides), 4)
        self.assertEqual(deck.slides[0].title, "Distributed Consensus")

    def test_text_summarization(self):
        # Arrange
        text = "SigmaOS is a modular operating system. It features microkernel isolation. High performance drivers run in userspace."

        # Act
        summary = GenOfficeAI.summarize_text(text, max_sentences=2)

        # Assert
        self.assertEqual(len(summary["key_takeaways"]), 2)
        self.assertIn("modular operating system", summary["summary"])
        self.assertEqual(summary["total_sentences"], 3)

    def test_style_and_grammar_review(self):
        # Arrange
        text = "The message was delivered by the process. It is verified."

        # Act
        review = GenOfficeAI.review_style_and_grammar(text)

        # Assert
        self.assertGreaterEqual(review["passive_voice_count"], 1)
        self.assertGreater(len(review["suggestions"]), 0)

    def test_template_expansion(self):
        # Arrange
        tmpl = "Dear {{name}},\n{{#if premium}}Status: VIP{{/if}}\nItems:{{#each items}}\n- {{title}}{{/each}}"
        ctx = {
            "name": "Linus",
            "premium": True,
            "items": [{"title": "Kernel"}, {"title": "Toolchain"}]
        }

        # Act
        rendered = GenOfficeAI.expand_template(tmpl, ctx)

        # Assert
        self.assertIn("Dear Linus,", rendered)
        self.assertIn("Status: VIP", rendered)
        self.assertIn("- Kernel", rendered)
        self.assertIn("- Toolchain", rendered)


class TestOnlyOfficeCollab(unittest.TestCase):

    def test_operational_transform_insert_rebasing(self):
        # Arrange
        # User 1 inserts "A" at pos 0
        # User 2 concurrently inserts "B" at pos 0
        op1 = Operation(Operation.INSERT, 0, "A")
        op2 = Operation(Operation.INSERT, 0, "B")

        # Act
        t2, t1 = OperationalTransform.transform_op(op2, op1)
        res = OperationalTransform.apply_to_text("", [op1, t2])

        # Assert
        self.assertIn("A", res)
        self.assertIn("B", res)
        self.assertEqual(len(res), 2)

    def test_operational_transform_delete(self):
        # Arrange
        text = "Hello World"
        op_del = Operation(Operation.DELETE, 0, length=6)  # deletes "Hello "

        # Act
        res = OperationalTransform.apply_to_text(text, [op_del])

        # Assert
        self.assertEqual(res, "World")

    def test_document_lock_manager(self):
        # Arrange
        mgr = DocumentLockManager()

        # Act & Assert
        # Acquire lock
        self.assertTrue(mgr.acquire_lock("sec_1", "user_alice", ttl_seconds=60.0))
        self.assertTrue(mgr.is_locked("sec_1"))

        # User Bob cannot acquire while Alice holds it
        self.assertFalse(mgr.acquire_lock("sec_1", "user_bob", ttl_seconds=60.0))

        # Alice releases lock
        self.assertTrue(mgr.release_lock("sec_1", "user_alice"))
        self.assertFalse(mgr.is_locked("sec_1"))

        # Now Bob can acquire
        self.assertTrue(mgr.acquire_lock("sec_1", "user_bob", ttl_seconds=60.0))

    def test_comment_threads(self):
        # Arrange
        thread = CommentThread("t1", "p1", "alice", "Alice", "Needs clarification.")
        reply = CommentReply("r1", "bob", "Bob", "Updated in revision 2.")

        # Act
        thread.add_reply(reply)
        d = thread.to_dict()

        # Assert
        self.assertEqual(d["thread_id"], "t1")
        self.assertEqual(len(d["replies"]), 1)
        self.assertEqual(d["replies"][0]["author_name"], "Bob")


if __name__ == "__main__":
    unittest.main()
