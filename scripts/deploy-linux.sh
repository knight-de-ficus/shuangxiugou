#!/usr/bin/env bash
set -Eeuo pipefail

DOMAIN=""
EMAIL=""
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SEQUENCE=""
INSTALL_DOCKER=1
OPEN_FIREWALL=1
NODE_IMAGE="node:22.22.0-alpine3.23"
COMPOSE_FILE="deploy/resilient/docker-compose.yml"
BACKUP_ROOT="/var/backups/shuangxiugou"
DEPLOY_STARTED=0
BACKUP_DIR=""
ADDED_UFW_RULES=()
ADDED_FIREWALLD_PORTS=()

usage() {
  cat <<'EOF'
Usage: sudo ./scripts/deploy-linux.sh --domain example.com [options]

Options:
  --domain DOMAIN          Public hostname handled by Caddy (required)
  --email EMAIL            ACME contact email (recorded for operators)
  --project-dir PATH       Project checkout; defaults to repository root
  --sequence N             Explicit release sequence; defaults to previous + 1
  --no-install-docker      Require an existing Docker Engine + Compose plugin
  --no-firewall            Do not change the active host firewall
  -h, --help               Show this help

This opens only TCP 80/443/4001 and UDP 443/4001 on an active UFW/firewalld.
Cloud security groups, upstream NAT and DNS must still be configured externally.
EOF
}

log() { printf '[shuangxiugou] %s\n' "$*"; }
warn() { printf '[shuangxiugou] WARNING: %s\n' "$*" >&2; }
die() { printf '[shuangxiugou] ERROR: %s\n' "$*" >&2; exit 1; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --domain) DOMAIN="${2:-}"; shift 2 ;;
    --email) EMAIL="${2:-}"; shift 2 ;;
    --project-dir) PROJECT_DIR="${2:-}"; shift 2 ;;
    --sequence) SEQUENCE="${2:-}"; shift 2 ;;
    --no-install-docker) INSTALL_DOCKER=0; shift ;;
    --no-firewall) OPEN_FIREWALL=0; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Unknown argument: $1" ;;
  esac
done

[[ $EUID -eq 0 ]] || die "Run as root (sudo)."
[[ -n "$DOMAIN" ]] || die "--domain is required."
[[ "$DOMAIN" =~ ^([A-Za-z0-9-]+\.)*[A-Za-z0-9-]+$ ]] || die "Invalid domain."
if [[ -n "$SEQUENCE" ]]; then
  [[ "$SEQUENCE" =~ ^[1-9][0-9]*$ ]] || die "--sequence must be a positive integer."
fi
PROJECT_DIR="$(cd "$PROJECT_DIR" && pwd)"
[[ -f "$PROJECT_DIR/package.json" && -f "$PROJECT_DIR/$COMPOSE_FILE" ]] || die "Project files not found in $PROJECT_DIR"

cd "$PROJECT_DIR"
umask 077
mkdir -p "$BACKUP_ROOT"
BACKUP_DIR="$BACKUP_ROOT/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
for item in deploy/resilient/.env deploy/resilient/runtime deploy/resilient/secrets; do
  if [[ -e "$item" ]]; then cp -a "$item" "$BACKUP_DIR/"; fi
done
log "Backup created at $BACKUP_DIR"

