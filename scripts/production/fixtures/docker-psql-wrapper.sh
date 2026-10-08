#!/usr/bin/env bash
set -Eeuo pipefail

container=${SAFE_MIGRATION_DOCKER_CONTAINER:?SAFE_MIGRATION_DOCKER_CONTAINER is required}
database=${SAFE_MIGRATION_DOCKER_DATABASE:-postgres}
user=${SAFE_MIGRATION_DOCKER_USER:-postgres}
args=()
while (($#)); do
  case "$1" in
    --dbname) shift 2 ;;
    *) args+=("$1"); shift ;;
  esac
done
exec docker exec -i "$container" psql -U "$user" -d "$database" "${args[@]}"
