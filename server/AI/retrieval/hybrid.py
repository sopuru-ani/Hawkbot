def reciprocal_rank_fusion(
    ranked_lists: list[list[str]],
    k: int = 60,
) -> list[str]:
    scores: dict[str, float] = {}
    for ranked_ids in ranked_lists:
        for rank, embedding_id in enumerate(ranked_ids):
            scores[embedding_id] = scores.get(embedding_id, 0.0) + 1.0 / (k + rank + 1)

    return sorted(scores.keys(), key=lambda embedding_id: scores[embedding_id], reverse=True)
