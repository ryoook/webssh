# 常用命令抽屉 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在右侧「连接」按钮上方增加「常用命令」抽屉，支持新建/管理/点击写入当前终端（不自动回车）。

**Architecture:** 独立 `CommandDrawer.vue` 复刻连接抽屉的 hover/侧栏/管理模式；命令列表以 Base64 JSON 存 `localStorage.commandList`；通过 `App → Tabs.insertToCurrentTerm → Terminal.insertText → term.paste` 写入当前 tab。

**Tech Stack:** Vue 2.7、Vuex 3、Element UI 2.15、xterm 4.19、Node.js 内置测试运行器。

## Global Constraints

- 点击命令只填入文本，不追加回车、不自动执行。
- 无打开的终端 tab 或 `term` 未就绪时：`Message.warning` 提示请先打开终端，不写入。
- 数据 key：`commandList`；结构：`{ id, name, content }`。
- 内容字段为多行 textarea。
- 不新增前端依赖；不改连接抽屉业务逻辑（仅调整触发按钮垂直位置）。
- 测试在 `web/` 目录下执行：`node --test tests/<file>.test.js`。
- macOS/Linux lint/build 使用：`NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint|build`。

## File Structure

| 文件 | 职责 |
|------|------|
| `web/src/utils/commands.js` | 命令列表 encode/decode/upsert/remove/createId |
| `web/tests/commands.test.js` | 工具函数单测 |
| `web/src/store/state.js` | 初始化 `commandList` |
| `web/src/store/mutations.js` | `UPSERT_COMMAND` / `DELETE_COMMAND` |
| `web/src/components/Terminal.vue` | `insertText(text)` → `term.paste(text)` |
| `web/src/components/Tabs.vue` | `insertToCurrentTerm(text)` → 当前 Terminal |
| `web/src/components/CommandDrawer.vue` | 按钮、抽屉、表单、列表 |
| `web/src/App.vue` | 挂载抽屉，处理 `@insert` |
| `web/src/components/ConnectionDrawer.vue` | 触发按钮下移避让 |
| `web/src/lang/zh.js` / `en.js` | 文案 |
| `web/tests/command-hover.test.js` | hover/无 modal 静态断言 |
| `web/tests/command-insert.test.js` | insert 链路静态断言 |

---

### Task 1: 命令列表数据工具

**Files:**
- Create: `web/src/utils/commands.js`
- Create: `web/tests/commands.test.js`

**Interfaces:**
- Produces:
  - `createCommandId(): string`
  - `decodeCommands(encoded: string|null): Array<{id,name,content}>`
  - `encodeCommands(commands: Array): string`
  - `upsertCommand(commands, command): Array`（不可变）
  - `removeCommand(commands, id): Array`（不可变）

- [ ] **Step 1: 写失败测试**

创建 `web/tests/commands.test.js`：

```js
const test = require('node:test')
const assert = require('node:assert/strict')

const {
    decodeCommands,
    encodeCommands,
    upsertCommand,
    removeCommand
} = require('../src/utils/commands')

test('decodes an empty or encoded command list', () => {
    assert.deepEqual(decodeCommands(null), [])

    const encoded = Buffer.from(JSON.stringify([
        { id: 'one', name: 'ls', content: 'ls -la' }
    ])).toString('base64')
    assert.deepEqual(decodeCommands(encoded), [
        { id: 'one', name: 'ls', content: 'ls -la' }
    ])
})

test('returns an empty list for malformed stored data', () => {
    assert.deepEqual(decodeCommands('not-base64-json'), [])
})

test('encodes data that can be decoded again', () => {
    const commands = [{ id: 'one', name: 'df', content: 'df -h' }]
    assert.deepEqual(decodeCommands(encodeCommands(commands)), commands)
})

test('adds and updates commands without mutating the input list', () => {
    const original = [{ id: 'one', name: 'old', content: 'echo old' }]
    const added = upsertCommand(original, { id: 'two', name: 'new', content: 'echo new' })
    const updated = upsertCommand(original, { id: 'one', name: 'updated', content: 'echo updated' })

    assert.deepEqual(original, [{ id: 'one', name: 'old', content: 'echo old' }])
    assert.deepEqual(added, [
        { id: 'one', name: 'old', content: 'echo old' },
        { id: 'two', name: 'new', content: 'echo new' }
    ])
    assert.deepEqual(updated, [{ id: 'one', name: 'updated', content: 'echo updated' }])
})

test('removes a command by id without mutating the input list', () => {
    const original = [
        { id: 'one', name: 'a', content: 'echo a' },
        { id: 'two', name: 'b', content: 'echo b' }
    ]

    assert.deepEqual(removeCommand(original, 'one'), [
        { id: 'two', name: 'b', content: 'echo b' }
    ])
    assert.equal(original.length, 2)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && node --test tests/commands.test.js`