rollback() {
  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then return; fi
  warn "Deployment failed; restoring backed-up configuration."
  if [[ -f "$BACKUP_DIR/.env" ]]; then cp -a "$BACKUP_DIR/.env" deploy/resilient/.env; fi
  if [[ -d "$BACKUP_DIR/runtime" ]]; then rm -rf deploy/resilient/runtime && cp -a "$BACKUP_DIR/runtime" deploy/resilient/runtime; fi
  if [[ -d "$BACKUP_DIR/secrets" ]]; then rm -rf deploy/resilient/secrets && cp -a "$BACKUP_DIR/secrets" deploy/resilient/secrets; fi
  if [[ $DEPLOY_STARTED -eq 1 ]] && command -v docker >/dev/null 2>&1; then
    docker compose --env-file deploy/resilient/.env -f "$COMPOSE_FILE" up -d >/dev/null 2>&1 || true
  fi
  if command -v ufw >/dev/null 2>&1; then
    for rule in "${ADDED_UFW_RULES[@]}"; do ufw --force delete allow "$rule" >/dev/null 2>&1 || true; done
  fi
  if command -v firewall-cmd >/dev/null 2>&1; then
    for port in "${ADDED_FIREWALLD_PORTS[@]}"; do firewall-cmd --permanent --remove-port="$port" >/dev/null 2>&1 || true; done
    [[ ${#ADDED_FIREWALLD_PORTS[@]} -eq 0 ]] || firewall-cmd --reload >/dev/null 2>&1 || true
  fi
  warn "Rollback attempted. Backup retained at $BACKUP_DIR"
}
trap rollback EXIT

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Using existing $(docker --version) / $(docker compose version --short)"
    return
  fi
  [[ $INSTALL_DOCKER -eq 1 ]] || die "Docker Engine with Compose plugin is required."
  [[ -r /etc/os-release ]] || die "Cannot identify Linux distribution."
  # shellcheck disable=SC1091
  . /etc/os-release
  case "${ID:-}" in
    ubuntu|debian) ;;
    *) die "Automatic Docker installation supports Ubuntu/Debian only. Install Docker Engine manually, then rerun with --no-install-docker." ;;
  esac
  local conflicts
  conflicts="$(dpkg-query -W -f='${binary:Package}\n' docker.io docker-compose docker-compose-v2 podman-docker containerd runc 2>/dev/null || true)"
  [[ -z "$conflicts" ]] || die "Conflicting container packages found: $conflicts. Review and remove them manually before continuing."

  log "Installing Docker Engine from Docker's signed apt repository."
  apt-get update
  apt-get install -y ca-certificates curl jq gnupg
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  local codename="${UBUNTU_CODENAME:-${VERSION_CODENAME:-}}"
  [[ -n "$codename" ]] || die "Distribution codename is unavailable."
  if [[ -f /etc/apt/sources.list.d/docker.sources ]]; then
    cp -a /etc/apt/sources.list.d/docker.sources "$BACKUP_DIR/docker.sources"
  fi
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/${ID}
Suites: ${codename}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin jq
  systemctl enable --now docker
  docker info >/dev/null
}

open_firewall() {
  [[ $OPEN_FIREWALL -eq 1 ]] || { warn "Host firewall changes skipped."; return; }
  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q '^Status: active'; then
    for rule in '80/tcp' '443/tcp' '443/udp' '4001/tcp' '4001/udp'; do
      if ! ufw status | awk -v rule="$rule" '$1 == rule && $2 == "ALLOW" { found=1 } END { exit !found }'; then
        ufw allow "$rule" comment 'ShuangxiuGo resilient web' >/dev/null
        ADDED_UFW_RULES+=("$rule")
      fi
    done
    log "Opened required ports in active UFW."
  elif command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    for port in '80/tcp' '443/tcp' '443/udp' '4001/tcp' '4001/udp'; do
      if ! firewall-cmd --permanent --query-port="$port" >/dev/null; then
        firewall-cmd --permanent --add-port="$port" >/dev/null
        ADDED_FIREWALLD_PORTS+=("$port")
      fi
    done
    firewall-cmd --reload >/dev/null
    log "Opened required ports in firewalld."
  else
    warn "No active UFW/firewalld detected. No host firewall rule was added; verify nftables/iptables and your cloud security group manually."
  fi
}

run_node() {
  docker run --rm --network host \
    -e HOME=/tmp/node-home \
    -v "$PROJECT_DIR:/workspace" \
    -w /workspace "$NODE_IMAGE" "$@"
}

install_docker
open_firewall
mkdir -p deploy/resilient/runtime deploy/resilient/secrets
chmod 700 deploy/resilient/runtime deploy/resilient/secrets
cat >deploy/resilient/.env <<EOF
SITE_DOMAIN=${DOMAIN}
ACME_EMAIL=${EMAIL}
EOF
chmod 600 deploy/resilient/.env

