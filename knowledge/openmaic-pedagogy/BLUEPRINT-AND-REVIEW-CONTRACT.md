# Blueprint and Review Contract Draft

## Purpose

This draft defines the planning contract that should exist before OpenMAIC expands a lesson into full scenes, scripts, and media.

The aim is to move from a loose scene-outline stage to a reviewed lesson blueprint that can be approved, revised, or rejected.

## Design principles

- Keep the first-pass output inspectable
- Make pedagogical intent explicit, not implicit
- Separate planning from elaboration
- Allow critique before expensive multi-step generation
- Preserve enough structure that downstream generation cannot silently destroy the learning design

## Proposed lesson blueprint shape

```json
{
  "lessonBlueprint": {
    "lessonIntent": {
      "topic": "string",
      "targetLearner": {
        "level": "string",
        "program": "string",
        "context": "string"
      },
      "lessonMode": "concept|skill|exam_prep|project|case|mixed",
      "durationMinutes": 45,
      "languageDirective": "string"
    },
    "outcomes": [
      {
        "id": "lo_1",
        "statement": "string",
        "type": "knowledge|skill|judgment|reflection",
        "priority": "core|supporting"
      }
    ],
    "prerequisites": [
      {
        "id": "pre_1",
        "statement": "string",
        "required": true,
        "canBeActivatedInLesson": false
      }
    ],
    "themeGraph": [
      {
        "id": "theme_1",
        "title": "string",
        "dependsOn": ["theme_0"],
        "rationale": "string"
      }
    ],
    "scenePlan": [
      {
        "id": "scene_1",
        "title": "string",
        "type": "slide|quiz|interactive|pbl",
        "order": 1,
        "themeIds": ["theme_1"],
        "learningObjectiveIds": ["lo_1"],
        "description": "string",
        "keyPoints": ["string"],
        "pedagogicalRole": {
          "merrillPhase": "problem|activation|demonstration|application|integration",
          "instructionalMove": "introduce|model|guided_practice|independent_practice|reflection|assessment|transfer",
          "assessmentRole": "none|diagnostic|formative|summative",
          "soloDepth": "prestructural|unistructural|multistructural|relational|extended_abstract"
        },
        "scaffolding": {
          "buildsOnSceneIds": ["scene_0"],
          "supportLevel": "high|medium|low",
          "workedExample": true,
          "commonMisconceptions": ["string"]
        },
        "reflectionDesign": {
          "reflectionInAction": false,
          "reflectionOnAction": true,
          "reframingPrompt": "string or null",
          "judgmentPoint": "string or null"
        },
        "factualRisk": {
          "riskLevel": "low|medium|high",
          "claimsNeedingReview": ["string"]
        },
        "estimatedMinutes": 4
      }
    ]
  }
}
```

## Why this is stronger than the current SceneOutline

The current outline mainly captures:
- type,
- title,
- description,
- key points,
- some scene-specific config.

The proposed blueprint adds explicit visibility into:
- outcomes,
- prerequisites,
- theme relationships,
- pedagogical role,
- scaffolding logic,
- reflective-practice intent,
- and factual risk.

## Proposed review outputs

Each reviewer should return structured results instead of loose prose.

### SME review

```json
{
  "reviewer": "sme",
  "verdict": "pass|revise|fail",
  "overallScore": 4,
  "dimensionScores": {
    "factualCorrectness": 4,
    "conceptDecomposition": 3,
    "prerequisiteOrdering": 4,
    "terminology": 5,
    "curriculumFit": 3
  },
  "issues": [
    {
      "severity": "critical|major|minor",
      "scope": "lesson|theme|scene",
      "targetId": "scene_4",
      "type": "missing_prerequisite|incorrect_claim|misleading_example|terminology|scope_gap",
      "message": "string",
      "suggestedRevision": "string"
    }
  ]
}
```

### Merrill review

```json
{
  "reviewer": "merrill",
  "verdict": "pass|revise|fail",
  "overallScore": 4,
  "dimensionScores": {
    "problemCentered": 3,
    "activation": 4,
    "demonstration": 4,
    "application": 2,
    "integration": 2,
    "scaffoldingCoherence": 3
  },
  "issues": [
    {
      "severity": "major",
      "scope": "scene",
      "targetId": "scene_6",
      "type": "missing_application",
      "message": "Learners are told the concept but do not apply it.",
      "suggestedRevision": "Add a guided troubleshooting task before the summary scene."
    }
  ]
}
```

### Schön review

```json
{
  "reviewer": "schon",
  "verdict": "pass|revise|fail",
  "overallScore": 3,
  "dimensionScores": {
    "reflectionInAction": 2,
    "reflectionOnAction": 4,
    "reframing": 2,
    "judgmentPractice": 3,
    "actionFeedbackLoop": 2
  },
  "issues": [
    {
      "severity": "major",
      "scope": "lesson",
      "targetId": "lesson",
      "type": "weak_reflective_loop",
      "message": "The learner receives explanations but has little opportunity to interpret outcomes and revise decisions.",
      "suggestedRevision": "Introduce a scenario where the learner adjusts a cloud setting, observes consequences, and justifies the next action."
    }
  ]
}
```

## Adjudication contract

After the individual reviews, an adjudication layer should produce one combined result.

```json
{
  "verdict": "pass|revise|fail",
  "releaseForSceneGeneration": false,
  "blockingIssues": ["issue_id_1"],
  "requiredRevisions": [
    {
      "targetId": "scene_6",
      "instruction": "Insert an application scene before final reflection."
    }
  ],
  "preserveConstraints": [
    "Keep theme order intact",
    "Do not remove outcome lo_2",
    "Retain diagnostic quiz before theme_3"
  ],
  "summary": "string"
}
```

## Pass / revise / fail interpretation

### Pass
- No critical issues
- The blueprint is acceptable for full generation
- Minor issues may remain as non-blocking notes

### Revise
- The blueprint is promising but must be corrected before expansion
- The system should attempt targeted revision
- Re-review may be required after revision

### Fail
- The blueprint is not safe or coherent enough to expand
- A deeper regeneration of the blueprint is required

## Contract for downstream generation

After approval, downstream generation should be allowed to elaborate but not to silently change:
- major themes,
- sequence,
- outcomes,
- assessment intent,
- scaffolding progression,
- or required reflective moments.

## Cloud-infrastructure implications

For the second-year vocational cloud target, the blueprint should eventually support fields such as:
- troubleshooting context,
- operational decision points,
- security and compliance relevance,
- user/business need framing,
- tool familiarity expectations,
- and explicit practical reasoning moments.

## Immediate implementation implication

The safest first implementation slice is probably:
1. keep the existing `SceneOutline` flow,
2. generate a richer wrapper blueprint around it,
3. add the review gate,
4. only then strengthen downstream contract enforcement.
