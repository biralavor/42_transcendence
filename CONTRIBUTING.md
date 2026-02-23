# Contributing Guide

This project uses **Trunk Based Development (TBD)** with a 1-week sprint cycle.
All work flows through GitHub Issues → feature branches → `develop` → `main`.

---

## Branch Architecture

### Branch Flow

```mermaid
gitGraph
   commit id: "v1.0.0"
   branch develop
   checkout develop
   branch 42-feat-auth-add-oauth
   checkout 42-feat-auth-add-oauth
   commit id: "feat(auth): add OAuth"
   checkout develop
   merge 42-feat-auth-add-oauth id: "PR #43"
   branch 15-fix-game-timer
   checkout 15-fix-game-timer
   commit id: "fix(game): timer overflow"
   checkout develop
   merge 15-fix-game-timer id: "PR #16"
   checkout main
   merge develop id: "v1.1.0"
```

| Branch | Direct Commits | Updated Via | When |
|--------|:--------------:|-------------|------|
| `main` | ❌ Locked | PR from `develop` — **Scrum Master only** | End of sprint · triggers Release tag |
| `develop` | ❌ Never | PR from feature branches | Each completed Issue |
| `#N-issue-name` | ✅ Your work | Created through GitHub Issues | One branch per Issue |

---

### GitHub Web Workflow (GUI developers)

```mermaid
flowchart TD
    A([🌐 github.com]) --> B[Issues tab → New Issue]
    B --> C["Name with Conventional Commits\nfeat(scope): description"]
    C --> D[Assign · Label · Project · Milestone]
    D --> E([Create])
    E --> F["Note your Issue number #N\ne.g. #42"]
    F --> G[Open the Issue → right sidebar\nClick Create a branch]
    G --> H["Set base branch: develop\nClick Create branch\n→ branch is named 42-feat-auth-..."]
    H --> I{Pick your editor}
    I --> J["🖥️ GitHub Desktop\nFetch origin\nSwitch to branch #N"]
    I --> K["🌐 github.dev\nPress . on the repo page\nSwitch branch in bottom-left corner"]
    J --> L["Edit files\nCommit with CC message\nfeat(auth): add OAuth login\nPush to origin"]
    K --> M["Edit files\nCommit with CC message\nfeat(auth): add OAuth login"]
    L --> N([github.com])
    M --> N
    N --> O["Compare & pull request banner\nClick it"]
    O --> P["⚠️ Base branch → develop\nNEVER main"]
    P --> Q[Add description\nRequest 1 reviewer]
    Q --> R([Submit PR ✅])
```

---

## One-Time Local Setup

Run this once after cloning the repository:

```bash
git config core.hooksPath .githooks
```

This activates the shared git hooks, including automatic `Co-Authored-By` trailers on every commit.

> The hook reads team members from `.githooks/prepare-commit-msg`.
> Update the `AUTHORS` list in that file when the team is finalised.
> The current committer is excluded automatically — only co-authors are appended.

---

## Part 1 — Starting New Work

> **Do not fork. Do not commit directly to `develop` or `main`.
> Every piece of work starts with a GitHub Issue.**

### 1. Create an Issue

