#!/bin/bash

set -euo pipefail

PROJECT_DIR=$(cd "$(dirname "$0")" && pwd)
ENV_FILE=${ENV_FILE:-"$PROJECT_DIR/.env"}
WEB_DIR="$PROJECT_DIR/web"
BINARY_DIR="$PROJECT_DIR/bin"
BINARY_PATH="$BINARY_DIR/webssh"
PID_PATH="$PROJECT_DIR/.webssh.pid"

fail() {
    echo "错误: $*" >&2
    exit 1
}

[[ -f "$ENV_FILE" ]] || fail "配置文件不存在: $ENV_FILE"

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

PORT=${PORT:-}
AUTH_USER=${AUTH_USER:-}
AUTH_PASSWORD=${AUTH_PASSWORD:-}
LOG_PATH=${LOG_PATH:-}
CONFIG_PATH=${CONFIG_PATH:-}

[[ "$PORT" =~ ^[0-9]+$ ]] || fail "PORT 必须是数字"
(( PORT >= 1 && PORT <= 65535 )) || fail "PORT 必须在 1 到 65535 之间"
[[ -n "$LOG_PATH" ]] || fail "LOG_PATH 不能为空"
[[ -n "$CONFIG_PATH" ]] || fail "CONFIG_PATH 不能为空"

if [[ -n "$AUTH_USER" || -n "$AUTH_PASSWORD" ]]; then
    [[ -n "$AUTH_USER" && -n "$AUTH_PASSWORD" ]] || fail "AUTH_USER 和 AUTH_PASSWORD 必须同时配置"
    [[ "$AUTH_USER" != *:* && "$AUTH_PASSWORD" != *:* ]] || fail "账号和密码不能包含冒号"
fi

if [[ "$LOG_PATH" != /* ]]; then
    LOG_PATH="$PROJECT_DIR/${LOG_PATH#./}"
fi
if [[ "$CONFIG_PATH" != /* ]]; then
    CONFIG_PATH="$PROJECT_DIR/${CONFIG_PATH#./}"
fi

port_in_use() {
    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
    elif command -v ss >/dev/null 2>&1; then
        ss -ltn "( sport = :$PORT )" | awk 'NR > 1 { found = 1 } END { exit !found }'
    else
        (echo >/dev/tcp/127.0.0.1/"$PORT") >/dev/null 2>&1
    fi
}

if port_in_use; then
    fail "端口 $PORT 已被占用，请停止现有服务或修改 .env"
fi

echo "[1/3] 编译前端..."
(
    cd "$WEB_DIR"
    if [[ ! -d node_modules ]]; then
        npm ci
    fi
    node_major=$(env -u NODE_OPTIONS node -p "process.versions.node.split('.')[0]")
    clean_node_options=${NODE_OPTIONS:-}
    clean_node_options=${clean_node_options//--openssl-legacy-provider/}
    if (( node_major >= 17 )); then
        legacy_node_options="$clean_node_options --openssl-legacy-provider"
        if NODE_OPTIONS="$legacy_node_options" node -e "" >/dev/null 2>&1; then
            NODE_OPTIONS="$legacy_node_options" ./node_modules/.bin/vue-cli-service build
        else
            NODE_OPTIONS="$clean_node_options" ./node_modules/.bin/vue-cli-service build
        fi
    else
        NODE_OPTIONS="$clean_node_options" ./node_modules/.bin/vue-cli-service build
    fi
)

echo "[2/3] 编译 Go 程序..."
mkdir -p "$BINARY_DIR"
(
    cd "$PROJECT_DIR"
    local_go_version=$(GOTOOLCHAIN=local go version | awk '{ print $3 }')
    if [[ ! "$local_go_version" =~ ^go([0-9]+)\.([0-9]+) ]]; then
        fail "无法识别本地 Go 版本: $local_go_version"
    fi
    go_major=${BASH_REMATCH[1]}
    go_minor=${BASH_REMATCH[2]}
    if (( go_major < 1 || (go_major == 1 && go_minor < 21) )); then
        fail "本地 Go 版本为 $local_go_version，项目至少需要 Go 1.21"
    fi
    GOTOOLCHAIN=local go build -o "$BINARY_PATH" .
)

echo "[3/3] 后台启动服务..."
mkdir -p "$(dirname "$LOG_PATH")"
mkdir -p "$CONFIG_PATH"

run_args=(-p "$PORT" -c "$CONFIG_PATH")
if [[ -n "$AUTH_USER" ]]; then
    run_args+=(-a "$AUTH_USER:$AUTH_PASSWORD")
fi

nohup "$BINARY_PATH" "${run_args[@]}" >> "$LOG_PATH" 2>&1 < /dev/null &
pid=$!
echo "$pid" > "$PID_PATH"

sleep 1
if ! kill -0 "$pid" >/dev/null 2>&1; then
    fail "服务启动失败，请检查日志: $LOG_PATH"
fi

echo "WebSSH 已启动"
echo "PID: $pid"
echo "端口: $PORT"
echo "日志: $LOG_PATH"
