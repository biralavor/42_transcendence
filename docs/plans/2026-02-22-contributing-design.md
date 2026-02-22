# CONTRIBUTING.md Design

**Date**: 2026-02-22
**Status**: Approved

## Purpose

Establish a fast, sustainable git workflow for the ft_transcendence team (4-5 people)
using Trunk Based Development (TBD) with GitHub Issues + PR + automatic branch deletion.

## Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Branch strategy | Trunk Based Development | Fast iterations, minimal long-lived branches |
| TDD | Not included | Stack not finalized; add later |
| Structure | Hybrid (diagram + workflows + cheat-sheet) | Readable once, reusable as quick reference |
| Commit convention | Conventional Commits v1.0.0 | Enables changelogs, clear history |

## Structure

1. Branch Architecture — Mermaid gitGraph + 3-branch rules table
2. Starting New Work — GitHub Issues workflow (create → branch → switch)
3. Submitting Work — git add → commit → push → PR to develop
4. Conventional Commits Cheat-Sheet — type table with examples
5. Sprint & Release Rhythm — weekly cadence, Scrum Master role

## Key Constraints

- `main` is locked; only Scrum Master merges via PR from `develop` at sprint end
- `develop` accepts no direct commits; only PRs from feature branches
- Feature branches must be created through GitHub Issues (ensures unique `#N-` prefix)
- All PRs target `develop`; 1 reviewer minimum
- Every `main` merge → Release tag `vX.Y.Z`
