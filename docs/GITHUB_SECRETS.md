# GitHub Secrets Management for 42 Transcendence

## Overview

GitHub Secrets are encrypted environment variables stored securely in your GitHub repository. They are used to store sensitive information (passwords, API keys, tokens) that should not be exposed in version control.

This document explains how to set up and manage GitHub Secrets needed for the 42 Transcendence CI/CD pipeline.

---

## Why Use GitHub Secrets?

❌ **Without Secrets** (BAD):
- Credentials hardcoded in `.github/workflows/*.yml` files
- Visible in Git history forever
- Accessible to anyone with repository access
- Risk of accidental exposure in logs

✅ **With Secrets** (GOOD):
- Credentials stored securely in GitHub encrypted storage
- Never exposed in Git history or logs
- Accessible only to GitHub Actions workflows
- Automatic masking in workflow output (replaced with `***`)
- Can be rotated anytime

---

## Required Secrets for 42 Transcendence

### 1. `DB_PASSWORD`
- **Purpose**: PostgreSQL database password
- **Used In**: `health-check-on-pr-develop.yml` workflow
- **Example Value**: `transcendence_password_2026`
- **Security**: Should be different from local development password

### 2. `JWT_SECRET_KEY`
- **Purpose**: Secret key for JWT token signing/verification
- **Used In**: User authentication service, `health-check-on-pr-develop.yml` workflow
- **Example Value**: Generate using `openssl rand -base64 32`
- **Security**: Must be cryptographically secure, 32+ characters

---

## How to Add GitHub Secrets

### Step 1: Navigate to Repository Settings
1. Go to your GitHub repository in a web browser
2. Click the **Settings** tab (top right of the repository)
3. In the left sidebar, find **Secrets and variables** section
4. Click **Actions**

You should see the "Secrets" page with a list of existing repository secrets.

### Step 2: Create `DB_PASSWORD` Secret

1. Click the **New repository secret** button (green button, top right)
2. Fill in the following:
   - **Name**: `DB_PASSWORD`
   - **Value**: Enter a secure password (e.g., `transcendence_password_2026`)
3. Click **Add secret**

**Example**:
```
Name:  DB_PASSWORD
Value: transcendence_password_2026
```

### Step 3: Create `JWT_SECRET_KEY` Secret

1. Click **New repository secret** again
2. Fill in the following:
   - **Name**: `JWT_SECRET_KEY`
   - **Value**: Generate a secure random string
3. Click **Add secret**

#### Generating a Secure JWT_SECRET_KEY

Choose one method to generate a cryptographically secure key:

**Option A: Using OpenSSL** (Terminal)
```bash
openssl rand -base64 32
```

Output example:
```
aBcDeFgHiJkLmNoPqRsTuVwXyZ123456789AbCdEfGhIjKlMnOpQrStUvWxYz
```

**Option B: Using Python** (Terminal)
```bash
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Output example:
```
K7xP2m_-L9vQ8rT4sU5wX6yZ1a2b3c4d5e6f7g8h9i0j1k2l3m
```

**Option C: Using Node.js** (Terminal)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

**Option D: Manual** (Not Recommended)
Create a long random string with at least 32 characters mixing:
- Uppercase letters: A-Z
- Lowercase letters: a-z
- Numbers: 0-9
- Special characters: !@#$%^&*

Example (minimum length):
```
MyS3cur3JWT_K3y_F0r_Tr4nsc3nd3nc3_2026!@#$
```

### Step 4: Verify Secrets Were Added

After adding both secrets, you should see them listed on the "Secrets" page:

```
Repository secrets
├── DB_PASSWORD
└── JWT_SECRET_KEY
```

Both should show a green checkmark (✅) indicating they were successfully created.

---

## Using Secrets in GitHub Actions Workflows

### Basic Syntax

```yaml
- name: Create .env file
  env:
    DB_PASSWORD: ${{ secrets.DB_PASSWORD }}
    JWT_SECRET_KEY: ${{ secrets.JWT_SECRET_KEY }}
  run: |
    cat > .env << EOF
    DB_PASSWORD=$DB_PASSWORD
    JWT_SECRET_KEY=$JWT_SECRET_KEY
    EOF