Expected: FAIL（模块不存在 / `Cannot find module`）

- [ ] **Step 3: 实现工具模块**

创建 `web/src/utils/commands.js`（与 `connections.js` 同模式）：

```js
function encodeBase64(value) {
    if (typeof window === 'undefined') {
        return Buffer.from(value, 'utf8').toString('base64')
    }
    const bytes = new TextEncoder().encode(value)
    let binary = ''
    bytes.forEach(byte => {
        binary += String.fromCharCode(byte)
    })
    return window.btoa(binary)
}

function decodeBase64(value) {
    if (typeof window === 'undefined') {
        return Buffer.from(value, 'base64').toString('utf8')
    }
    const binary = window.atob(value)
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0))
    return new TextDecoder().decode(bytes)
}

function decodeCommands(encoded) {
    if (!encoded) {
        return []
    }
    try {
        const commands = JSON.parse(decodeBase64(encoded))
        return Array.isArray(commands) ? commands : []
    } catch (error) {
        return []
    }
}

function encodeCommands(commands) {
    return encodeBase64(JSON.stringify(commands))
}

function createCommandId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function upsertCommand(commands, command) {
    const index = commands.findIndex(item => item.id === command.id)
    if (index === -1) {
        return commands.concat([Object.assign({}, command)])
    }
    return commands.map(item => item.id === command.id
        ? Object.assign({}, command)
        : Object.assign({}, item)
    )
}

function removeCommand(commands, id) {
    return commands
        .filter(command => command.id !== id)
        .map(command => Object.assign({}, command))
}

module.exports = {
    createCommandId,
    decodeCommands,
    encodeCommands,
    removeCommand,
    upsertCommand
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd web && node --test tests/commands.test.js`

Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/utils/commands.js web/tests/commands.test.js
git commit -m "$(cat <<'EOF'
feat: add common commands storage helpers

EOF
)"
```

---

### Task 2: Vuex 持久化命令列表

**Files:**
- Modify: `web/src/store/state.js`
- Modify: `web/src/store/mutations.js`

**Interfaces:**
- Consumes: Task 1 的 `decodeCommands` / `encodeCommands` / `upsertCommand` / `removeCommand` / `createCommandId`
- Produces: `state.commandList`（编码字符串或 `null`）；`UPSERT_COMMAND(command)`；`DELETE_COMMAND(id)`

- [ ] **Step 1: 扩展 state**

在 `web/src/store/state.js` 顶部增加 commands 导入与初始化（紧挨 connections 初始化之后）：

```js
import {
    decodeCommands,
    encodeCommands
} from '@/utils/commands'

const storedCommands = Object.prototype.hasOwnProperty.call(localStorage, 'commandList')
    ? localStorage.getItem('commandList')
    : null
const encodedCommands = storedCommands === null
    ? null
    : encodeCommands(decodeCommands(storedCommands))
