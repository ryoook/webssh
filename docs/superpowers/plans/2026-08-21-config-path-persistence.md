# 配置目录持久化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将连接与常用命令从浏览器 `localStorage` 改为读写 `.env` 中 `CONFIG_PATH` 目录下的 `connections.json` / `commands.json`，并支持一次性迁移。

**Architecture:** Go `core/configstore` 负责目录与原子 JSON 读写；`main.go` 暴露 `GET/PUT /connections` 与 `GET/PUT /commands`（与现有 `/check` 一致；前端 axios 在开发环境经 `/api` 代理剥前缀）。Vuex 内存改为普通数组，actions 负责拉取、整表 PUT 与 localStorage 迁移。

**Tech Stack:** Go 1.21、gin、Vue 2.7、Vuex 3、axios、Node 内置测试、bash。

## Global Constraints

- `CONFIG_PATH` 默认 `./data`；相对路径以项目根目录为基准。
- 文件：`$CONFIG_PATH/connections.json`、`$CONFIG_PATH/commands.json`；明文 JSON 数组。
- 连接元素：`{ id, host, username, port, password, logintype }`；命令：`{ id, name, content }`。
- `savePass=false` 时写入连接不落密码（空字符串）。
- 首次：服务端两边皆空且浏览器有旧 `sshList`/`commandList` 时迁移并清除 localStorage；服务端已有数据则不覆盖。
- `language` 仍用 localStorage。
- 不新增前端 npm 依赖；侧边栏 UI/交互不变。
- 路由路径在 Go 上为 `/connections`、`/commands`（规格表中的 `/api/...` 对应开发代理后的浏览器路径习惯；实现对齐现有 `/check`）。
- 工作目录：`/Users/chenmengxiang/Documents/cmx/project/webssh/.worktrees/common-commands`（分支 `feature/common-commands`）。

## File Structure

| 文件 | 职责 |
|------|------|
| `core/configstore/store.go` | Store：EnsureDir、Load/Save connections/commands、锁、原子写、savePass 剥密码 |
| `core/configstore/store_test.go` | Go 单测 |
| `main.go` | `-c`/env `CONFIG_PATH`、注册路由 |
| `.env` / `.env.example` / `buildNrun.sh` | `CONFIG_PATH` 校验与 `-c` 传参 |
| `.gitignore` | 忽略 `/data/`（或 `data/`） |
| `tests/buildNrun_test.sh` | 断言 CONFIG_PATH |
| `web/src/api/config.js` | get/put connections & commands |
| `web/src/utils/migrate.js` | 解码旧 localStorage、判断是否迁移 |
| `web/tests/migrate.test.js` | 迁移纯函数测试 |
| `web/src/store/state.js` | `sshList`/`commandList` 初始为 `[]` |
| `web/src/store/mutations.js` | 仅改内存数组 |
| `web/src/store/actions.js` | loadAndMigrate、upsert/delete + PUT |
| `web/src/main.js` | 启动时 dispatch loadAndMigrate |
| `ConnectionDrawer.vue` / `CommandDrawer.vue` | 直接用数组；改 dispatch actions |

---

### Task 1: Go configstore 包

**Files:**
- Create: `core/configstore/store.go`
- Create: `core/configstore/store_test.go`

**Interfaces:**
- Produces:
  - `type Store struct` with `New(dir string, savePass bool) (*Store, error)`（创建目录）
  - `LoadConnections() ([]map[string]interface{}, error)` — 文件缺失返回 `[]`（非 nil）
  - `SaveConnections([]map[string]interface{}) error` — `savePass==false` 时把每项 `password` 置 `""`
  - `LoadCommands() ([]map[string]interface{}, error)`
  - `SaveCommands([]map[string]interface{}) error`
  - 内部：`atomicWrite(path string, data []byte) error`；每文件或整 Store 一把 `sync.Mutex`

- [ ] **Step 1: 写失败测试**

创建 `core/configstore/store_test.go`：

