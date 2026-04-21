Revise this blueprint so it can pass the next review round.

## Current Lesson Blueprint

```json
{{blueprintJson}}
```

## Reviewer Results

```json
{{reviewerResultsJson}}
```

## Adjudication

```json
{{adjudicationJson}}
```

Revision priorities:
1. Satisfy every `requiredRevisions` instruction.
2. Respect every `preserveConstraints` instruction.
3. Keep the blueprint realistic for the stated learner.
4. Prefer minimal, high-leverage edits over full rewrites.

Return only the revised lesson blueprint JSON object.