```

在 `export default` 对象中增加：

```js
commandList: encodedCommands,
```

保留现有 `sshInfo` / `sshList` / `termList` / `currentTab` / `language` 不变。

- [ ] **Step 2: 扩展 mutations**

在 `web/src/store/mutations.js` 增加导入：

```js
import {
    createCommandId,
    decodeCommands,
    encodeCommands,
    removeCommand,
    upsertCommand
} from '@/utils/commands'
```

增加辅助函数与 mutations：

```js
function persistCommands(state, commands) {
    const encoded = encodeCommands(commands)
    state.commandList = encoded
    localStorage.setItem('commandList', encoded)
}

// 在 export default 内：
UPSERT_COMMAND(state, command) {
    const normalizedCommand = command.id
        ? command
        : Object.assign({ id: createCommandId() }, command)
    persistCommands(
        state,
        upsertCommand(decodeCommands(state.commandList), normalizedCommand)
    )
},
DELETE_COMMAND(state, id) {
    persistCommands(
        state,
        removeCommand(decodeCommands(state.commandList), id)
    )
},
```

- [ ] **Step 3: 运行工具测试与 lint**

Run:

```bash
cd web && node --test tests/commands.test.js
cd web && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint src/store/state.js src/store/mutations.js
```

Expected: tests PASS；lint 无 error

- [ ] **Step 4: Commit**

```bash
git add web/src/store/state.js web/src/store/mutations.js
git commit -m "$(cat <<'EOF'
feat: persist common commands in vuex

EOF
)"
```

---

### Task 3: 终端写入链路

**Files:**
- Modify: `web/src/components/Terminal.vue`
- Modify: `web/src/components/Tabs.vue`
- Create: `web/tests/command-insert.test.js`

**Interfaces:**
- Produces:
  - `Terminal.insertText(text: string): boolean` — `term` 存在则 `this.term.paste(text)` 并返回 `true`，否则 `false`；不追加 `\r`/`\n`
  - `Tabs.insertToCurrentTerm(text: string): boolean` — 无当前 tab 或 ref/term 不可用返回 `false`；成功写入返回 `true`

- [ ] **Step 1: 写静态失败测试**

创建 `web/tests/command-insert.test.js`：

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const terminal = fs.readFileSync(
    path.join(__dirname, '../src/components/Terminal.vue'),
    'utf8'
)
const tabs = fs.readFileSync(
    path.join(__dirname, '../src/components/Tabs.vue'),
    'utf8'
)

test('Terminal exposes insertText using paste without enter', () => {
    assert.match(terminal, /insertText\s*\(/)
    assert.match(terminal, /this\.term\.paste\(/)
    assert.doesNotMatch(terminal, /insertText[\s\S]{0,200}paste\([^)]*\\r/)
})

test('Tabs exposes insertToCurrentTerm for the active tab', () => {
    assert.match(tabs, /insertToCurrentTerm\s*\(/)
    assert.match(tabs, /insertText\(/)
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd web && node --test tests/command-insert.test.js`

Expected: FAIL（缺少 `insertText` / `insertToCurrentTerm`）

- [ ] **Step 3: 实现 Terminal.insertText**

在 `web/src/components/Terminal.vue` 的 `methods` 中增加：

```js
insertText(text) {
    if (!this.term || text == null || text === '') {
        return false
    }
    this.term.paste(String(text))
    return true
},
```

放在 `setSSH` 方法附近即可。

- [ ] **Step 4: 实现 Tabs.insertToCurrentTerm**

在 `web/src/components/Tabs.vue` 的 `methods` 中增加：

```js
insertToCurrentTerm(text) {
    if (!this.currentTerm || this.termList.length === 0) {
        return false
    }
    const terminalRefs = this.$refs[this.currentTerm]
    const terminal = Array.isArray(terminalRefs) ? terminalRefs[0] : terminalRefs
    if (!terminal || typeof terminal.insertText !== 'function') {
        return false
    }
    return terminal.insertText(text) === true
},
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd web && node --test tests/command-insert.test.js`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Terminal.vue web/src/components/Tabs.vue web/tests/command-insert.test.js
git commit -m "$(cat <<'EOF'
feat: insert text into the active terminal tab