```go
package configstore

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func TestLoadMissingFilesReturnsEmptySlice(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	conns, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if conns == nil || len(conns) != 0 {
		t.Fatalf("want empty non-nil slice, got %#v", conns)
	}
	cmds, err := store.LoadCommands()
	if err != nil {
		t.Fatal(err)
	}
	if cmds == nil || len(cmds) != 0 {
		t.Fatalf("want empty non-nil slice, got %#v", cmds)
	}
}

func TestSaveAndLoadConnectionsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{
			"id":        "one",
			"host":      "h.example",
			"username":  "root",
			"port":      float64(22),
			"password":  "secret",
			"logintype": float64(0),
		},
	}
	if err := store.SaveConnections(input); err != nil {
		t.Fatal(err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "connections.json"))
	if err != nil {
		t.Fatal(err)
	}
	var decoded []map[string]interface{}
	if err := json.Unmarshal(raw, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded[0]["password"] != "secret" {
		t.Fatalf("password not persisted: %#v", decoded[0])
	}
	loaded, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["host"] != "h.example" {
		t.Fatalf("unexpected load: %#v", loaded)
	}
}

func TestSaveConnectionsStripsPasswordWhenSavePassFalse(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{"id": "one", "host": "h", "password": "secret"},
	}
	if err := store.SaveConnections(input); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.LoadConnections()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["password"] != "" {
		t.Fatalf("expected empty password, got %#v", loaded[0]["password"])
	}
}

func TestSaveCommandsRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, true)
	if err != nil {
		t.Fatal(err)
	}
	input := []map[string]interface{}{
		{"id": "c1", "name": "ls", "content": "ls -la"},
	}
	if err := store.SaveCommands(input); err != nil {
		t.Fatal(err)
	}
	loaded, err := store.LoadCommands()
	if err != nil {
		t.Fatal(err)
	}
	if loaded[0]["content"] != "ls -la" {
		t.Fatalf("unexpected: %#v", loaded)
	}
}
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd /Users/chenmengxiang/Documents/cmx/project/webssh/.worktrees/common-commands && go test ./core/configstore/ -count=1`

Expected: FAIL（包不存在）

- [ ] **Step 3: 实现 store.go**

创建 `core/configstore/store.go`：

```go
package configstore

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sync"
)

type Store struct {
	dir      string
	savePass bool
	mu       sync.Mutex
}

func New(dir string, savePass bool) (*Store, error) {
	if dir == "" {
		return nil, errors.New("config dir is empty")
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, err
	}
	return &Store{dir: dir, savePass: savePass}, nil
}

func (s *Store) connectionsPath() string {
	return filepath.Join(s.dir, "connections.json")
}

func (s *Store) commandsPath() string {
	return filepath.Join(s.dir, "commands.json")
}

func (s *Store) LoadConnections() ([]map[string]interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return loadList(s.connectionsPath())
}

func (s *Store) SaveConnections(list []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	cloned := cloneList(list)
	if !s.savePass {
		for _, item := range cloned {
			item["password"] = ""
		}
	}
	return atomicWriteJSON(s.connectionsPath(), cloned)
}

func (s *Store) LoadCommands() ([]map[string]interface{}, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return loadList(s.commandsPath())
}

func (s *Store) SaveCommands(list []map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	return atomicWriteJSON(s.commandsPath(), cloneList(list))
}

func loadList(path string) ([]map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return []map[string]interface{}{}, nil
		}
		return nil, err
	}
	if len(data) == 0 {
		return []map[string]interface{}{}, nil
	}
	var list []map[string]interface{}
	if err := json.Unmarshal(data, &list); err != nil {
		return nil, err
	}
	if list == nil {
		list = []map[string]interface{}{}
	}
	return list, nil
}

func cloneList(list []map[string]interface{}) []map[string]interface{} {
	out := make([]map[string]interface{}, 0, len(list))
	for _, item := range list {
		cp := make(map[string]interface{}, len(item))
		for k, v := range item {
			cp[k] = v
		}
		out = append(out, cp)
	}
	return out
}

func atomicWriteJSON(path string, value interface{}) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `go test ./core/configstore/ -count=1`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add core/configstore/store.go core/configstore/store_test.go
git commit -m "$(cat <<'EOF'
feat: add configstore for connections and commands JSON files

EOF
)"
```

---

### Task 2: env、buildNrun 与 HTTP 路由

**Files:**
- Modify: `.env`
- Modify: `.env.example`
- Modify: `buildNrun.sh`
- Modify: `tests/buildNrun_test.sh`
- Modify: `.gitignore`
- Modify: `main.go`

