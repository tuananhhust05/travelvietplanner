import re

# Minimal prompt-injection / jailbreak screen. Full 5-6 layer guardrail per spec-03.
INJECTION_PATTERNS = [
    r"ignore (all|previous|above) instructions",
    r"disregard (the )?(system|previous) prompt",
    r"you are now",
    r"reveal (your )?(system )?prompt",
    r"pretend to be",
    r"bỏ qua (mọi )?(hướng dẫn|chỉ dẫn) (trước|phía trên)",
]

_compiled = [re.compile(p, re.IGNORECASE) for p in INJECTION_PATTERNS]


def screen_input(text: str) -> tuple[bool, str | None]:
    """Return (allowed, reason). Blocks obvious injection attempts."""
    for pat in _compiled:
        if pat.search(text):
            return False, "prompt_injection_detected"
    if len(text) > 4000:
        return False, "input_too_long"
    return True, None