EOF
)"
```

---

### Task 4: CommandDrawer 组件与接入

**Files:**
- Create: `web/src/components/CommandDrawer.vue`
- Modify: `web/src/App.vue`
- Modify: `web/src/lang/zh.js`
- Modify: `web/src/lang/en.js`
- Modify: `web/src/components/ConnectionDrawer.vue`（仅 CSS 位置）
- Create: `web/tests/command-hover.test.js`

**Interfaces:**
- Emits: `insert(content: string)`
- Consumes: `state.commandList`、`UPSERT_COMMAND`、`DELETE_COMMAND`、i18n keys（见 Step 1）
- App: `@insert="insertCommand"` → 调用 `this.$refs.tabs.insertToCurrentTerm(content)`；失败则 `$message.warning(this.$t('OpenTerminalFirst'))`

- [ ] **Step 1: 增加中英文案**

`web/src/lang/zh.js` 追加：

```js
Commands: '常用命令',
NewCommand: '新建',
NoCommands: '暂无常用命令',
EditCommand: '编辑命令',
CommandName: '名称',
CommandContent: '内容',
DeleteCommand: '删除命令',
DeleteCommandConfirm: '确定删除命令 {name} 吗？',
OpenTerminalFirst: '请先打开终端',
nameRequired: '请输入名称',
contentRequired: '请输入内容',
```

（`Manage` / `FinishManaging` / `Edit` / `Delete` / `Save` / `Cancel` / `RequiredValue` / `OK` 已存在，直接复用。）

`web/src/lang/en.js` 追加：

```js
Commands: 'Commands',
NewCommand: 'New',
NoCommands: 'No saved commands',
EditCommand: 'Edit command',
CommandName: 'Name',
CommandContent: 'Content',
DeleteCommand: 'Delete command',
DeleteCommandConfirm: 'Delete command {name}?',
OpenTerminalFirst: 'Please open a terminal first',
nameRequired: 'Please enter a name',
contentRequired: 'Please enter content',
```

- [ ] **Step 2: 写 hover 静态测试（先失败）**

创建 `web/tests/command-hover.test.js`：

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const component = fs.readFileSync(
    path.join(__dirname, '../src/components/CommandDrawer.vue'),
    'utf8'
)

test('opens the command drawer on trigger hover', () => {
    assert.match(component, /@mouseenter\.native="showDrawer"/)
    assert.match(component, /@mouseleave\.native="scheduleDrawerClose"/)
})

test('keeps the drawer open while hovered and schedules closing on leave', () => {
    assert.match(component, /@mouseenter="cancelDrawerClose"/)
    assert.match(component, /@mouseleave="scheduleDrawerClose"/)
    assert.match(component, /setTimeout\(\(\) => \{[\s\S]*drawerVisible = false[\s\S]*\}, 150\)/)
})

test('does not use a modal overlay for hover interaction', () => {
    assert.match(component, /:modal="false"/)
})
```

Run: `cd web && node --test tests/command-hover.test.js`

Expected: FAIL（文件不存在）

- [ ] **Step 3: 创建 CommandDrawer.vue**

创建 `web/src/components/CommandDrawer.vue`，结构对齐 `ConnectionDrawer.vue`：

