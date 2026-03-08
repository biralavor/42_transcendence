#!/bin/bash
# TranscendenceHealthCheck.sh
# Integration health check for the 42 ft_transcendence project.
# Run from the repository root: bash tests/TranscendenceHealthCheck.sh
#
# Exit code: 0 = all mandatory checks passed, 1 = one or more failed.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
RESET='\033[0m'

# ── State ─────────────────────────────────────────────────────────────────────
PASS=0
FAIL=0

# ── Load .env ─────────────────────────────────────────────────────────────────
DOMAIN=$(grep "^DOMAIN=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "localhost")
DB_USER=$(grep "^DB_USER=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "transcendence_user")
DB_NAME=$(grep "^DB_NAME=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "transcendence_db")
FRONTEND_PORT=$(grep "^FRONTEND_PORT=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "3000")
USER_SERVICE_PORT=$(grep "^USER_SERVICE_PORT=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "8001")
GAME_SERVICE_PORT=$(grep "^GAME_SERVICE_PORT=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "8002")
CHAT_SERVICE_PORT=$(grep "^CHAT_SERVICE_PORT=" .env 2>/dev/null | head -1 | cut -d= -f2- | tr -d '\r' || echo "8003")

# ── Helpers ───────────────────────────────────────────────────────────────────
pass()    { printf "${GREEN}[PASS]${RESET} %s\n" "$1"; ((++PASS)); }
fail()    { printf "${RED}[FAIL]${RESET} %s\n" "$1"; ((++FAIL)); }
info()    { printf "${CYAN}[INFO]${RESET} %s\n" "$1"; }
section() { printf "\n${YELLOW}=== %s ===${RESET}\n" "$1"; }

container_running() {
    # Scoped to this compose project to avoid false positives from other projects
    docker compose ps --format '{{.Names}}' 2>/dev/null | grep -q "^${1}$"
}

# ── 1. Container Status ────────────────────────────────────────────────────────
section "Container Status"
for svc in db user-service game-service chat-service frontend nginx adminer; do
    if container_running "$svc"; then
        pass "Container '$svc' is running"
    else
        fail "Container '$svc' is NOT running"
    fi
done

# ── 2. Restart Policy ─────────────────────────────────────────────────────────
section "Restart Policy"
for svc in db user-service game-service chat-service frontend nginx adminer; do
    policy=$(docker inspect --format '{{.HostConfig.RestartPolicy.Name}}' "$svc" 2>/dev/null || echo "N/A")
    if [[ "$policy" =~ ^(unless-stopped|always|on-failure)$ ]]; then
        pass "$svc restart policy: $policy"
    else
        fail "$svc has no valid restart policy (got: '$policy')"
    fi
done

# ── 3. nginx TLS (port 8443) ───────────────────────────────────────────────────
section "nginx TLS (port 8443)"
if command -v openssl &>/dev/null; then
    for proto in tls1_2 tls1_3; do
        if openssl s_client -connect "${DOMAIN}:8443" -"${proto}" </dev/null 2>&1 | grep -q "Cipher"; then
            pass "TLS protocol ${proto} accepted"
        else
            fail "TLS protocol ${proto} NOT accepted"
        fi
    done
    for proto in tls1 tls1_1; do
        result=$(openssl s_client -connect "${DOMAIN}:8443" -"${proto}" </dev/null 2>&1) || true
        if echo "$result" | grep -qiE "alert|error|no protocols"; then
            pass "TLS protocol ${proto} correctly rejected"
        else
            fail "TLS protocol ${proto} should be rejected but was accepted"
        fi
    done
else
    info "openssl not found — skipping TLS checks"
fi

# ── 4. HTTPS Response ─────────────────────────────────────────────────────────
section "HTTPS Response"
if command -v curl &>/dev/null; then
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" "https://${DOMAIN}:8443/" 2>/dev/null || echo "000")
    if [[ "$http_code" =~ ^(200|301|302)$ ]]; then
        pass "nginx responds on https://${DOMAIN}:8443/ (HTTP $http_code)"
    else
        fail "nginx returned unexpected HTTP code on https://${DOMAIN}:8443/: $http_code"
    fi
else
    info "curl not found — skipping HTTPS response check"
fi

# ── 5. Port Exposure ──────────────────────────────────────────────────────────
# Uses `docker compose ps` (scoped to this project) to avoid false positives
# from other Docker projects (e.g. Inception) running on the same host.
section "Port Exposure"
# Port 8443 must be exposed (HTTPS)
if docker compose ps --format '{{.Ports}}' 2>/dev/null | grep -q '8443->443'; then
    pass "Port 8443 is exposed (nginx HTTPS)"
else
    fail "Port 8443 is NOT exposed by nginx"
fi

# Port 8080 must be exposed (HTTP redirect)
if docker compose ps --format '{{.Ports}}' 2>/dev/null | grep -q '8080->80'; then
    pass "Port 8080 is exposed (nginx HTTP redirect)"
else
    fail "Port 8080 is NOT exposed by nginx"
fi

# These ports must NOT be exposed
for port in 3000 5432; do
    if docker compose ps --format '{{.Ports}}' 2>/dev/null | grep -q ":${port}->"; then
        fail "Port ${port} is exposed to the host (must be internal only)"
    else
        pass "Port ${port} is NOT exposed to the host"
    fi
done

# ── 6. Domain Resolution ──────────────────────────────────────────────────────
section "Domain Resolution"
local_ip=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "127.0.0.1")
resolved=$(getent hosts "$DOMAIN" 2>/dev/null | awk '{print $1}' || echo "")
if [[ "$resolved" == "127.0.0.1" || "$resolved" == "::1" || "$resolved" == "$local_ip" ]]; then
    pass "$DOMAIN resolves to $resolved"
else
    fail "$DOMAIN does not resolve to local IP (got: '${resolved:-none}') — check /etc/hosts"
fi

# ── 7. Docker Network ─────────────────────────────────────────────────────────
section "Docker Network"
# Derive network from a container in this compose project (avoids matching
# other projects that also contain "transcendence" in their network name).
_cid=$(docker compose ps -q 2>/dev/null | head -n1)
if [[ -n "$_cid" ]]; then
    net=$(docker inspect "$_cid" \
        --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
        2>/dev/null | tr ' ' '\n' | grep -i transcendence | head -n1 || true)
else
    net=""
fi
if [[ -n "$net" ]]; then
    pass "Docker network found: $net"
    for svc in db user-service game-service chat-service frontend nginx adminer; do
        if docker network inspect "$net" 2>/dev/null | grep -q "\"$svc\""; then
            pass "$svc is connected to $net"
        else
            fail "$svc is NOT connected to $net"
        fi
    done
else
    fail "No transcendence docker network found"
fi

if docker inspect db user-service game-service chat-service frontend nginx adminer 2>/dev/null | grep -q '"NetworkMode": "host"'; then
    fail "At least one container uses 'network: host' (forbidden)"
else
    pass "No container uses 'network: host'"
fi

# ── 8. PostgreSQL Health ──────────────────────────────────────────────────────
section "PostgreSQL Health"
if container_running db; then
    if docker exec db pg_isready -U "$DB_USER" -d "$DB_NAME" &>/dev/null; then
        pass "PostgreSQL is accepting connections (pg_isready)"
    else
        fail "PostgreSQL is NOT ready (pg_isready failed)"
    fi

    if docker compose ps --format '{{.Ports}}' 2>/dev/null | grep -q ':5432->'; then
        fail "PostgreSQL port 5432 is exposed to the host (must be internal only)"
    else
        pass "PostgreSQL port 5432 is NOT exposed to the host"
    fi

    table_check=$(docker exec db psql -U "$DB_USER" -d "$DB_NAME" -tc \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_name='users';" \
        2>/dev/null | tr -d ' \n' || echo "0")
    if [[ "$table_check" -gt 0 ]]; then
        pass "PostgreSQL 'users' table exists in $DB_NAME"
    else
        fail "PostgreSQL 'users' table NOT found in $DB_NAME"
    fi
else
    info "db container not running — skipping PostgreSQL checks"
fi

# ── 9. Backend Health ─────────────────────────────────────────────────────────
section "Backend Health"
if container_running user-service; then
    health_response_user=$(docker exec user-service wget -q -O - "http://127.0.0.1:${USER_SERVICE_PORT:-8001}/health" 2>/dev/null || echo "")
    if echo "$health_response_user" | grep -q '"status".*"ok"'; then
        pass "user-service /health returns {\"status\":\"ok\"}"
    else
        fail "user-service /health did not return expected response (got: '${health_response_user:-empty}')"
    fi
else
    info "user-service container not running — skipping user-service health check"
fi

if container_running game-service; then
    health_response_game=$(docker exec game-service wget -q -O - "http://127.0.0.1:${GAME_SERVICE_PORT:-8002}/health" 2>/dev/null || echo "")
    if echo "$health_response_game" | grep -q '"status".*"ok"'; then
        pass "game-service /health returns {\"status\":\"ok\"}"
    else
        fail "game-service /health did not return expected response (got: '${health_response_game:-empty}')"
    fi
else
    info "game-service container not running — skipping game-service health check"
fi

if container_running chat-service; then
    health_response_chat=$(docker exec chat-service wget -q -O - "http://127.0.0.1:${CHAT_SERVICE_PORT:-8003}/health" 2>/dev/null || echo "")
    if echo "$health_response_chat" | grep -q '"status".*"ok"'; then
        pass "chat-service /health returns {\"status\":\"ok\"}"
    else
        fail "chat-service /health did not return expected response (got: '${health_response_chat:-empty}')"
    fi
else
    info "chat-service container not running — skipping chat-service health check"
fi

# ── 10. Frontend Response ─────────────────────────────────────────────────────
section "Frontend Response"
if container_running frontend; then
    frontend_response=$(docker exec frontend wget -q -O - "http://localhost:${FRONTEND_PORT}/" 2>/dev/null || echo "")
    if echo "$frontend_response" | grep -qi "<html\|<h1\|transcendence"; then
        pass "Frontend responds with HTML on port 3000"
    else
        fail "Frontend did not return expected HTML (got: '${frontend_response:0:80}')"
    fi
else
    info "frontend container not running — skipping frontend check"
fi

# ── 11. nginx Proxy Routes ────────────────────────────────────────────────────
section "nginx Proxy Routes"
if command -v curl &>/dev/null; then
    frontend_via_nginx=$(curl -sk "https://${DOMAIN}:8443/" 2>/dev/null || echo "")
    if echo "$frontend_via_nginx" | grep -qi "<html\|<h1\|transcendence"; then
        pass "nginx proxies https://${DOMAIN}:8443/ → frontend (HTML response)"
    else
        fail "nginx proxy to frontend failed on https://${DOMAIN}:8443/"
    fi

    api_response=$(curl -sk "https://${DOMAIN}:8443/api/users/health" 2>/dev/null || echo "")
    if echo "$api_response" | grep -q '"status".*"ok"'; then
        pass "nginx proxies https://${DOMAIN}:8443/api/users/health → user-service ({\"status\":\"ok\"})"
    else
        fail "nginx proxy to user-service failed on https://${DOMAIN}:8443/api/users/health (got: '${api_response:-empty}')"
    fi
else
    info "curl not found — skipping nginx proxy route checks"
fi

# ── 12. Named Volume ──────────────────────────────────────────────────────────
section "Named Volume"
if docker volume ls 2>/dev/null | grep -q "db_data"; then
    pass "Named volume 'db_data' exists"
else
    fail "Named volume 'db_data' NOT found"
fi

mount_type=$(docker inspect db --format '{{range .Mounts}}{{.Type}} {{end}}' 2>/dev/null \
    | tr ' ' '\n' | grep -v "^$" | head -1 || echo "")
if [[ "$mount_type" == "volume" ]]; then
    pass "db container uses a Docker named volume (not a bind mount)"
else
    fail "db container does not appear to use a named volume (type: '${mount_type:-unknown}')"
fi

# ── 13. Dockerfile Safety ─────────────────────────────────────────────────────
section "Dockerfile Safety"
dockerfiles=(
    "services/database/Dockerfile"
    "services/backend-base/Dockerfile"
    "services/user-service/Dockerfile"
    "services/game-service/Dockerfile"
    "services/chat-service/Dockerfile"
    "services/frontend/Dockerfile"
    "services/nginx/Dockerfile"
)
for df in "${dockerfiles[@]}"; do
    if [[ ! -f "$df" ]]; then
        fail "$df not found"
        continue
    fi
    svc_name=$(basename "$(dirname "$df")")

    if grep -q "FROM.*:latest" "$df"; then
        fail "$svc_name/Dockerfile uses :latest tag (forbidden)"
    else
        pass "$svc_name/Dockerfile: no :latest tag"
    fi

    from_line=$(grep -m1 "^FROM" "$df" 2>/dev/null || echo "")
    from_image=$(echo "$from_line" | awk '{print $2}')
    from_name="${from_image%%:*}"
    # Explicit allowlist of locally-built base images — skip pinned tag requirement for these only
    local_images=("backend-base")
    is_local=false
    for local_img in "${local_images[@]}"; do
        [[ "$from_name" == "$local_img" ]] && is_local=true && break
    done
    if $is_local; then
        pass "$svc_name/Dockerfile: FROM uses local base image '${from_image}' (no registry tag required)"
    elif echo "$from_line" | grep -qE "^FROM \S+:[0-9a-zA-Z]" && \
         ! echo "$from_line" | grep -qi ":latest"; then
        pass "$svc_name/Dockerfile: FROM uses a pinned version tag"
    else
        fail "$svc_name/Dockerfile: FROM must use a pinned version tag (got: '${from_line:-empty}')"
    fi

    if grep -iE "(password|passwd|secret)\s*=\s*\S+" "$df" | grep -v "^#" | grep -q .; then
        fail "$svc_name/Dockerfile may contain hardcoded credentials"
    else
        pass "$svc_name/Dockerfile: no obvious hardcoded credentials"
    fi

    if grep -qE "tail -f|sleep infinity|while true" "$df"; then
        fail "$svc_name/Dockerfile contains forbidden infinite loop pattern"
    else
        pass "$svc_name/Dockerfile: no forbidden loop patterns"
    fi
done

# ── 14. docker-compose.yml Safety ─────────────────────────────────────────────
section "docker-compose.yml Safety"
COMPOSE_FILE="docker-compose.yml"
if [[ -f "$COMPOSE_FILE" ]]; then
    if grep -qE "network:\s*host|--link|^\s+links:" "$COMPOSE_FILE"; then
        fail "$COMPOSE_FILE contains forbidden network directives (network:host / --link / links:)"
    else
        pass "$COMPOSE_FILE: no forbidden network directives"
    fi

    if grep -q ":latest" "$COMPOSE_FILE"; then
        fail "$COMPOSE_FILE references :latest tag (forbidden)"
    else
        pass "$COMPOSE_FILE: no :latest tag"
    fi

    if grep -q "networks:" "$COMPOSE_FILE"; then
        pass "$COMPOSE_FILE has a network definition"
    else
        fail "$COMPOSE_FILE is missing a network definition"
    fi

    if grep -q "volumes:" "$COMPOSE_FILE"; then
        pass "$COMPOSE_FILE has a volume definition"
    else
        fail "$COMPOSE_FILE is missing a volume definition"
    fi
else
    fail "$COMPOSE_FILE not found at repository root"
fi

# ── 15. Secrets & Repository Structure ───────────────────────────────────────
section "Secrets & Repository Structure"

if [[ -f ".env" ]]; then
    pass ".env exists at repository root"
else
    fail ".env missing at repository root — run: cp .env.example .env"
fi

required_vars=(DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME USER_SERVICE_PORT GAME_SERVICE_PORT CHAT_SERVICE_PORT FRONTEND_PORT DOMAIN)
for var in "${required_vars[@]}"; do
    value=$(grep "^${var}=" .env 2>/dev/null | cut -d= -f2- | tr -d '\r' || echo "")
    if [[ -n "$value" ]]; then
        pass ".env: ${var} is set"
    else
        fail ".env: ${var} is missing or empty"
    fi
done

if git rev-parse --git-dir &>/dev/null; then
    if git ls-files --error-unmatch .env &>/dev/null 2>&1; then
        fail ".env is tracked by git (CRITICAL — credentials must not be committed)"
    else
        pass ".env is NOT tracked by git"
    fi
else
    info "Not a git repository — skipping git tracking check"
fi

for f in docker-compose.yml Makefile .env.example; do
    if [[ -f "$f" ]]; then
        pass "$f exists at repository root"
    else
        fail "$f missing at repository root"
    fi
done

for svc in database backend-base user-service game-service chat-service frontend nginx; do
    df="services/${svc}/Dockerfile"
    if [[ -f "$df" && -s "$df" ]]; then
        pass "Dockerfile exists and non-empty: services/${svc}/"
    else
        fail "Dockerfile missing or empty: $df"
    fi
done

# ── Summary ───────────────────────────────────────────────────────────────────
printf "\n${YELLOW}══════════════════════════════════════════${RESET}\n"
printf "  ${YELLOW}MANDATORY${RESET}  ${GREEN}PASSED: %-3d${RESET}  ${RED}FAILED: %-3d${RESET}\n" "$PASS" "$FAIL"
printf "${YELLOW}══════════════════════════════════════════${RESET}\n"

if [[ $FAIL -eq 0 ]]; then
    printf "${GREEN}All mandatory checks passed! Transcendence is healthy.${RESET}\n"
    exit 0
else
    printf "${RED}%d mandatory check(s) failed. Review the output above.${RESET}\n" "$FAIL"
    exit 1
fi
