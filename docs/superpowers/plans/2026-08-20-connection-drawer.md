# 右侧连接抽屉实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用右侧抽屉替换顶部连接表单，实现连接配置的新建、编辑、删除和点击新开终端 Tab。

**Architecture:** 连接配置仍以 Base64 JSON 保存在 `localStorage.sshList`，由独立工具模块负责迁移和不可变增删改。新建 `ConnectionDrawer.vue` 承担抽屉、表单和列表交互，`App.vue` 只协调选中连接与 `Tabs.openTerm()`。

**Tech Stack:** Vue 2.7、Vuex 3、Element UI 2.15、Node.js 内置测试运行器。

## Global Constraints

- 保存连接时不立即连接。
- 点击列表项始终新建独立 Tab，并关闭抽屉。
- 兼容没有 ID 的旧版 `sshList`。
- 文件管理与语言切换迁移到抽屉工具区。
- 不新增前端依赖。

---

### Task 1: 连接列表数据工具

**Files:**
- Create: `web/src/utils/connections.js`
- Create: `web/tests/connections.test.js`

**Interfaces:**
- Produces: `decodeConnections(encoded)`, `encodeConnections(list)`, `migrateConnections(list, idFactory)`, `upsertConnection(list, connection)`, `removeConnection(list, id)`, `createConnectionId()`

- [ ] 编写覆盖旧数据迁移、新增、编辑和删除的失败测试。
- [ ] 运行 `node --test tests/connections.test.js`，确认因工具模块不存在而失败。
- [ ] 实现纯函数连接工具。
- [ ] 再次运行测试，确认全部通过。

### Task 2: Vuex 持久化连接操作

**Files:**
- Modify: `web/src/store/state.js`
- Modify: `web/src/store/mutations.js`

**Interfaces:**
- Consumes: Task 1 的连接工具函数。
- Produces: `UPSERT_CONNECTION`、`DELETE_CONNECTION` mutation；`state.sshList` 保持编码字符串格式。

- [ ] 在初始化时迁移旧数据并写回 `localStorage`。
- [ ] 增加连接新增/更新、删除 mutation，并统一同步状态与本地存储。
- [ ] 保留 `SET_LIST` 以兼容现有调用。
- [ ] 运行连接工具单测与 ESLint。

### Task 3: 右侧连接抽屉

**Files:**
- Create: `web/src/components/ConnectionDrawer.vue`
- Modify: `web/src/App.vue`

**Interfaces:**
- Emits: `connect(connection)`。
- Consumes: Vuex 连接列表、Task 2 mutations、现有 `FileList`。

- [ ] 创建右侧悬浮入口和响应式抽屉。
- [ ] 添加新建/编辑表单、认证方式切换和私钥文件读取。
- [ ] 添加管理模式、编辑与删除确认。
- [ ] 点击普通列表项发出 `connect`，由 `App.vue` 设置 SSH 信息、打开 Tab 并关闭抽屉。
- [ ] 移除 `App.vue` 对旧 `Header` 的引用。

### Task 4: 清理旧历史行为与补充文案

**Files:**
- Modify: `web/src/components/Terminal.vue`
- Modify: `web/src/lang/zh.js`
- Modify: `web/src/lang/en.js`

**Interfaces:**
- Terminal 连接成功后不再按 host 自动改写连接列表。

- [ ] 删除终端连接成功后的旧历史记录写入逻辑。
- [ ] 增加连接抽屉、新建、管理、编辑、删除、保存等中英文文案。
- [ ] 运行 ESLint，修复新增问题。

### Task 5: 构建与运行验证

**Files:**
- Generated: `web/dist/**`

- [ ] 运行 `node --test tests/connections.test.js`。
- [ ] 运行 `NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service lint`。
- [ ] 运行 `NODE_OPTIONS=--openssl-legacy-provider npx vue-cli-service build`。
- [ ] 重启 Go 服务并确认首页返回 HTTP 200。
- [ ] 在浏览器验证抽屉、新建、管理、编辑、删除和新开 Tab 流程。
