"""Minimal EPUB reader. Stdlib only — no third-party dependencies.

An EPUB is a ZIP archive of XHTML + images. This module:
- finds the .epub files in a directory,
- identifies the "official" (publisher) EPUB vs an alternate copy,
- reads entries as text/bytes,
- parses XHTML entries with the XML namespace stripped for easy lookups.

Used only at development time (Phase 2). Never part of the deployed web app.
"""
from __future__ import annotations

import glob
import os
import zipfile
import xml.etree.ElementTree as ET


def _strip_ns(tag: str) -> str:
    return tag.rsplit("}", 1)[-1] if tag.startswith("{") else tag


class EpubReader:
    def __init__(self, path: str):
        self.path = path
        self._zip = zipfile.ZipFile(path)

    def names(self) -> list[str]:
        return [n for n in self._zip.namelist() if not n.endswith("/")]

    def read(self, name: str) -> str:
        return self._zip.read(name).decode("utf-8")

    def read_bytes(self, name: str) -> bytes:
        return self._zip.read(name)

    def parse_xhtml(self, name: str) -> ET.Element:
        """Parse an XHTML entry; strip the namespace from all tags so that
        class/id lookups are straightforward."""
        root = ET.fromstring(self.read(name))
        for el in root.iter():
            el.tag = _strip_ns(el.tag)
        return root

    def close(self) -> None:
        self._zip.close()

    def __enter__(self) -> "EpubReader":
        return self

    def __exit__(self, *exc) -> None:
        self.close()


def find_epubs(directory: str) -> list[str]:
    return sorted(glob.glob(os.path.join(directory, "*.epub")))


def primary_epub(directory: str) -> str:
    """Pick the publisher EPUB: the Premium Fourth Edition (2020). Its filename
    mentions '4th' or the ISBN 9781260463156; otherwise fall back to the largest
    file."""
    epubs = find_epubs(directory)
    if not epubs:
        raise FileNotFoundError(f"No .epub files found in {directory}")
    for path in epubs:
        base = os.path.basename(path).lower()
        if "4th" in base or "9781260463156" in base:
            return path
    return max(epubs, key=os.path.getsize)
