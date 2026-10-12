"""Heading-aware, overlapping chunking."""

import re
from dataclasses import dataclass
from typing import Optional

from config import settings

_HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
_PAGE_RE = re.compile(r"^\[Page (\d+)\]$")
_SENTENCE_END_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass
class Chunk:
    index: int
    text: str
    section: Optional[str]


def _sections(text: str) -> list[tuple[Optional[str], str]]:
    """Split text into (section label, body) at Markdown headings and PDF page markers."""
    sections: list[tuple[Optional[str], list[str]]] = [(None, [])]
    heading: Optional[str] = None
    page: Optional[str] = None
    for line in text.split("\n"):
        page_match = _PAGE_RE.match(line.strip())
        if page_match:
            page = f"Page {page_match.group(1)}"
            sections.append((" · ".join(x for x in (heading, page) if x), []))
            continue
        heading_match = _HEADING_RE.match(line)
        if heading_match:
            heading = heading_match.group(2)[:200]
            sections.append((" · ".join(x for x in (heading, page) if x), []))
            continue
        sections[-1][1].append(line)
    return [(label, "\n".join(lines).strip()) for label, lines in sections if "\n".join(lines).strip()]


def _split_long(body: str, size: int, overlap: int) -> list[str]:
    """Pack paragraphs/sentences into windows of ~size chars, carrying `overlap` chars into the next one."""
    units: list[str] = []
    for paragraph in re.split(r"\n\s*\n", body):
        paragraph = paragraph.strip()
        if not paragraph:
            continue
        if len(paragraph) <= size:
            units.append(paragraph)
            continue
        for sentence in _SENTENCE_END_RE.split(paragraph):
            while len(sentence) > size:  # a single enormous sentence/line: hard split
                units.append(sentence[:size])
                sentence = sentence[size - overlap:]
            if sentence.strip():
                units.append(sentence.strip())

    windows: list[str] = []
    current = ""
    for unit in units:
        candidate = f"{current}\n\n{unit}".strip() if current else unit
        if len(candidate) <= size or not current:
            current = candidate
            continue
        windows.append(current)
        # The carried-over tail must leave room for the next unit so a window never exceeds `size`.
        room = min(overlap, size - len(unit) - 2)
        tail = current[-room:] if room > 0 else ""
        # Start the next window on a word boundary so the overlap does not begin mid-word.
        tail = tail[tail.find(" ") + 1:] if " " in tail else tail
        current = f"{tail}\n\n{unit}".strip() if tail else unit
    if current.strip():
        windows.append(current)
    return windows


def chunk_text(text: str, size: Optional[int] = None, overlap: Optional[int] = None) -> list[Chunk]:
    size = size or settings.RAG_CHUNK_CHARS
    overlap = settings.RAG_CHUNK_OVERLAP if overlap is None else overlap
    overlap = min(overlap, size // 2)
    chunks: list[Chunk] = []
    for label, body in _sections(text):
        for window in _split_long(body, size, overlap):
            chunks.append(Chunk(index=len(chunks), text=window, section=label))
    return chunks