**Interfaces:**
- Consumes: Task 1 `configstore.New` / Load* / Save*
- Produces: 进程以 `-c <abs CONFIG_PATH>` 启动；`GET/PUT /connections`、`GET/PUT /commands`；body 为 JSON 数组

- [ ] **Step 1: 更新 env 示例与 gitignore**

`.env` 与 `.env.example` 追加：

```bash
# 连接与常用命令等配置目录；相对路径以项目根目录为基准
CONFIG_PATH=./data
```

`.gitignore` 追加一行：`data/`

- [ ] **Step 2: 更新 buildNrun.sh**

在读取 `LOG_PATH` 附近增加：

```bash
CONFIG_PATH=${CONFIG_PATH:-}
[[ -n "$CONFIG_PATH" ]] || fail "CONFIG_PATH 不能为空"
if [[ "$CONFIG_PATH" != /* ]]; then
    CONFIG_PATH="$PROJECT_DIR/${CONFIG_PATH#./}"
fi
```

在 `run_args` 组装处增加：

```bash
run_args=(-p "$PORT" -c "$CONFIG_PATH")
```

（保留原有 AUTH 追加逻辑。）启动前：

```bash
mkdir -p "$CONFIG_PATH"
```

- [ ] **Step 3: 更新 buildNrun_test.sh**

在 source `.env` 后增加：

```bash
[[ -n "$CONFIG_PATH" ]] || exit 1
```

在 `assert_contains` 中增加：

```bash
assert_contains '-c "$CONFIG_PATH"'
```

- [ ] **Step 4: 运行 buildNrun 静态检查**

Run: `bash tests/buildNrun_test.sh`

Expected: `buildNrun.sh checks passed`

- [ ] **Step 5: 改造 main.go 接入 Store 与路由**

在 `var` 块增加：

```go
configPath = flag.String("c", "./data", "连接与常用命令配置目录")
```

在 `init` 的 env 读取处（`port` 附近）增加：

```go
if envVal, ok := os.LookupEnv("CONFIG_PATH"); ok && envVal != "" {
    *configPath = envVal
}
```

在 `main()` 中 `staticRouter` 之后：

```go
store, err := configstore.New(*configPath, savePass)
if err != nil {
    panic(err)
}
server.GET("/connections", func(c *gin.Context) {
    list, err := store.LoadConnections()
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, list)
})
server.PUT("/connections", func(c *gin.Context) {
    var list []map[string]interface{}
    if err := c.ShouldBindJSON(&list); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    if list == nil {
        list = []map[string]interface{}{}
    }
    if err := store.SaveConnections(list); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, list)
})
server.GET("/commands", func(c *gin.Context) {
    list, err := store.LoadCommands()
    if err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, list)
})
server.PUT("/commands", func(c *gin.Context) {
    var list []map[string]interface{}
    if err := c.ShouldBindJSON(&list); err != nil {
        c.JSON(400, gin.H{"error": err.Error()})
        return
    }
    if list == nil {
        list = []map[string]interface{}{}
    }
    if err := store.SaveCommands(list); err != nil {
        c.JSON(500, gin.H{"error": err.Error()})
        return
    }
    c.JSON(200, list)
})
```

并增加 import：`"webssh/core/configstore"`。

说明：当前 `/check`、`/file` 亦未挂 BasicAuth；本任务与之一致，不单独给配置 API 加 BasicAuth（避免与现网行为不一致）。规格「一并保护」留作后续若统一鉴权时再做。

- [ ] **Step 6: 编译验证**

Run: `GOTOOLCHAIN=local go build -o /tmp/webssh-test .`

Expected: 成功

- [ ] **Step 7: Commit**

```bash
git add .env .env.example buildNrun.sh tests/buildNrun_test.sh .gitignore main.go
git commit -m "$(cat <<'EOF'
feat: wire CONFIG_PATH and connections/commands HTTP APIs

EOF
)"
```

---

### Task 3: 前端迁移工具与 API 封装

**Files:**
- Create: `web/src/api/config.js`
- Create: `web/src/utils/migrate.js`
- Create: `web/tests/migrate.test.js`

