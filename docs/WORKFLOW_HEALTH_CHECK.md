# GitHub Actions: Health Check on PR to develop

**File:** `.github/workflows/health-check-on-pr-develop.yml`

## Overview

This workflow automatically runs `make check` when a Pull Request is opened or updated targeting the `develop` branch. It validates that all tests pass (unit tests, integration tests, health checks) before allowing merging.

## Trigger Conditions

- ✅ PR opened/reopened/updated targeting `develop` branch
- ✅ PR marked as ready for review
- ❌ Does NOT run on pushes to `develop` (only on PRs)
- ❌ Does NOT run on PRs targeting other branches

## Execution Environment

- **Runner:** `ubuntu-latest` GitHub Actions runner
- **Container:** Alpine Linux (minimal, ~5MB)
- **Docker Setup:** Docker-in-Docker (dind) for building and running containers

## Workflow Steps

### 1. Checkout Repository
Standard checkout of the PR code.

### 2. Install Alpine Dependencies
Installs required tools on Alpine Linux:
- `docker-cli` — Docker CLI for container operations
- `docker-compose` — Docker Compose for orchestration
- `make` — Build automation
- `bash` — Shell scripting
- `curl` — HTTP requests for health checks
- `git` — Git operations
- `python3` — Python for test scripts

### 3. Wait for Docker Daemon
Polls docker daemon up to 30 times (60 seconds total) to ensure it's ready.
Critical because Docker-in-Docker takes time to initialize.

### 4. Verify Docker & Docker Compose
Prints versions for debugging if the workflow fails.

### 5. Run Health Check (make check)
**Key behavior:**
- Runs `make check` which performs:
  - Container health checks (7 services)
  - Network validation
  - TLS certificate verification
  - Database schema validation
  - Backend unit tests (User, Game, Chat services)
  - Frontend unit tests (329 tests)
  - E2E integration tests
  - Total: ~26 test suites, 676 tests

- **`continue-on-error: true`** — Allows workflow to complete even if tests fail
  - Without this, workflow would stop at first failure
  - We need results regardless of pass/fail

### 6. Parse Test Results
Extracts the FAILED count from test output:
```
TOTAL      PASSED: 672  FAILED: 4
```

**Logic:**
- If `FAILED > 0` → Job fails ❌
- If `FAILED = 0` → Job passes ✅
- Outputs both counts for PR comment

### 7. Upload Artifacts
Saves `make_check_results.txt` and `health_check.log` for 30 days.
Useful for debugging if workflow fails.

### 8. Comment PR with Results
Posts a formatted comment on the PR with:
- Status emoji (✅ or ❌)
- Pass/fail counts
- Collapsible detailed results
- Timestamps (via GitHub)

### 9. Report Final Job Status
Final check: If `FAILED > 0`, exit with code 1 (job fails).

---

## Example PR Comment Output

### ✅ All Tests Passing
```
✅ Health Check PASSED

Summary:
- Passed: 676
- Failed: 0

Full Results
SUITE RESULTS
──────────────────────────────────────────────────────────────
  [PASS]  Container Status                              pass:7   fail:0
  ...
```

### ❌ Tests Failing
```
❌ Health Check FAILED

Summary:
- Passed: 654
- Failed: 22

Full Results
SUITE RESULTS
──────────────────────────────────────────────────────────────
  [PASS]  Container Status                              pass:7   fail:0
  ...
  [FAIL]  User Service Unit Tests                       pass:0   fail:109
  [FAIL]  Game Service Unit Tests                       pass:46  fail:22
```

---

## Important Design Decisions

### 1. **Continue on Error**
```yaml
continue-on-error: true
```
- ✅ Allows `make check` to run completely, even if tests fail initially
- ✅ Prevents partial results from masking other failures
- ✅ Final exit code determined by FAILED count parsing

### 2. **Alpine Linux (Not Ubuntu)**
- ✅ Minimal image (~5MB vs 50MB+)
- ✅ Faster startup
- ✅ Lower resource usage
- ⚠️ Requires explicit package installation (apk instead of apt)

### 3. **Docker-in-Docker**
```yaml
services:
  docker:
    image: docker:dind
    options: >-
      --privileged
      --health-cmd "docker info"
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```
- ✅ Allows running Docker containers inside container
- ✅ Matches production environment (Docker Compose)
- ⚠️ Requires privileged mode
- ⚠️ Takes ~10 seconds to initialize (hence waiting step)

### 4. **PR Filtering**
```yaml
on:
  pull_request:
    branches:
      - develop
    types:
      - opened
      - reopened
      - synchronize
      - ready_for_review
```
- ✅ Only runs on PRs to develop (not on push)
- ✅ Runs on all PR state changes (opened, updated, marked ready)
- ✅ Prevents unnecessary runs on feature branches

---

## Success Criteria for Merging

To merge to `develop`, all these must pass:
- [ ] Workflow completes successfully (green checkmark)
- [ ] `TOTAL FAILED: 0` (no failing tests)
- [ ] No blocking review comments
- [ ] All conversations resolved

---

## Troubleshooting

### Workflow Fails: "Docker daemon not ready"
**Cause:** Docker-in-Docker service didn't start in time
**Solution:** Increase `--health-timeout` or `--health-retries` in workflow

### Tests Pass Locally but Fail in Workflow
**Cause:** Environment differences (network, timing, Alpine-specific issues)
**Solution:** Check artifact logs for specific failures, replicate in Alpine container locally

### Workflow Runs on Feature Branch
**Cause:** PR targeting wrong branch
**Solution:** Ensure PR is opened against `develop` branch

### Timeout (>30 minutes)
**Cause:** Tests taking too long or Docker daemon hanging
**Solution:** Check logs, consider parallelizing tests in future

---

## GitHub Secrets/Configuration Required

**None!** This workflow uses only public actions and runs on the default runner.

**Optional future enhancements:**
- Notification to Slack on failure
- Automatic assignment of reviewers
- Auto-revert if critical tests fail

---

## References

- Workflow syntax: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
- Alpine packages: https://pkgs.alpinelinux.org/
- Docker-in-Docker: https://hub.docker.com/_/docker
- Make check target: `Makefile` → `check` target
