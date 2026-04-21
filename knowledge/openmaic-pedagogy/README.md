# Pedagogical Improvement Track for OpenMAIC

## Purpose

This working branch explores how to improve OpenMAIC so lesson generation is governed by explicit pedagogical design and quality review before full scene generation.

The target direction is not just better-looking AI lessons, but lessons that are:
- factually safer,
- pedagogically structured,
- scaffolded coherently,
- reflective where appropriate,
- and suitable for a second-year vocational cloud-infrastructure student.

## Current understanding of OpenMAIC

OpenMAIC already has a natural first-pass generation stage:
1. User requirement -> scene outline generation
2. Scene outline -> detailed scene content and actions
3. Optional media, TTS, persistence

This means the correct intervention point is before detailed scene generation, at the outline / blueprint stage.

## Problem statement

OpenMAIC currently appears to lack a strong pre-generation quality gate for:
- subject-matter correctness,
- pedagogical structure,
- scaffolding quality,
- and reflective learning design.

At the moment, the chosen LLM largely determines:
- how many scenes are created,
- which themes and subthemes are included,
- how topics are decomposed,
- where quizzes appear,
- and how progression is structured.

That is flexible, but it does not yet match the quality expectations of a curriculum-based, educator-reviewed learning resource.

## Target architecture

### Phase A: Learner and lesson framing
Generate or infer:
- learner profile,
- domain,
- target level,
- time scope,
- intended outcomes,
- prerequisite assumptions,
- lesson mode (concept learning, skills training, exam prep, professional judgment, etc.)

### Phase B: Pedagogical outline blueprint
Generate a first-pass lesson blueprint containing:
- major themes,
- subthemes,
- prerequisite relationships,
- sequence rationale,
- intended learning outcomes,
- assessment intentions,
- scene roles,
- scaffolding plan.

### Phase C: Pre-generation review gate
Review the blueprint before full scene generation using three lenses.

#### 1. SME review
Purpose: factual soundness and correct topic decomposition.

Checks:
- factual correctness,
- correct terminology,
- accurate prerequisite ordering,
- missing core concepts,
- misleading simplifications,
- weak or incorrect analogies,
- curriculum-level appropriateness.

#### 2. Merrill review
Purpose: ensure the lesson follows strong instructional structure.

Checks:
- problem-centeredness,
- activation of prior knowledge,
- demonstration,
- application,
- integration / transfer.

#### 3. Schön review
Purpose: ensure reflective learning is built into the path where appropriate.

Checks:
- reflection-in-action,
- reflection-on-action,
- framing and reframing,
- action-feedback-reflection loops,
- opportunities for learner judgment and interpretation.

### Phase D: Approved blueprint as contract
Only an approved blueprint should proceed to full scene generation.

Detailed scene generation may enrich the lesson, but should not silently alter:
- core sequence,
- major theme structure,
- learning outcomes,
- assessment intent,
- or scaffolding plan.

## Quality ambition

The ambition is for generated lessons to move toward the quality bar of a high-school-level curriculum resource reviewed by authors and educators.

This does not imply full equivalence to peer review, but it does imply:
- explicit review roles,
- revision loops,
- evidence-aware factual checking,
- and better pedagogical contracts before expansion.

## Model strategy hypothesis

A later implementation may use different models for different review roles, for example:
- one model for structured outline normalization,
- one for logical decomposition critique,
- one for evidence-aware factual review,
- and one adjudication step for final pass / revise / fail.

The design principle is role separation, not model brand preference.

## Curriculum alignment target

Final target:
OpenMAIC should become an online learning tool aligned with the earlier 19-week cloud-infrastructure content for a second-year vocational student.

This means the eventual system must support:
- week-by-week structure,
- concept and skill progression,
- vocational realism,
- lab and troubleshooting thinking,
- reflection on operational decisions,
- and assessment patterns suited to cloud-infrastructure learning.

## Near-term work plan

1. Define the blueprint schema and review criteria
2. Identify where the new blueprint and review gate fit in the current codebase
3. Implement the first outline-stage quality gate
4. Add tests for pass / revise / fail behavior
5. Tune the system against the cloud-infrastructure curriculum material

## Constraints for this track

- Keep work in this separate folder / branch
- Document changes continuously
- Prefer incremental, reviewable changes
- Treat the current upstream OpenMAIC structure as the compatibility baseline
