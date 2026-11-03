"""Reason code → plain-language copy (one table for the whole API; unknown codes get a safe fallback)."""
from fastapi import HTTPException

COPY = {   # reason codes of the common services; each product registers its own (register_copy) at start-up
    "INVALID_CREDENTIALS": "Wrong email or password.", "EMAIL_TAKEN": "That email is already registered.",
    "WEAK_PASSWORD": "Use at least 8 characters.", "INVALID_TOKEN": "This link has expired or was already used.",
    "INVALID_NAME": "Please enter a full name (letters only).", "INVALID_EMAIL": "Enter a valid email address.",
    "INVALID_PHONE": "Enter a valid phone number.", "NOT_ALLOWED": "You can't change this task.",
    "SELF_DEMOTION": "You can't demote yourself.", "LAST_ADMIN": "Keep at least one admin.", "NOT_AN_IMAGE": "That file isn't an image.",
    "TOO_LARGE": "Images must be under 15 MB.", "UNKNOWN_PLACEHOLDER": "Only the listed {placeholders} can be used.",
    "MISSING_FIELD": "Some required details are missing.",
}


def register_copy(extra: dict) -> None:
    """Products add their own reason-code copy; the platform keeps the common ones."""
    COPY.update(extra)


class ApiError(HTTPException):
    def __init__(self, reason: str, status: int = 409, detail: str = ""):
        code = reason or "UNKNOWN"
        message = COPY.get(code) or ("The service didn't answer in time — please try again." if code.endswith("_TIMEOUT") else "Something went wrong. Please try again.")
        from grepx_bff.gateway import CURRENT_TRACE
        super().__init__(status, {"reason": code, "message": message, "detail": detail, "trace_id": CURRENT_TRACE.get()})