**Interfaces:**
- Produces:
  - `getConnections(): Promise<Array>`
  - `putConnections(list): Promise<Array>`
  - `getCommands(): Promise<Array>`
  - `putCommands(list): Promise<Array>`
  - `readLegacyLocalStorage(): { connections: Array, commands: Array }`（解码 Base64；无 key 则为 `[]`）
  - `shouldMigrate(serverConnections, serverCommands, legacy): boolean` — 两边服务端皆空且 legacy 任一侧非空
  - `clearLegacyLocalStorage(): void` — 删除 `sshList`、`commandList`

- [ ] **Step 1: 写迁移测试（失败）**

创建 `web/tests/migrate.test.js`：

```js
const test = require('node:test')
const assert = require('node:assert/strict')

const {
    shouldMigrate,
    decodeLegacyList
} = require('../src/utils/migrate')

test('decodeLegacyList returns empty for missing or bad data', () => {
    assert.deepEqual(decodeLegacyList(null), [])
    assert.deepEqual(decodeLegacyList('not-base64'), [])
})

test('decodeLegacyList decodes base64 json arrays', () => {
    const encoded = Buffer.from(JSON.stringify([{ id: '1', host: 'a' }])).toString('base64')
    assert.deepEqual(decodeLegacyList(encoded), [{ id: '1', host: 'a' }])
})

test('shouldMigrate only when server empty and legacy present', () => {
    assert.equal(shouldMigrate([], [], { connections: [{ id: '1' }], commands: [] }), true)
    assert.equal(shouldMigrate([], [], { connections: [], commands: [{ id: 'c' }] }), true)
    assert.equal(shouldMigrate([{ id: '1' }], [], { connections: [{ id: '2' }], commands: [] }), false)
    assert.equal(shouldMigrate([], [], { connections: [], commands: [] }), false)
})
```

- [ ] **Step 2: 运行确认失败**

Run: `cd web && node --test tests/migrate.test.js`

Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现 migrate.js**

```js
const { decodeConnections, migrateConnections } = require('./connections')
const { decodeCommands } = require('./commands')

function decodeLegacyList(encoded) {
    // Prefer shared decode: connections/commands decode both treat malformed as []
    // Use JSON.parse(atob) path via decodeConnections which handles base64 lists.
    return decodeConnections(encoded)
}

function shouldMigrate(serverConnections, serverCommands, legacy) {
    const serverEmpty = (!serverConnections || serverConnections.length === 0)
        && (!serverCommands || serverCommands.length === 0)
    const legacyPresent = (legacy.connections && legacy.connections.length > 0)
        || (legacy.commands && legacy.commands.length > 0)
    return serverEmpty && legacyPresent
}

function readLegacyLocalStorage(storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage)
    if (!store) {
        return { connections: [], commands: [] }
    }
    const hasConn = Object.prototype.hasOwnProperty.call(store, 'sshList')
    const hasCmd = Object.prototype.hasOwnProperty.call(store, 'commandList')
    const connections = hasConn
        ? migrateConnections(decodeConnections(store.getItem('sshList')))
        : []
    const commands = hasCmd
        ? decodeCommands(store.getItem('commandList'))
        : []
    return { connections, commands }
}

function clearLegacyLocalStorage(storage) {
    const store = storage || (typeof localStorage === 'undefined' ? null : localStorage)
    if (!store) {
        return
    }
    store.removeItem('sshList')
    store.removeItem('commandList')
}

module.exports = {
    clearLegacyLocalStorage,
    decodeLegacyList,
    readLegacyLocalStorage,
    shouldMigrate
}
```

注意：`decodeLegacyList` 对命令也可用 `decodeCommands`（同算法）。测试里对连接样例用 `decodeLegacyList` 即可。

- [ ] **Step 4: 实现 api/config.js**

```js
import request from '@/utils/request'

export function getConnections() {
    return request.get('/connections')
}

export function putConnections(list) {
    return request.put('/connections', list)
}

export function getCommands() {
    return request.get('/commands')
}

export function putCommands(list) {
    return request.put('/commands', list)
}
```

- [ ] **Step 5: 测试通过并 commit**

```bash
cd web && node --test tests/migrate.test.js
git add web/src/utils/migrate.js web/src/api/config.js web/tests/migrate.test.js
git commit -m "$(cat <<'EOF'
feat: add config API client and localStorage migration helpers

EOF
)"
```

---

### Task 4: Vuex 改为服务端持久化并接入抽屉