```

### How It Works

1. **`env:` block** declares environment variables for the step
2. **`${{ secrets.VARIABLE_NAME }}`** retrieves the secret value from GitHub
3. **Variables are available** in the `run:` script as `$VARIABLE_NAME`
4. **Secrets are masked** in GitHub Actions logs (shown as `***`)

### Example Workflow Output

When you run a workflow that uses secrets:

```
✅ Health Check on PR to develop
├── Checkout repository
├── Install dependencies
├── Wait for Docker daemon
├── Verify Docker and Docker Compose
├── Create .env file            ← Secret values not logged
├── Start services (make up)
├── Run health check (make check)
└── Comment PR with results
```

Even if you try to print the secret:
```bash
echo "Password is: $DB_PASSWORD"
```

The output is automatically masked:
```
Password is: ***
```

---

## Important Security Notes

### ✅ DO

- ✅ Use strong, random passwords (20+ characters)
- ✅ Rotate secrets regularly (delete old, create new)
- ✅ Use unique secrets per environment (dev/staging/prod)
- ✅ Reference secrets via `${{ secrets.NAME }}` syntax
- ✅ Limit secret access with branch protection rules
- ✅ Audit secret usage in workflow logs

### ❌ DO NOT

- ❌ Commit secrets to Git (even accidentally)
- ❌ Hardcode secrets in workflow files
- ❌ Echo secrets to stdout/logs
- ❌ Share secrets in Slack, email, or chat
- ❌ Reuse the same secret across projects
- ❌ Check .env files into version control

---

## Rotating Secrets

If a secret is compromised or needs updating:

1. Go to **Settings → Secrets and variables → Actions**
2. Find the secret in the list
3. Click **Delete** (trash icon)
4. Confirm deletion
5. Click **New repository secret**
6. Create the new secret with the same name but new value

GitHub Actions automatically uses the latest secret value with no workflow changes needed.

### Timeline

- **Existing workflows**: Continue using old secret value until job completes
- **New workflow runs**: Use new secret value immediately
- **Git history**: Old secret never exposed (wasn't in commit)

---

## Troubleshooting

### Secret Not Found Error

**Error Message**:
```
The name 'DB_PASSWORD' is not a valid variable reference
```

**Causes**:
- Secret name has typo (case-sensitive)
- Secret not created yet
- Wrong syntax used (e.g., `$secrets.DB_PASSWORD` instead of `${{ secrets.DB_PASSWORD }}`)

**Solution**:
1. Check secret name spelling (must match exactly)
2. Verify secret is listed on Secrets page
3. Use correct YAML syntax: `${{ secrets.VARIABLE_NAME }}`

### Environment Variable Empty

**Symptom**:
```
DB_PASSWORD is empty in workflow
```

**Causes**:
- Secret created after workflow started (caching issue)
- Secret name incorrect in workflow file
- Secret scoped to wrong repository

**Solution**:
1. Hard-refresh repository settings page
2. Double-check secret name in workflow
3. Verify you're editing secrets in correct repository

### Workflow Still Failing After Adding Secret

**Symptom**:
```
Error: Database container failed to start
Even though DB_PASSWORD secret was added
```

**Causes**:
- Workflow file not updated to use secrets (still hardcoded)
- Secret value provided but not actually being used
- Workflow cache needs refresh

**Solution**:
1. Verify workflow step has `env:` block referencing secrets
2. Commit and push workflow file changes
3. Create new PR to trigger workflow with updated file
4. Wait 30 seconds for secret to propagate

---

## CI/CD Workflow Integration

### When Secrets Are Used

The `health-check-on-pr-develop.yml` workflow uses secrets in this sequence:

```
PR opened to develop branch
    ↓
GitHub Actions triggered
    ↓
Checkout repository code
    ↓
Load DB_PASSWORD and JWT_SECRET_KEY from secrets
    ↓
Create .env file with secret values
    ↓
Build Docker images
    ↓
Start services (database, backend, frontend, nginx)
    ↓
Run make check (676 tests)
    ↓
Report results
```

### PR Comment Example

After the workflow completes, a comment is automatically posted to your PR:

```
✅ Health Check PASSED

Test Results Summary:
  PASSED: 676
  FAILED: 0

Artifacts: health_check_results available for 30 days
```

---

## Additional Resources

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [OpenSSL rand documentation](https://www.openssl.org/docs/manmaster/man1/openssl-rand.html)
- [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-guides)
- [42 Transcendence CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Quick Reference

| Secret Name | Usage | Example | Rotate? |
|-------------|-------|---------|---------|
| `DB_PASSWORD` | PostgreSQL auth | `transcendence_password_2026` | Quarterly |
| `JWT_SECRET_KEY` | Token signing | `aBcDeFgHi...` (32+ chars) | Quarterly |

**Next Steps**:
1. ✅ Create both secrets in GitHub UI
2. ✅ Verify they appear in repository secrets list
3. ✅ Create a test PR to `develop` branch
4. ✅ Confirm workflow runs successfully with secrets
5. ✅ Check no sensitive data appears in logs

