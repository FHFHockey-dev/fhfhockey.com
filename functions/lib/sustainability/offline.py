"""Fail-closed boundary for the offline Python Sustainability implementation."""
from typing import NoReturn


class OfflinePersistenceDisabledError(RuntimeError):
    """Raised when Python Sustainability code attempts a production operation."""


OFFLINE_PERSISTENCE_MESSAGE = (
    "Python Sustainability persistence is retired; use the canonical "
    "TypeScript/Supabase Sustainability pipeline."
)


def reject_persistence() -> NoReturn:
    raise OfflinePersistenceDisabledError(OFFLINE_PERSISTENCE_MESSAGE)


__all__ = [
    "OFFLINE_PERSISTENCE_MESSAGE",
    "OfflinePersistenceDisabledError",
    "reject_persistence",
]