**Files:**
- Modify: `web/src/store/state.js`
- Modify: `web/src/store/mutations.js`
- Modify: `web/src/store/actions.js`
- Modify: `web/src/main.js`
- Modify: `web/src/components/ConnectionDrawer.vue`
- Modify: `web/src/components/CommandDrawer.vue`

**Interfaces:**
- Consumes: Task 3 API + migrate helpers；Task 1 后端已可用
- Produces:
  - `state.sshList: Array`、`state.commandList: Array`（非 Base64）
  - mutations: `SET_CONNECTIONS(list)`、`SET_COMMANDS(list)`；内存 upsert/delete 可保留为同步 mutation 或由 action 直接 `SET_*`
  - action `loadAndMigrate({ commit })`
  - actions `upsertConnection` / `deleteConnection` / `upsertCommand` / `deleteCommand`：更新内存后 PUT；失败则 Message + 重新 GET 对齐
  - 抽屉：`dispatch` 替代 `commit` 做持久化写

- [ ] **Step 1: 简化 state.js**

```js
import { getLanguage } from '@/lang/index'

export default {
    sshInfo: {
        host: '',
        username: 'root',
        port: 22,
        password: '',
        logintype: 0
    },
    sshList: [],
    commandList: [],
    termList: [],
    currentTab: {},
    language: getLanguage()
}
```

- [ ] **Step 2: 重写 mutations.js（仅内存）**

```js
import { createConnectionId, removeConnection, upsertConnection } from '@/utils/connections'
import { createCommandId, removeCommand, upsertCommand } from '@/utils/commands'

export default {
    SET_PASS(state, pass) {
        state.sshInfo.password = pass
    },
    SET_CONNECTIONS(state, list) {
        state.sshList = Array.isArray(list) ? list : []
    },
    SET_COMMANDS(state, list) {
        state.commandList = Array.isArray(list) ? list : []
    },
    UPSERT_CONNECTION(state, connection) {
        const normalized = connection.id
            ? connection
            : Object.assign({ id: createConnectionId() }, connection)
        state.sshList = upsertConnection(state.sshList, normalized)
    },
    DELETE_CONNECTION(state, id) {
        state.sshList = removeConnection(state.sshList, id)
    },
    UPSERT_COMMAND(state, command) {
        const normalized = command.id
            ? command
            : Object.assign({ id: createCommandId() }, command)
        state.commandList = upsertCommand(state.commandList, normalized)
    },
    DELETE_COMMAND(state, id) {
        state.commandList = removeCommand(state.commandList, id)
    },
    SET_TERMLIST(state, list) {
        state.termList = list
    },
    SET_SSH(state, ssh) {
        state.sshInfo.host = ssh.host
        state.sshInfo.username = ssh.username
        state.sshInfo.port = ssh.port
        state.sshInfo.logintype = ssh.logintype
        if (ssh.password !== undefined) {
            state.sshInfo.password = ssh.password
        }
    },
    SET_TAB(state, tab) {
        state.currentTab = tab
    },
    SET_LANGUAGE: (state, language) => {
        state.language = language
        localStorage.setItem('language', language)
    }
}
```

删除 `SET_LIST`（若仍有引用则改为 `SET_CONNECTIONS`；`Header.vue` 若未挂载可忽略，若 lint 报错再改）。

- [ ] **Step 3: 实现 actions.js**