1. Go to **GitHub Issues** → click **New Issue**
2. Name it using [Conventional Commits](#conventional-commits-cheat-sheet) format:
   ```
   feat(auth): add Google OAuth login
   fix(game): correct timer overflow on round end
   docs(readme): update local setup instructions
   ```
3. **Assign** yourself or the responsible person
4. **Choose a Label** — GitHub does not auto-label Issues; pick it manually based on the CC type in the name:
   `feat` → `enhancement` · `fix` → `bug` · `docs` → `documentation` · `test` → `testing` · `ci` → `infrastructure` · `perf` → `performance` · `refactor` → `refactor` · `chore` → `chore`
5. **Link to the Project** — right sidebar → **Projects** → select `42 Transcendence`
6. **Set the Sprint** — right sidebar → **Milestone** → select the sprint you plan to start working on *(required)*
7. **Set Priority and Size** — right sidebar → **Projects fields** → set `Priority` and `Size` *(recommended)* — see [`docs/GitHub-Projects.md`](docs/GitHub-Projects.md) for field values
8. Click **Create**

> You will now see an issue number — e.g. **`#42`**. Keep it in mind; you will use it next.

---

### 2. Create the Branch

1. Open the Issue you just created
2. Click **Create a branch** (right sidebar)
3. Set the base branch to **`develop`** → click **Create branch**

GitHub auto-names your branch using the issue number as a prefix:
```
42-feat-auth-add-google-oauth-login
```

4. Back in your terminal, pull the new branch:
```bash
git pull
```
5. Switch to it using the issue number `#` for TAB autocomplete:
```bash
git switch 42<TAB>
# autocompletes → git switch 42-feat-auth-add-google-oauth-login
```
Press **Enter**. You are ready to work. 🚀

---

## Part 2 — Submitting Your Work

### 3. Commit Your Changes

Stage only the files you changed:
```bash
git add src/auth/oauth.py
git add tests/auth/test_oauth.py
```

Commit using Conventional Commits format:
```bash
git commit -m "feat(auth): add Google OAuth login"
```

Optionally, append `#N` to cross-link the commit to the Issue on GitHub:
```bash
git commit -m "feat(auth): add Google OAuth login #42"
```

Push to your feature branch:
```bash
git push
```

---

### 4. Open a Pull Request

1. Go to GitHub — you will see a **Compare & pull request** banner → click it
2. ⚠️ **Always set the base branch to `develop`** — never to `main`
3. Write a short description of what you did and why
4. Right sidebar → **Projects** → set `Priority`, `Size`, `Estimate`, and `Sprint` *(recommended)*
5. Request **at least 1 reviewer** — choose someone familiar with the issue or who asked for the feature
6. Submit the PR

Once approved and merged, the branch is automatically deleted. ✅

### 5. Verify the Issue is Linked to Your PR

After submitting, check the PR page right sidebar under **Development**:
- You should see your Issue `#N` listed there — this confirms the link is active.

**If the Issue is not linked — fix it before requesting review:**

| Fix method | How |
|------------|-----|
| Edit PR description | Click **Edit** on the PR body → add `Closes #N` → Save |
| Link via sidebar | PR page → **Development** (right sidebar) → **Link an issue** → search and select `#N` |

> The sidebar method links the Issue without auto-closing it on merge.
> If you want auto-close, add `Closes #N` in the PR description instead.

---

## Conventional Commits Cheat-Sheet

**Format**: `type(scope): short description`

| Field | Details |
|-------|---------|
| `type` | What kind of change (see table below) |
| `scope` | Affected area in parentheses — e.g. `auth`, `game`, `api`, `frontend` *(optional but recommended)* |
| `description` | Imperative, lowercase, no trailing period — *"add login"* not *"Added login."* |

| Type | When to use | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(game): add spectator mode` |
| `fix` | Bug fix | `fix(auth): correct token expiration check` |
| `docs` | Documentation only | `docs(readme): update local setup steps` |
| `refactor` | Code change, no feature or bug fix | `refactor(api): simplify user endpoint logic` |
| `test` | Adding or fixing tests | `test(game): add tournament bracket edge cases` |
| `chore` | Build, dependencies, tooling | `chore(deps): upgrade Django to 5.1` |
| `ci` | CI/CD pipeline changes | `ci: add lint step to GitHub Actions` |
| `perf` | Performance improvement | `perf(db): add index on user_id column` |
| `style` | Formatting, no logic change | `style(frontend): fix indentation in login form` |
| `revert` | Revert a previous commit | `revert: feat(game): add spectator mode` |

**Breaking change** — append `!` after the type:
```
feat!: remove legacy v1 API endpoints
```

---

## Sprint & Release Rhythm

| When | Who | Action |
|------|-----|--------|
| Mon – Fri (sprint) | Everyone | Create Issues → work on branches → open PRs → merge to `develop` |
| End of sprint (Friday) | **Scrum Master** | Review `develop` → open PR to `main` → merge → tag release `v1.X.0` |
| After release | Everyone | `git pull` on `develop` · start next sprint |

> Only the **Scrum Master** sends commits from `develop` to `main`.
> Every merge to `main` must be accompanied by a Release tag (`v1.0.0`, `v1.1.0`, …).

---

## GitHub Automation

| File | Purpose |
|------|---------|
| `.github/labeler.yml` | Label rules — maps branch name patterns and changed file paths to PR labels |
| `.github/workflows/labeler.yml` | Triggers `actions/labeler` on every PR open or update |
| `.github/workflows/close-issue-on-merge-to-develop.yml` | Auto-closes linked Issues when a PR is merged into `develop` |

> Labels are applied based on branch name (e.g. `42-fix-*` → `bug`) and changed files.
> Issues close automatically when your PR merges — no manual close needed.

---

## GitHub Projects

The team uses a single shared board to track all work across Database, Backend, and Frontend squads.

See [`docs/GitHub-Projects.md`](docs/GitHub-Projects.md) for:
- Board columns and what each status means
- Feature flow: Database → Backend → Frontend
- Full sprint schedule (Sprint 01–10)
- Milestones: sprint-level and phase-level
- Custom fields: Status · Priority · Size · Squad
- How to handle cross-squad Issues
