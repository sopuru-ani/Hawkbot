import re
from dataclasses import dataclass
from urllib.parse import urlparse

from tavily import TavilyClient

from AI.retrieval.retriever import Source

_URL_PATTERN = re.compile(r"https?://[^\s<>\"{}|\\^`\[\]]+", re.IGNORECASE)


@dataclass(frozen=True)
class WebSearchResult:
    context: str
    sources: list[Source]


def extract_urls(text: str) -> list[str]:
    seen: set[str] = set()
    urls: list[str] = []
    for match in _URL_PATTERN.findall(text):
        url = match.rstrip(".,);]")
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


class TavilyWebSearch:
    def __init__(self, api_key: str, max_results: int = 5) -> None:
        self._client = TavilyClient(api_key=api_key)
        self._max_results = max_results

    def search(self, query: str) -> WebSearchResult:
        data = self._client.search(
            query=query,
            max_results=self._max_results,
            include_answer=False,
        )
        return self._format_search_results(data.get("results", []))

    def extract_urls(
        self, urls: list[str], *, query: str | None = None
    ) -> WebSearchResult:
        kwargs: dict = {"urls": urls, "extract_depth": "basic"}
        if query:
            kwargs["query"] = query
        data = self._client.extract(**kwargs)
        return self._format_extract_results(data.get("results", []), urls)

    def _format_search_results(self, results: list[dict]) -> WebSearchResult:
        sources: list[Source] = []
        blocks: list[str] = []

        for item in results:
            title = item.get("title") or "Untitled"
            url = item.get("url") or ""
            content = item.get("content") or ""
            sources.append(Source(title=title, url=url))
            blocks.append(f"### {title}\n{url}\n\n{content}")

        return WebSearchResult(context="\n\n---\n\n".join(blocks), sources=sources)

    def _format_extract_results(
        self, results: list[dict], requested_urls: list[str]
    ) -> WebSearchResult:
        sources: list[Source] = []
        blocks: list[str] = []

        for item in results:
            url = item.get("url") or ""
            content = item.get("raw_content") or ""
            title = self._title_from_url(url)
            sources.append(Source(title=title, url=url))
            blocks.append(f"### {title}\n{url}\n\n{content}")

        if not blocks:
            for url in requested_urls:
                title = self._title_from_url(url)
                sources.append(Source(title=title, url=url))
                blocks.append(f"### {title}\n{url}\n\n(No content could be extracted.)")

        return WebSearchResult(context="\n\n---\n\n".join(blocks), sources=sources)

    def _title_from_url(self, url: str) -> str:
        path = urlparse(url).path.rstrip("/")
        if path:
            segment = path.split("/")[-1].replace("-", " ").replace("_", " ")
            if segment:
                return segment
        return urlparse(url).netloc or url