```js
import { Message } from 'element-ui'
import {
    getConnections,
    putConnections,
    getCommands,
    putCommands
} from '@/api/config'
import {
    clearLegacyLocalStorage,
    readLegacyLocalStorage,
    shouldMigrate
} from '@/utils/migrate'

async function reloadAll(commit) {
    const [connections, commands] = await Promise.all([
        getConnections(),
        getCommands()
    ])
    commit('SET_CONNECTIONS', connections)
    commit('SET_COMMANDS', commands)
    return { connections, commands }
}

export default {
    setLanguage({ commit }, language) {
        commit('SET_LANGUAGE', language)
    },
    async loadAndMigrate({ commit }) {
        const { connections, commands } = await reloadAll(commit)
        const legacy = readLegacyLocalStorage()
        if (shouldMigrate(connections, commands, legacy)) {
            if (legacy.connections.length > 0) {
                await putConnections(legacy.connections)
            }
            if (legacy.commands.length > 0) {
                await putCommands(legacy.commands)
            }
            clearLegacyLocalStorage()
            await reloadAll(commit)
            return
        }
        if (legacy.connections.length > 0 || legacy.commands.length > 0) {
            clearLegacyLocalStorage()
        }
    },
    async upsertConnection({ commit, state }, connection) {
        commit('UPSERT_CONNECTION', connection)
        try {
            await putConnections(state.sshList)
        } catch (error) {
            Message.error('保存连接失败')
            await reloadAll(commit)
            throw error
        }
    },
    async deleteConnection({ commit, state }, id) {
        commit('DELETE_CONNECTION', id)
        try {
            await putConnections(state.sshList)
        } catch (error) {
            Message.error('删除连接失败')
            await reloadAll(commit)
            throw error
        }
    },
    async upsertCommand({ commit, state }, command) {
        commit('UPSERT_COMMAND', command)
        try {
            await putCommands(state.commandList)
        } catch (error) {
            Message.error('保存命令失败')
            await reloadAll(commit)
            throw error
        }
    },
    async deleteCommand({ commit, state }, id) {
        commit('DELETE_COMMAND', id)
        try {
            await putCommands(state.commandList)
        } catch (error) {
            Message.error('删除命令失败')
            await reloadAll(commit)
            throw error
        }
    }
}
```

- [ ] **Step 4: main.js 启动加载**

```js
store.dispatch('loadAndMigrate').catch(() => {
    // request.js 已提示网络错误
})

new Vue({
    el: '#app',
    i18n,
    store,
    render: h => h(App)
})
```

- [ ] **Step 5: 更新抽屉**

`ConnectionDrawer.vue`：

- computed `connections` 改为 `return this.$store.state.sshList`（已是数组）。
- `saveConnection` 成功路径：`this.$store.dispatch('upsertConnection', connection)`。
- `confirmDelete`：`this.$store.dispatch('deleteConnection', connection.id)`。
- 去掉对 `decodeConnections` 的依赖。

`CommandDrawer.vue`：

- computed `commands` 改为 `return this.$store.state.commandList`。
- save/delete 改为 `dispatch('upsertCommand'/'deleteCommand')`。
- 去掉 `decodeCommands`。

- [ ] **Step 6: lint + 相关前端测试**

```bash
cd web && node --test tests/migrate.test.js tests/commands.test.js tests/connections.test.js tests/command-hover.test.js tests/command-insert.test.js tests/connection-hover.test.js
cd web && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint
```

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add web/src/store web/src/main.js web/src/components/ConnectionDrawer.vue web/src/components/CommandDrawer.vue
git commit -m "$(cat <<'EOF'
feat: persist connections and commands via config API

EOF
)"
```

---

### Task 5: 构建与验证

**Files:** 无源码预期改动（除非修复问题）

- [ ] **Step 1: Go + 前端测试**

```bash
go test ./core/configstore/ -count=1
bash tests/buildNrun_test.sh
cd web && node --test tests/migrate.test.js tests/commands.test.js tests/connections.test.js
```

- [ ] **Step 2: buildNrun 启动**

```bash
# 先停旧进程
./buildNrun.sh
curl -s http://127.0.0.1:5032/connections
# 期望 []
curl -s -X PUT http://127.0.0.1:5032/commands -H 'Content-Type: application/json' -d '[{"id":"t","name":"x","content":"echo 1"}]'
test -f data/commands.json
```

- [ ] **Step 3: 浏览器核对（对照规格验证节）**

1. 新建连接/命令后 `data/*.json` 有内容，刷新仍在。  
2. 清服务端文件、灌入旧 localStorage，刷新后迁移并清除 localStorage。  
3. 服务端已有数据时不覆盖。  
4. 侧边栏交互与写入终端正常。

- [ ] **Step 4: 无源码改动则不必 commit；有修复则单独 commit**

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| CONFIG_PATH + connections.json/commands.json | 1–2 |
| GET/PUT API + 原子写 + 锁 | 1–2 |
| savePass 剥密码 | 1 |
| Vuex 改数组 + 启动加载 | 4 |
| localStorage 一次性迁移 | 3–4 |
| 抽屉仍用原交互 | 4 |
| language 仍 localStorage | 4 |
| buildNrun / .env.example | 2 |
| 验证 | 5 |