```vue
<template>
    <div class="command-drawer">
        <el-button
            class="command-trigger"
            type="primary"
            icon="el-icon-document"
            @click="showDrawer"
            @mouseenter.native="showDrawer"
            @mouseleave.native="scheduleDrawerClose"
        >
            {{ $t('Commands') }}
        </el-button>

        <el-drawer
            :visible.sync="drawerVisible"
            direction="rtl"
            :size="drawerWidth"
            :modal="false"
            :with-header="false"
        >
            <div
                class="drawer-surface"
                @mouseenter="cancelDrawerClose"
                @mouseleave="scheduleDrawerClose"
            >
                <div class="drawer-title">
                    <strong>{{ $t('Commands') }}</strong>
                    <el-button type="text" icon="el-icon-close" @click="drawerVisible = false" />
                </div>

                <div class="drawer-content">
                    <div class="drawer-tools">
                        <el-button type="primary" size="small" icon="el-icon-plus" @click="createCommand">
                            {{ $t('NewCommand') }}
                        </el-button>
                        <el-button
                            size="small"
                            :type="managing ? 'warning' : 'default'"
                            icon="el-icon-setting"
                            @click="managing = !managing"
                        >
                            {{ managing ? $t('FinishManaging') : $t('Manage') }}
                        </el-button>
                    </div>

                    <el-empty v-if="commands.length === 0" :description="$t('NoCommands')" />
                    <div v-else class="command-list">
                        <div
                            v-for="command in commands"
                            :key="command.id"
                            class="command-item"
                            :class="{ managing: managing }"
                            @click="selectCommand(command)"
                        >
                            <div class="command-icon">
                                <i class="el-icon-document-copy"></i>
                            </div>
                            <div class="command-summary">
                                <strong>{{ command.name }}</strong>
                                <span>{{ contentPreview(command.content) }}</span>
                            </div>
                            <div v-if="managing" class="command-actions">
                                <el-button
                                    type="text"
                                    icon="el-icon-edit"
                                    :title="$t('Edit')"
                                    @click.stop="editCommand(command)"
                                />
                                <el-button
                                    type="text"
                                    class="delete-button"
                                    icon="el-icon-delete"
                                    :title="$t('Delete')"
                                    @click.stop="confirmDelete(command)"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </el-drawer>

        <el-dialog
            :title="editing ? $t('EditCommand') : $t('NewCommand')"
            :visible.sync="formVisible"
            :close-on-click-modal="false"
            append-to-body
            width="min(520px, 92%)"
            @closed="resetForm"
        >
            <el-form ref="commandForm" :model="form" :rules="rules" label-width="90px">
                <el-form-item :label="$t('CommandName')" prop="name">
                    <el-input v-model.trim="form.name" :placeholder="$t('nameRequired')" />
                </el-form-item>
                <el-form-item :label="$t('CommandContent')" prop="content">
                    <el-input
                        v-model="form.content"
                        type="textarea"
                        :rows="8"
                        :placeholder="$t('contentRequired')"
                    />
                </el-form-item>
            </el-form>
            <div slot="footer">
                <el-button @click="formVisible = false">{{ $t('Cancel') }}</el-button>
                <el-button type="primary" @click="saveCommand">{{ $t('Save') }}</el-button>
            </div>
        </el-dialog>
    </div>
</template>

<script>
import {
    createCommandId,
    decodeCommands
} from '@/utils/commands'

function emptyCommand() {
    return {
        id: createCommandId(),
        name: '',
        content: ''
    }
}

export default {
    name: 'CommandDrawer',
    data() {
        return {
            drawerVisible: false,
            formVisible: false,
            managing: false,
            editing: false,
            drawerCloseTimer: null,
            windowWidth: document.documentElement.clientWidth,
            form: emptyCommand(),
            rules: {
                name: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }],
                content: [{ required: true, message: this.$t('RequiredValue'), trigger: 'blur' }]
            }
        }
    },
    computed: {
        commands() {
            return decodeCommands(this.$store.state.commandList)
        },
        drawerWidth() {
            return this.windowWidth < 480 ? '100%' : '340px'
        }
    },
    mounted() {
        window.addEventListener('resize', this.updateWindowWidth)
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateWindowWidth)
        this.cancelDrawerClose()
    },
    methods: {
        contentPreview(content) {
            const firstLine = String(content || '').split(/\r?\n/)[0]
            return firstLine
        },
        showDrawer() {
            this.cancelDrawerClose()
            this.drawerVisible = true
        },
        scheduleDrawerClose() {
            this.cancelDrawerClose()
            this.drawerCloseTimer = setTimeout(() => {
                this.drawerVisible = false
            }, 150)
        },
        cancelDrawerClose() {
            if (this.drawerCloseTimer !== null) {
                clearTimeout(this.drawerCloseTimer)
                this.drawerCloseTimer = null
            }
        },
        updateWindowWidth() {
            this.windowWidth = document.documentElement.clientWidth
        },
        createCommand() {
            this.form = emptyCommand()
            this.editing = false
            this.formVisible = true
        },
        editCommand(command) {
            this.form = Object.assign({}, command)
            this.editing = true
            this.formVisible = true
        },
        selectCommand(command) {
            if (this.managing) {
                return
            }
            this.$emit('insert', command.content)
        },
        saveCommand() {
            this.$refs.commandForm.validate(valid => {
                if (!valid) {
                    return
                }
                this.$store.commit('UPSERT_COMMAND', Object.assign({}, this.form))
                this.formVisible = false
            })
        },
        confirmDelete(command) {
            this.$confirm(
                this.$t('DeleteCommandConfirm', { name: command.name }),
                this.$t('DeleteCommand'),
                {
                    confirmButtonText: this.$t('OK'),
                    cancelButtonText: this.$t('Cancel'),
                    type: 'warning'
                }
            ).then(() => {
                this.$store.commit('DELETE_COMMAND', command.id)
            }).catch(() => {})
        },
        resetForm() {
            this.form = emptyCommand()
            this.editing = false
            if (this.$refs.commandForm) {
                this.$refs.commandForm.clearValidate()
            }
        },
        closeDrawer() {
            this.drawerVisible = false
        }
    }
}
</script>

<style scoped lang="scss">
.command-trigger {
    position: fixed;
    right: 0;
    top: calc(50% - 72px);
    z-index: 1900;
    transform: translateY(-50%);
    padding: 13px 10px;
    border-radius: 6px 0 0 6px;
    writing-mode: vertical-rl;
    letter-spacing: 2px;
}

.drawer-surface {
    height: 100vh;
}

.drawer-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 54px;
    padding: 0 18px;
    border-bottom: 1px solid #ebeef5;
    color: #303133;
    font-size: 16px;
}

.drawer-content {
    height: calc(100vh - 54px);
    padding: 0 18px 18px;
    overflow-y: auto;
}

.drawer-tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-bottom: 16px;
    border-bottom: 1px solid #ebeef5;

    ::v-deep .el-button {
        margin-left: 0;
    }
}

.command-list {
    padding-top: 12px;
}

.command-item {
    display: flex;
    align-items: center;
    min-height: 66px;
    margin-bottom: 10px;
    padding: 10px 12px;
    border: 1px solid #e4e7ed;
    border-radius: 6px;
    background: #fff;
    cursor: pointer;
    transition: border-color .2s, box-shadow .2s;

    &:hover {
        border-color: #409eff;
        box-shadow: 0 2px 8px rgba(64, 158, 255, .14);
    }

    &.managing {
        cursor: default;
    }
}

.command-icon {
    margin-right: 10px;
    color: #409eff;
    font-size: 24px;
}

.command-summary {
    display: flex;
    flex: 1;
    min-width: 0;
    flex-direction: column;

    strong,
    span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    span {
        margin-top: 4px;
        color: #606266;
        font-size: 13px;
    }
}

.command-actions {
    display: flex;
    margin-left: 8px;

    .delete-button {
        color: #f56c6c;
    }
}

@media (max-width: 480px) {
    .command-trigger {
        top: auto;
        bottom: 88px;
        transform: none;
    }
}
</style>
```

