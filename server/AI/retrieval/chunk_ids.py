import re

CHUNK_ID_PATTERN = re.compile(r"^(?P<filename>.+)__chunk_(?P<chunk_number>\d+)$")


def parse_chunk_id(embedding_id: str) -> tuple[str, int] | None:
    match = CHUNK_ID_PATTERN.match(embedding_id)
    if not match:
        return None
    return match.group("filename"), int(match.group("chunk_number"))


def build_chunk_id(filename: str, chunk_number: int) -> str:
    return f"{filename}__chunk_{chunk_number}"


def neighbor_chunk_ids(embedding_id: str, radius: int) -> list[str]:
    parsed = parse_chunk_id(embedding_id)
    if parsed is None or radius < 1:
        return []

    filename, chunk_number = parsed
    neighbors: list[str] = []
    for offset in range(-radius, radius + 1):
        if offset == 0:
            continue
        number = chunk_number + offset
        if number < 0:
            continue
        neighbors.append(build_chunk_id(filename, number))
    return neighbors