DEPLOY_STARTED=1
docker compose --env-file deploy/resilient/.env -f "$COMPOSE_FILE" up -d kubo
for _ in $(seq 1 30); do
  if curl -fsS -X POST http://127.0.0.1:5001/api/v0/id >/dev/null 2>&1; then break; fi
  sleep 2
done
curl -fsS -X POST http://127.0.0.1:5001/api/v0/id >/dev/null || die "Kubo RPC did not become ready."

log "Installing locked dependencies and building the Vite site in Node container."
run_node npm ci
run_node npm run lint
run_node npm run build
run_node npm run test:resweb

if [[ ! -s deploy/resilient/secrets/publisher.private.pem || ! -s deploy/resilient/secrets/publisher.pub.pem ]]; then
  warn "Creating an initial publisher key on this server. Move the private key to offline/isolated storage after bootstrap."
  run_node node tools/resilient-web/cli.mjs keygen
fi
chmod 600 deploy/resilient/secrets/publisher.private.pem
chmod 644 deploy/resilient/secrets/publisher.pub.pem
chmod 755 deploy/resilient/secrets

if [[ -z "$SEQUENCE" ]]; then
  previous_sequence=0
  [[ -f deploy/resilient/runtime/sequence.txt ]] && previous_sequence="$(tr -dc '0-9' <deploy/resilient/runtime/sequence.txt)"
  previous_sequence="${previous_sequence:-0}"
  SEQUENCE=$((previous_sequence + 1))
fi

publish_args=(node tools/resilient-web/cli.mjs publish --sequence "$SEQUENCE" --site dist --private-key deploy/resilient/secrets/publisher.private.pem --gateways "https://${DOMAIN}")
if [[ -s deploy/resilient/runtime/last-manifest-cid.txt ]]; then
  publish_args+=(--previous "$(tr -d '\r\n ' <deploy/resilient/runtime/last-manifest-cid.txt)")
fi
log "Publishing signed sequence $SEQUENCE."
publish_json="$(run_node "${publish_args[@]}")"
printf '%s\n' "$publish_json"
manifest_cid="$(printf '%s' "$publish_json" | jq -r '.manifestCid')"
[[ "$manifest_cid" != "null" && -n "$manifest_cid" ]] || die "Could not parse manifest CID."
printf '%s\n' "$SEQUENCE" >deploy/resilient/runtime/sequence.txt
printf '%s\n' "$manifest_cid" >deploy/resilient/runtime/last-manifest-cid.txt
# The verifier image runs as uid 1000. Keep its writable state private while
# allowing it to atomically update verification-state.json on a bind mount.
chown -R 1000:1000 deploy/resilient/runtime
chmod 700 deploy/resilient/runtime
find deploy/resilient/runtime -maxdepth 1 -type f -exec chmod 600 {} +

docker compose --env-file deploy/resilient/.env -f "$COMPOSE_FILE" up -d --build
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:8080/ipfs/"$(printf '%s' "$publish_json" | jq -r '.contentCid')"/ >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose --env-file deploy/resilient/.env -f "$COMPOSE_FILE" ps

resolved="$(getent ahosts "$DOMAIN" 2>/dev/null | awk '{print $1}' | sort -u | paste -sd, - || true)"
if [[ -z "$resolved" ]]; then
  warn "DNS does not currently resolve $DOMAIN. Create A/AAAA records before public HTTPS can succeed."
else
  log "DNS addresses for $DOMAIN: $resolved"
fi
if curl -fsS --connect-timeout 10 "https://${DOMAIN}/_resilient/readyz" >/dev/null 2>&1; then
  log "Public HTTPS readiness check passed."
else
  warn "Public HTTPS is not reachable yet. Check A/AAAA, cloud security groups/NAT, and TCP+UDP 443."
fi

trap - EXIT
log "Deployment complete. Sequence=$SEQUENCE ManifestCID=$manifest_cid"
warn "The local bootstrap private key remains at deploy/resilient/secrets/publisher.private.pem. Move it off the public server for production publishing."