注意：`selectCommand` 只 `$emit('insert')`；是否关闭抽屉由 `App` 在写入成功后调用 `this.$refs.commandDrawer.closeDrawer()`。

- [ ] **Step 4: 调整 ConnectionDrawer 触发按钮位置**

修改 `web/src/components/ConnectionDrawer.vue` 样式：

```scss
.connection-trigger {
    position: fixed;
    right: 0;
    top: calc(50% + 72px);
    z-index: 1900;
    transform: translateY(-50%);
    padding: 13px 10px;
    border-radius: 6px 0 0 6px;
    writing-mode: vertical-rl;
    letter-spacing: 2px;
}

@media (max-width: 480px) {
    .connection-trigger {
        top: auto;
        bottom: 20px;
        transform: none;
    }
}
```

（仅改 `top` / 移动端 `bottom`；业务逻辑不动。）

- [ ] **Step 5: 接入 App.vue**

将 `web/src/App.vue` 改为：

```vue
<template>
  <div id="app">
    <el-container>
      <el-main style="padding: 0; overflow: hidden">
        <tabs ref="tabs"></tabs>
      </el-main>
    </el-container>
    <command-drawer ref="commandDrawer" @insert="insertCommand" />
    <connection-drawer @connect="openConnection" />
  </div>
</template>

<script>
import CommandDrawer from '@/components/CommandDrawer'
import ConnectionDrawer from '@/components/ConnectionDrawer'
import Tabs from '@/components/Tabs'

export default {
    name: 'App',
    components: {
        CommandDrawer,
        ConnectionDrawer,
        tabs: Tabs
    },
    methods: {
        openConnection(connection) {
            this.$store.commit('SET_SSH', connection)
            this.$nextTick(() => {
                this.$refs.tabs.openTerm()
            })
        },
        insertCommand(content) {
            const inserted = this.$refs.tabs.insertToCurrentTerm(content)
            if (!inserted) {
                this.$message.warning(this.$t('OpenTerminalFirst'))
                return
            }
            this.$refs.commandDrawer.closeDrawer()
        }
    }
}
</script>

<style lang="scss">
#app {
    height: 100%;
    > div {
        height: 100%;
    }
}
</style>
```

