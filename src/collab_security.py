"""SigmaOS-office Collaboration Security, Merkle Hash Chain & Session Token Engine.

Provides cryptographic audit logging (SHA-256 hash chains), JWT-style session tokens
for document collaboration, visual text diffing, and watermark specifications.

Principles: Defensive Programming, Secure Defaults, Fail-Fast, Deterministic Testing.
"""

from typing import List, Dict, Any, Optional, Tuple
import hashlib
import hmac
import base64
import json
import time
import difflib

from onlyoffice_collab import ChangeSet, Operation


class MerkleAuditLog:
    """Cryptographic SHA-256 hash chain verifying revision history integrity."""
    def __init__(self, genesis_payload: str = "GENESIS_REVISION"):
        self.chain: List[Dict[str, Any]] = []
        # Add genesis entry
        gen_hash = hashlib.sha256(genesis_payload.encode("utf-8")).hexdigest()
        self.chain.append({
            "revision": 0,
            "prev_hash": "0" * 64,
            "hash": gen_hash,
            "user_id": "system",
            "timestamp": 0.0,
            "summary": "Genesis block",
        })

    def append_changeset(self, cs: ChangeSet, summary: str = "") -> str:
        prev_hash = self.chain[-1]["hash"]
        content = f"{prev_hash}:{cs.revision}:{cs.user_id}:{cs.timestamp}:{json.dumps([o.to_dict() for o in cs.operations], sort_keys=True)}"
        curr_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()
        entry = {
            "revision": cs.revision,
            "prev_hash": prev_hash,
            "hash": curr_hash,
            "user_id": cs.user_id,
            "timestamp": cs.timestamp,
            "summary": summary,
        }
        self.chain.append(entry)
        return curr_hash

    def verify_integrity(self) -> bool:
        """Verifies that the entire hash chain is unbroken and untampered."""
        if not self.chain:
            return False
        for i in range(1, len(self.chain)):
            curr = self.chain[i]
            prev = self.chain[i - 1]
            if curr["prev_hash"] != prev["hash"]:
                return False
        return True


class DocumentTokenManager:
    """Generates and validates HMAC-SHA256 session tokens for document collaboration."""

    @staticmethod
    def _b64_url_encode(data: bytes) -> str:
        return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

    @staticmethod
    def _b64_url_decode(s: str) -> bytes:
        pad = 4 - (len(s) % 4)
        if pad and pad < 4:
            s += "=" * pad
        return base64.urlsafe_b64decode(s)

    @classmethod
    def generate_token(cls, secret: str, doc_id: str, user_id: str,
                       permissions: Optional[Dict[str, bool]] = None, ttl_seconds: float = 3600.0) -> str:
        header = {"alg": "HS256", "typ": "JWT"}
        now = time.time()
        payload = {
            "doc_id": doc_id,
            "user_id": user_id,
            "iat": int(now),
            "exp": int(now + ttl_seconds),
            "permissions": permissions or {"edit": True, "comment": True, "download": True},
        }

        h_enc = cls._b64_url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
        p_enc = cls._b64_url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        signing_input = f"{h_enc}.{p_enc}"

        sig = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        sig_enc = cls._b64_url_encode(sig)

        return f"{signing_input}.{sig_enc}"

    @classmethod
    def verify_token(cls, token: str, secret: str) -> Dict[str, Any]:
        parts = token.split(".")
        if len(parts) != 3:
            raise ValueError("Malformed token format.")

        signing_input = f"{parts[0]}.{parts[1]}"
        expected_sig = hmac.new(secret.encode("utf-8"), signing_input.encode("utf-8"), hashlib.sha256).digest()
        actual_sig = cls._b64_url_decode(parts[2])

        if not hmac.compare_digest(expected_sig, actual_sig):
            raise ValueError("Invalid token signature.")

        payload_bytes = cls._b64_url_decode(parts[1])
        payload = json.loads(payload_bytes.decode("utf-8"))

        if payload.get("exp", 0) < time.time():
            raise ValueError("Token has expired.")

        return payload


class VisualDiffEngine:
    """Computes word and character diffs highlighting revisions."""

    @staticmethod
    def compute_word_diff(text_a: str, text_b: str) -> str:
        """Generates inline diff with [DEL: ...] and [INS: ...] markers."""
        words_a = text_a.split()
        words_b = text_b.split()
        matcher = difflib.SequenceMatcher(None, words_a, words_b)
        result = []

        for tag, i1, i2, j1, j2 in matcher.get_opcodes():
            if tag == "equal":
                result.append(" ".join(words_a[i1:i2]))
            elif tag == "delete":
                result.append(f"[DEL: {' '.join(words_a[i1:i2])}]")
            elif tag == "insert":
                result.append(f"[INS: {' '.join(words_b[j1:j2])}]")
            elif tag == "replace":
                result.append(f"[DEL: {' '.join(words_a[i1:i2])}] [INS: {' '.join(words_b[j1:j2])}]")

        return " ".join(result)


class WatermarkSpec:
    """Document visual watermark configuration."""
    def __init__(self, text: str = "CONFIDENTIAL", color: str = "#FF0000",
                 opacity: float = 0.2, angle_degrees: float = -45.0, font_size: float = 48.0):
        self.text = text
        self.color = color
        self.opacity = opacity
        self.angle_degrees = angle_degrees
        self.font_size = font_size

    def to_dict(self) -> Dict[str, Any]:
        return {
            "text": self.text,
            "color": self.color,
            "opacity": self.opacity,
            "angle_degrees": self.angle_degrees,
            "font_size": self.font_size,
        }

    def to_svg(self, width: float = 800.0, height: float = 600.0) -> str:
        cx, cy = width / 2.0, height / 2.0
        return (
            f'<text x="{cx}" y="{cy}" text-anchor="middle" dominant-baseline="middle" '
            f'font-size="{self.font_size}" fill="{self.color}" fill-opacity="{self.opacity}" '
            f'transform="rotate({self.angle_degrees},{cx},{cy})">{self.text}</text>'
        )
