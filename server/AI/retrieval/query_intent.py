import re

LIST_INTENT_PATTERN = re.compile(
    r"\b("
    r"list|all|every|each|enumerate|complete|full list|"
    r"what are they|name them|show me|which ones|"
    r"how many|programs?|majors?|degrees?|courses?|"
    r"housing|communities|options"
    r")\b",
    re.IGNORECASE,
)


def is_list_intent(query: str) -> bool:
    return bool(LIST_INTENT_PATTERN.search(query))
