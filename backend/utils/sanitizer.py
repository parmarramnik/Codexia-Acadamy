"""
Sanitization utility — inputs sanitization to prevent Cross-Site Scripting (XSS).
"""

import re


def sanitize_html(html_str: str) -> str:
    """
    Strips script tags, inline event handlers, and javascript pseudo-protocols.
    Preserves harmless HTML tags for rich-text input.
    """
    if not html_str or not isinstance(html_str, str):
        return html_str

    # Remove script blocks
    clean = re.sub(r"<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>", "", html_str, flags=re.IGNORECASE)
    
    # Remove inline event handlers (e.g. onclick, onerror, onload)
    clean = re.sub(r"\bon[a-z]+\s*=\s*(['\"]).*?\1", "", clean, flags=re.IGNORECASE)
    clean = re.sub(r"\bon[a-z]+\s*=\s*[^'\s\"]+", "", clean, flags=re.IGNORECASE)
    
    # Remove javascript: pseudo-protocol URIs
    clean = re.sub(r"href\s*=\s*(['\"])javascript:.*?\1", "href='#change-me'", clean, flags=re.IGNORECASE)
    clean = re.sub(r"src\s*=\s*(['\"])javascript:.*?\1", "src=''", clean, flags=re.IGNORECASE)
    
    return clean


def sanitize_plain_text(text: str) -> str:
    """Strips all HTML tags completely for normal text fields."""
    if not text or not isinstance(text, str):
        return text
    # Replace HTML tags with empty string
    clean = re.sub(r"<[^>]*>", "", text)
    return clean
