# GitHub Projects — Board Guide

This project uses **one shared GitHub Project board** for the whole team.
Squad focus is achieved through the `Squad` custom field and board filtering — no separate boards needed.

---

## Squads

| Squad | Label | Responsibility |
|-------|-------|----------------|
| **Database** | `DB` | Schema design, migrations, ORM models, query optimisation |
| **Backend** | `BE` | API endpoints, business logic, auth, WebSockets, services |
| **Frontend** | `FE` | UI components, pages, API integration, routing, styling |

Team members may belong to more than one squad — assign the `Squad` field accordingly.
When an Issue spans multiple squads, create one Issue per squad (see [Cross-Squad Issues](#cross-squad-issues)).

---

## Feature Flow

New features follow a sequential dependency across squads:

```
Database → Backend → Frontend
```

> A backend Issue that depends on a schema change must wait for the DB Issue to be merged first.
> A frontend Issue that depends on an endpoint must wait for the BE Issue to be merged first.
>
> Use GitHub's **"blocked by"** reference in the Issue body to make dependencies explicit:
> ```
> Blocked by #12 (DB: add users table migration)
> ```

---

## Board Columns

Each board uses the same five columns:

| Column | Meaning | Moves here when |
|--------|---------|-----------------|
| `Backlog` | Exists, not in current sprint | Issue created |
| `Ready` | Assigned to this sprint, not started | Added to sprint milestone |
| `In Progress` | Branch created, work active | Developer starts the branch |
| `In Review` | PR opened and linked to Issue | PR submitted |
| `Done` | Merged and closed | PR merged to `develop` *(automated)* |

### Automation

Two independent mechanisms handle status transitions:

| Trigger | Mechanism | Effect |
|---------|-----------|--------|
| PR opened against `develop` | GitHub Projects built-in workflow | PR item moves to **In Review** |
| PR merged into `develop` | GitHub Projects built-in workflow | PR item moves to **Done** |
| PR merged into `develop` with a linked Issue | `.github/workflows/close-issue-on-merge-to-develop.yml` | Linked Issue is closed |

> **Column moves** are handled by GitHub Projects built-in workflow rules triggered by PR events — no action needed from you.
> **Issue closing** is handled by `.github/workflows/close-issue-on-merge-to-develop.yml` via GitHub's `closingIssuesReferences` GraphQL field, which captures issues linked either through closing keywords (`Closes #N`, `Fixes #N`, `Resolves #N`) in the PR body **or** via the Development sidebar.
> If no issue is linked by either method, the PR card moves to **Done** but no Issue is closed.

---

## Sprint Schedule

| Sprint | Start | End | Milestone |
|--------|-------|-----|-----------|
| Sprint 01 | 2026-02-21 | 2026-02-27 | `Sprint 01` |
| Sprint 02 | 2026-02-28 | 2026-03-06 | `Sprint 02` |
| Sprint 03 | 2026-03-07 | 2026-03-13 | `Sprint 03` |
| Sprint 04 | 2026-03-14 | 2026-03-20 | `Sprint 04` |
| Sprint 05 | 2026-03-21 | 2026-03-27 | `Sprint 05` |
| Sprint 06 | 2026-03-28 | 2026-04-03 | `Sprint 06` |
| Sprint 07 | 2026-04-04 | 2026-04-10 | `Sprint 07` |
| Sprint 08 | 2026-04-11 | 2026-04-17 | `Sprint 08` |
| Sprint 09 | 2026-04-18 | 2026-04-24 | `Sprint 09` |
| Sprint 10 | 2026-04-25 | 2026-05-01 | `Sprint 10` |

- Every sprint starts **Saturday** and ends **Friday**.
- The Scrum Master merges `develop` → `main` on **Friday** and tags a release.
- Sprint 01 started on kick-off day (2026-02-21).

---

## Milestones

Two levels of milestones run in parallel:

### Sprint Milestones
One per sprint (see table above). Assign every Issue to its target sprint.
The milestone progress bar (open vs closed Issues) is the closest equivalent to a burndown chart.

### Phase Milestones

| Milestone | Target | Description |
|-----------|--------|-------------|
| `MVP` | Sprint 05 | Core game playable end-to-end — minimum viable for evaluation |
| `Feature Complete` | Sprint 08 | All selected modules implemented and integrated |
| `Submission` | Sprint 10 | Final polish, documentation, evaluation-ready |

> An Issue supports only one milestone at a time.
> Use sprint milestones for day-to-day planning.
> Use phase milestone labels (`MVP`, `Feature Complete`, `Submission`) as **Labels** on Issues
> to track the bigger picture without replacing the sprint milestone.

---

## Linking an Issue to the Project

Every Issue must be linked to the project and assigned a sprint. Priority and Size are strongly recommended.

### On the Issue creation page (right sidebar)

| Field | Where | Requirement | Action |
|-------|-------|-------------|--------|
| Project | **Projects** | ✅ Required | Select `42 Transcendence` |
| Sprint | **Milestone** | ✅ Required | Select the sprint you plan to start work on — e.g. `Sprint 03` |
| Priority | **Projects fields** | ⭐ Recommended | `High` · `Medium` · `Low` |
| Size | **Projects fields** | ⭐ Recommended | `XS` · `S` · `M` · `L` · `XL` |

> `Priority` and `Size` are project-level fields — they only appear in the right sidebar
> after the Issue is linked to `42 Transcendence`. If they are not visible yet, save the
> Issue first, then open it again and set the fields from the Project section in the sidebar.

### If you forgot to link after creation

Open the Issue → right sidebar → **Projects** → select `42 Transcendence` → set Sprint, Priority, and Size.

---

## Custom Fields

| Field | Type | Values | Applies to | Meaning |
|-------|------|--------|:----------:|---------|
| `Status` | Single select | `Backlog` · `Ready` · `In Progress` · `In Review` · `Done` | Issue · PR | Where the item is in the workflow |
| `Priority` | Single select | `High` · `Medium` · `Low` | Issue · PR | High = critical / blocker · Medium = important · Low = nice to have |
| `Size` | Single select | `XS` · `S` · `M` · `L` · `XL` | Issue · PR | Categorical effort estimate |
| `Estimate` | Number | any | Issue · PR | Numeric effort estimate (story points or hours) |
| `Sprint` | Iteration | Sprint 01 … Sprint 10 | Issue · PR | Which sprint this item belongs to |
| `Squad` | Single select | `DB` · `BE` · `FE` | Issue · PR | Owning squad — use for board filtering |

---

## Cross-Squad Issues

When a feature needs DB + BE + FE work:

1. Create **one Issue per squad** (each with its own CC-named branch).
2. Set the `Squad` field on each Issue to its respective squad.
3. Add dependency references in the Issue body (`Blocked by #N`).
4. Assign all three Issues to the **same sprint milestone** so the full feature ships together.
5. Filter the board by `Squad` to get a focused view for each role.
