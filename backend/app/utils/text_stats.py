import re

CJK_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")
WORD_PATTERN = re.compile("[A-Za-z0-9]+(?:['\\u2019][A-Za-z0-9]+)?")


def count_text_stats(text: str | None) -> tuple[int | None, int | None]:
    if not text or not text.strip():
        return None, None

    word_count = len(WORD_PATTERN.findall(text))
    char_count = len(CJK_PATTERN.findall(text))

    return word_count, char_count
