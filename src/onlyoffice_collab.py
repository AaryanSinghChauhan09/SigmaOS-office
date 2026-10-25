"""SigmaOS-office OnlyOffice Collaboration Engine (OnlyOffice / Etherpad / OT inspired).

Provides multi-user change-set representation, operational transformation (OT) rebasing,
threaded comment system, user cursor presence, and optimistic/pessimistic block locks.

Principles: Safe Concurrency, Race-Free Design, Deterministic Testing, Low Coupling.
"""

from typing import List, Dict, Any, Optional, Tuple
import time
import json


class Operation:
    """Atomic text/structure mutation operation."""
    INSERT = "insert"
    DELETE = "delete"
    RETAIN = "retain"
    FORMAT = "format"

    def __init__(self, op_type: str, position: int, text: str = "", length: int = 0,
                 attributes: Optional[Dict[str, Any]] = None):
        self.op_type = op_type
        self.position = position
        self.text = text
        self.length = length if length > 0 else len(text)
        self.attributes = attributes or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "op": self.op_type,
            "pos": self.position,
            "text": self.text,
            "len": self.length,
            "attrs": self.attributes,
        }


class ChangeSet:
    """Set of operations submitted by a user at a specific revision."""
    def __init__(self, revision: int, user_id: str, operations: Optional[List[Operation]] = None,
                 timestamp: Optional[float] = None):
        self.revision = revision
        self.user_id = user_id
        self.operations = operations or []
        self.timestamp = timestamp or time.time()

    def add_operation(self, op: Operation) -> None:
        self.operations.append(op)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "revision": self.revision,
            "user_id": self.user_id,
            "operations": [o.to_dict() for o in self.operations],
            "timestamp": self.timestamp,
        }


class OperationalTransform:
    """Transforms concurrent operations against each other to preserve intent."""

    @staticmethod
    def transform_op(op_a: Operation, op_b: Operation) -> Tuple[Operation, Operation]:
        """Transforms op_a against concurrent op_b (where op_b happened first)."""
        new_a_pos = op_a.position
        new_b_pos = op_b.position

        if op_b.op_type == Operation.INSERT:
            if op_a.position > op_b.position:
                new_a_pos += op_b.length
            elif op_a.position == op_b.position and op_a.op_type == Operation.INSERT:
                # Deterministic tie-breaker
                new_a_pos += op_b.length

        elif op_b.op_type == Operation.DELETE:
            if op_a.position >= op_b.position + op_b.length:
                new_a_pos -= op_b.length
            elif op_a.position > op_b.position:
                new_a_pos = op_b.position

        trans_a = Operation(op_a.op_type, new_a_pos, op_a.text, op_a.length, op_a.attributes)
        trans_b = Operation(op_b.op_type, new_b_pos, op_b.text, op_b.length, op_b.attributes)
        return trans_a, trans_b

    @staticmethod
    def apply_to_text(initial_text: str, operations: List[Operation]) -> str:
        """Applies an ordered sequence of operations to a string."""
        buf = list(initial_text)
        # Apply in reverse position order if deleting/inserting independently or sequential
        # For simplicity and determinism, process linearly with offset accumulation
        sorted_ops = sorted(operations, key=lambda o: o.position, reverse=True)
        for op in sorted_ops:
            if op.op_type == Operation.INSERT:
                buf[op.position:op.position] = list(op.text)
            elif op.op_type == Operation.DELETE:
                del buf[op.position:op.position + op.length]
        return "".join(buf)


class CommentReply:
    def __init__(self, reply_id: str, author_id: str, author_name: str, text: str,
                 timestamp: Optional[float] = None):
        self.reply_id = reply_id
        self.author_id = author_id
        self.author_name = author_name
        self.text = text
        self.timestamp = timestamp or time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "reply_id": self.reply_id,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "text": self.text,
            "timestamp": self.timestamp,
        }


class CommentThread:
    """Threaded annotation anchored to a document element."""
    def __init__(self, thread_id: str, anchor_id: str, author_id: str, author_name: str,
                 text: str, resolved: bool = False, timestamp: Optional[float] = None):
        self.thread_id = thread_id
        self.anchor_id = anchor_id
        self.author_id = author_id
        self.author_name = author_name
        self.text = text
        self.resolved = resolved
        self.timestamp = timestamp or time.time()
        self.replies: List[CommentReply] = []

    def add_reply(self, reply: CommentReply) -> None:
        self.replies.append(reply)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "thread_id": self.thread_id,
            "anchor_id": self.anchor_id,
            "author_id": self.author_id,
            "author_name": self.author_name,
            "text": self.text,
            "resolved": self.resolved,
            "timestamp": self.timestamp,
            "replies": [r.to_dict() for r in self.replies],
        }


class UserPresence:
    """Collaborator cursor position and presence telemetry."""
    def __init__(self, user_id: str, name: str, color: str = "#4CAF50",
                 cursor_element: int = 0, cursor_offset: int = 0):
        self.user_id = user_id
        self.name = name
        self.color = color
        self.cursor_element = cursor_element
        self.cursor_offset = cursor_offset
        self.last_seen = time.time()

    def update_cursor(self, element_idx: int, offset: int) -> None:
        self.cursor_element = element_idx
        self.cursor_offset = offset
        self.last_seen = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "user_id": self.user_id,
            "name": self.name,
            "color": self.color,
            "cursor": {
                "element": self.cursor_element,
                "offset": self.cursor_offset,
            },
            "last_seen": self.last_seen,
        }


class DocumentLockManager:
    """Pessimistic section lock manager and revision sequencer."""
    def __init__(self):
        self.current_revision = 0
        self.section_locks: Dict[str, Tuple[str, float]] = {}  # section_id -> (user_id, expiry)
        self.threads: Dict[str, CommentThread] = {}
        self.active_users: Dict[str, UserPresence] = {}

    def acquire_lock(self, section_id: str, user_id: str, ttl_seconds: float = 30.0) -> bool:
        now = time.time()
        if section_id in self.section_locks:
            owner, expiry = self.section_locks[section_id]
            if owner != user_id and expiry > now:
                return False  # Locked by another user
        self.section_locks[section_id] = (user_id, now + ttl_seconds)
        return True

    def release_lock(self, section_id: str, user_id: str) -> bool:
        if section_id in self.section_locks:
            owner, _ = self.section_locks[section_id]
            if owner == user_id:
                del self.section_locks[section_id]
                return True
        return False

    def is_locked(self, section_id: str) -> bool:
        if section_id not in self.section_locks:
            return False
        _, expiry = self.section_locks[section_id]
        return expiry > time.time()

    def add_comment(self, thread: CommentThread) -> None:
        self.threads[thread.thread_id] = thread

    def update_presence(self, presence: UserPresence) -> None:
        self.active_users[presence.user_id] = presence
