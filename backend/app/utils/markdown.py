from markdown_it import MarkdownIt

_MARKDOWN = MarkdownIt("commonmark", {"html": True, "linkify": True, "breaks": True})


def markdown_to_html(markdown: str | None) -> str | None:
    if not markdown or not markdown.strip():
        return None
    html = _MARKDOWN.render(markdown)
    return html.strip() if html else None