- [ ] **Step 6: 运行相关测试与 lint**

```bash
cd web && node --test tests/commands.test.js tests/command-insert.test.js tests/command-hover.test.js
cd web && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint
```

Expected: 全部 PASS；lint 无 error

- [ ] **Step 7: Commit**

```bash
git add web/src/components/CommandDrawer.vue web/src/App.vue web/src/components/ConnectionDrawer.vue web/src/lang/zh.js web/src/lang/en.js web/tests/command-hover.test.js
git commit -m "$(cat <<'EOF'
feat: add common commands drawer above connections

EOF
)"
```

---

### Task 5: 构建与手工验证

**Files:**
- Generated: `web/dist/**`（构建产物，勿提交）

- [ ] **Step 1: 全量相关测试**

```bash
cd web && node --test tests/commands.test.js tests/command-insert.test.js tests/command-hover.test.js tests/connections.test.js tests/connection-hover.test.js
```

Expected: 全部 PASS

- [ ] **Step 2: lint + build**

```bash
cd web && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint
cd web && NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service build
```

Expected: 成功退出码 0

- [ ] **Step 3: 浏览器手工核对（对照 spec 验证清单）**

1. hover「常用命令」展开抽屉；移出延迟关闭；无遮罩。
2. 新建名称+多行内容，保存后出现在列表，不写入终端。
3. 管理态可编辑、删除（删除有确认）。
4. 无 tab 时点击命令 → 提示「请先打开终端」。
5. 打开终端后点击命令 → 内容填入且未自动执行；抽屉关闭。
6. 「连接」按钮仍可用，且与常用命令按钮不重叠。

- [ ] **Step 4: 若有构建相关未提交改动则不提交 dist；本任务无源码改动则无需 commit**

---

## Spec Coverage Checklist

| Spec 要求 | Task |
|-----------|------|
| 连接上方常用命令按钮 + hover 抽屉 | Task 4 |
| 新建/管理/编辑/删除 | Task 4 |
| 名称+多行内容表单 | Task 4 |
| 点击写入当前 tab、不回车 | Task 3 + 4 |
| 无终端提示 | Task 4 App.insertCommand |
| localStorage commandList | Task 1 + 2 |
| 连接按钮仅布局避让 | Task 4 |
| 单元/静态测试 | Task 1/3/4/5 |
