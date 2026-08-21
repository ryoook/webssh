#!/bin/bash

set -euo pipefail

project_dir=$(cd "$(dirname "$0")/.." && pwd)
script_path="$project_dir/buildNrun.sh"
env_path="$project_dir/.env"
example_path="$project_dir/.env.example"
go_mod_path="$project_dir/go.mod"

assert() {
    "$@" || {
        echo "assertion failed: $*" >&2
        exit 1
    }
}

assert test -f "$script_path"
assert test -x "$script_path"
assert test -f "$env_path"
assert test -f "$example_path"

assert bash -n "$script_path"

set -a
# shellcheck disable=SC1090
source "$env_path"
set +a

[[ "$PORT" =~ ^[0-9]+$ ]] || exit 1
[[ -n "$LOG_PATH" ]] || exit 1
[[ -n "$CONFIG_PATH" ]] || exit 1

script_content=$(<"$script_path")
assert_contains() {
    [[ "$script_content" == *"$1"* ]] || {
        echo "missing script content: $1" >&2
        exit 1
    }
}

assert_contains 'port_in_use'
assert_contains 'npm ci'
assert_contains 'vue-cli-service build'
assert_contains 'node_major='
assert_contains 'if (( node_major >= 17 ))'
assert_contains 'go build'
assert_contains 'GOTOOLCHAIN=local'
assert_contains 'nohup'
assert_contains '>> "$LOG_PATH" 2>&1'
assert_contains '-c "$CONFIG_PATH"'

go_mod_content=$(<"$go_mod_path")
[[ "$go_mod_content" == *'go 1.21.0'* ]] || {
    echo "go.mod must target Go 1.21.0" >&2
    exit 1
}

echo "buildNrun.sh checks passed"
