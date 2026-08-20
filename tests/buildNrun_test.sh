#!/bin/bash

set -euo pipefail

project_dir=$(cd "$(dirname "$0")/.." && pwd)
script_path="$project_dir/buildNrun.sh"
env_path="$project_dir/.env"
example_path="$project_dir/.env.example"

[[ -f "$script_path" ]]
[[ -x "$script_path" ]]
[[ -f "$env_path" ]]
[[ -f "$example_path" ]]

bash -n "$script_path"

set -a
# shellcheck disable=SC1090
source "$env_path"
set +a

[[ "$PORT" =~ ^[0-9]+$ ]]
[[ -n "$LOG_PATH" ]]

script_content=$(<"$script_path")
[[ "$script_content" == *'port_in_use'* ]]
[[ "$script_content" == *'npm ci'* ]]
[[ "$script_content" == *'vue-cli-service build'* ]]
[[ "$script_content" == *'go build'* ]]
[[ "$script_content" == *'nohup'* ]]
[[ "$script_content" == *'>> "$LOG_PATH" 2>&1'* ]]

echo "buildNrun.sh checks passed"
