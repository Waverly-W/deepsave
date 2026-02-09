import jieba


def tokenize_text(text: str | None) -> str | None:
    if not text:
        return None

    tokens = [token.strip() for token in jieba.cut(text) if token.strip()]
    if not tokens:
        return None

    return " ".join(tokens)
