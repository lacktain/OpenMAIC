Adjudicate these review results conservatively.

## Lesson Blueprint

```json
{{blueprintJson}}
```

## Reviewer Results

```json
{{reviewerResultsJson}}
```

## Heuristic Adjudication Draft

```json
{{heuristicAdjudicationJson}}
```

Use pass / revise / fail deliberately. If revision is enough, prefer `revise` over `fail`. If safety, sequencing, or coherence are too weak for a light repair, use `fail`.

Return only the JSON adjudication object.