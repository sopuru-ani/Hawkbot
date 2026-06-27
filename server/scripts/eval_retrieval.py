"""
Run retrieval eval against eval/questions.json.

Usage (from server/):
    python scripts/eval_retrieval.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from dependencies import get_chatbot_service  # noqa: E402


def main() -> int:
    questions_path = SERVER_ROOT / "eval" / "questions.json"
    cases = json.loads(questions_path.read_text(encoding="utf-8"))

    service = get_chatbot_service()
    retriever = service._retriever
    section_router = service._section_router

    hits = 0
    for case in cases:
        query = case["query"]
        expected = case.get("expected_section")
        section = section_router.route([], query)
        result = retriever.retrieve(query, section=section)
        sections = {
            source.title
            for source in result.sources
        }
        section_hit = expected is None or any(
            expected in (chunk_section or "")
            for chunk_section in _sections_from_context(result.context)
        )
        if section_hit:
            hits += 1
        status = "hit" if section_hit else "miss"
        print(f"[{status}] {query}")
        print(f"  routed_section={section}")
        print(f"  sources={list(sections)[:3]}")
        print()

    print(f"Section coverage: {hits}/{len(cases)}")
    return 0


def _sections_from_context(context: str) -> list[str]:
    sections: list[str] = []
    for line in context.splitlines():
        if line.startswith("Section:"):
            sections.append(line.removeprefix("Section:").strip())
    return sections


if __name__ == "__main__":
    raise SystemExit(main())
