"""Unit tests for Collaboration Security and Hash Chain Engine (AAA Pattern, Deterministic, FIRST)."""

import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src"))
from collab_security import MerkleAuditLog, DocumentTokenManager, VisualDiffEngine, WatermarkSpec
from onlyoffice_collab import ChangeSet, Operation


class TestCollabSecurity(unittest.TestCase):

    def test_merkle_audit_log_chain_integrity(self):
        # Arrange
        audit = MerkleAuditLog()
        cs1 = ChangeSet(revision=1, user_id="alice", operations=[Operation(Operation.INSERT, 0, "First edit")])
        cs2 = ChangeSet(revision=2, user_id="bob", operations=[Operation(Operation.INSERT, 10, "Second edit")])

        # Act
        h1 = audit.append_changeset(cs1, "Alice edit")
        h2 = audit.append_changeset(cs2, "Bob edit")

        # Assert
        self.assertEqual(len(audit.chain), 3)  # genesis + 2
        self.assertTrue(audit.verify_integrity())

        # Tampering check: corrupt block 1 hash
        audit.chain[1]["prev_hash"] = "corrupted_hash"
        self.assertFalse(audit.verify_integrity())

    def test_document_token_lifecycle(self):
        # Arrange
        secret = "sigma_vault_key_2026"
        doc_id = "doc_xyz"
        user_id = "user_42"

        # Act
        token = DocumentTokenManager.generate_token(secret, doc_id, user_id, ttl_seconds=600.0)
        payload = DocumentTokenManager.verify_token(token, secret)

        # Assert
        self.assertEqual(payload["doc_id"], "doc_xyz")
        self.assertEqual(payload["user_id"], "user_42")
        self.assertTrue(payload["permissions"]["edit"])

        # Invalid secret rejection
        with self.assertRaises(ValueError):
            DocumentTokenManager.verify_token(token, "wrong_secret")

    def test_visual_diff_engine(self):
        # Arrange
        original = "The quick brown fox jumps"
        modified = "The fast brown fox leaps"

        # Act
        diff = VisualDiffEngine.compute_word_diff(original, modified)

        # Assert
        self.assertIn("[DEL: quick] [INS: fast]", diff)
        self.assertIn("[DEL: jumps] [INS: leaps]", diff)
        self.assertIn("brown fox", diff)

    def test_watermark_spec(self):
        # Arrange
        wm = WatermarkSpec(text="TOP SECRET", color="#FF0000", opacity=0.3)

        # Act
        svg_text = wm.to_svg(width=800, height=600)

        # Assert
        self.assertIn("TOP SECRET", svg_text)
        self.assertIn('fill="#FF0000"', svg_text)
        self.assertIn('fill-opacity="0.3"', svg_text)


if __name__ == "__main__":
    unittest.main()
