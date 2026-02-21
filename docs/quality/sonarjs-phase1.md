# SonarJS Rollout - Phase 1 Baseline

Date: 2026-02-21

## Scope

Phase 1 captures the current lint baseline, classifies priorities, and defines the initial SonarJS rule set for staged rollout.

## Baseline Snapshot

- Baseline file: `docs/quality/baselines/eslint-baseline-current.json`
- Summary: `docs/quality/eslint-baseline-summary.md`
- Current totals:
- 37 files with messages
- 83 total warnings
- 0 errors

Top current rule counts:
- `complexity`: 36
- `@next/next/no-img-element`: 18
- `sonarjs/cognitive-complexity`: 16
- `max-lines`: 11

## Rule Priority Classification

Safety / bug-risk (highest first):
- `@typescript-eslint/no-unused-vars` (can hide defects and dead paths)
- `sonarjs/no-identical-functions` (duplicate logic drift risk)
- `sonarjs/no-duplicated-branches` (high chance of copy/paste bugs)

Readability / maintainability:
- `sonarjs/cognitive-complexity`
- `complexity`
- `max-lines`
- `sonarjs/no-collapsible-if`

Style / performance-policy:
- `@next/next/no-img-element`

## Initial SonarJS Set (staged)

Enabled now:
- `sonarjs/cognitive-complexity` = `warn` (threshold 15)

Selected next set for controlled activation:
- `sonarjs/no-duplicated-branches`
- `sonarjs/no-identical-functions`
- `sonarjs/no-collapsible-if`

All selected rules should start as `warn` and only gate on changed files in the next phase.

## Regeneration Commands

Run baseline + summary:

```bash
npm run lint:baseline:refresh
```

This writes:
- `docs/quality/baselines/eslint-baseline-current.json`
- `docs/quality/eslint-baseline-summary.md`
