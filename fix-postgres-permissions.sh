#!/usr/bin/env bash
exec sudo bash "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/scripts/fix-postgres-permissions.sh" "$@"
