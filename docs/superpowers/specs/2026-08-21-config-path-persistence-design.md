# 配置目录持久化连接与常用命令设计

## 目标

在 `.env` 中增加配置目录路径 `CONFIG_PATH`。连接列表与常用命令不再使用浏览器 `localStorage` 作为主存储，改为读写该目录下的 JSON 文件。侧边栏交互保持不变，仅更换数据源。实现基于已有分支 `feature/common-commands`。

## 环境变量与文件布局

`.env` / `.env.example` 增加：

```bash
# 连接与常用命令等配置目录；相对路径以项目根目录为基准
CONFIG_PATH=./data
```

目录结构：

```text
$CONFIG_PATH/
  connections.json
  commands.json
```

规则：

- `buildNrun.sh` 读取 `CONFIG_PATH`；相对路径解析为基于项目根目录的绝对路径后传给 Go 进程。
- Go 通过命令行 flag（建议 `-c`）和/或环境变量 `CONFIG_PATH` 接收路径，与现有 `port` / `savePass` 传参风格一致。
- 启动时若目录不存在则创建；对应 JSON 文件不存在时视为空数组 `[]`。
- JSON 为明文数组，元素结构与现有前端模型一致：
  - 连接：`{ id, host, username, port, password, logintype }`
  - 命令：`{ id, name, content }`
- 是否持久化连接密码遵循后端 `savePass`：为 `false` 时写入连接不包含密码（或写空字符串），与现有行为一致。
- `language` 仍保存在浏览器 `localStorage`，不进入配置目录。

## HTTP API

在现有 gin 路由上增加以下接口；若启用 Basic Auth，则一并纳入保护：

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/connections` | 读取 `connections.json`，返回数组 |
| PUT | `/api/connections` | 整表覆盖写入连接列表 |
| GET | `/api/commands` | 读取 `commands.json`，返回数组 |
| PUT | `/api/commands` | 整表覆盖写入命令列表 |

约定：

- 请求/响应体为 JSON 明文数组，不再使用 Base64。
- 写盘采用临时文件 + `rename`，避免写到一半损坏。
- 进程内对每个文件（或整库）加互斥锁，避免并发读写交错。
- 不做按单条资源的 PATCH/DELETE REST；前端继续维护完整列表后整表 PUT，与现有 upsert 列表模型一致。

## 前端数据流

1. 应用启动时分别 `GET /api/connections` 与 `GET /api/commands`，结果写入 Vuex（内存中改为普通数组）。
2. 抽屉中新建、编辑、删除：先更新 Vuex，再 `PUT` 对应整表。
3. 写入失败时提示错误，并重新 `GET` 与服务端对齐。
4. `ConnectionDrawer` / `CommandDrawer` UI 与交互不变，仅数据持久化路径变化。

## localStorage 一次性迁移

触发条件：服务端两边列表皆为空（文件不存在或为 `[]`），且浏览器仍存在旧 `sshList` / `commandList`。

流程：

1. 解码旧 Base64 JSON，为缺少 `id` 的记录补齐 id。
2. 通过 `PUT` 写入服务端。
3. 成功后删除对应 localStorage key；之后只认服务端。
4. 若服务端已有数据：不覆盖，忽略旧 localStorage（可清理本地 key，避免反复尝试）。

## 组件与模块划分

| 区域 | 职责 |
|------|------|
| `.env` / `.env.example` / `buildNrun.sh` | 增加并校验 `CONFIG_PATH`，解析后传给二进制 |
| Go 新包（如 `core/configstore`） | 路径管理、JSON 读写、锁、原子写 |
| `main.go` | 注册 flag/env、挂载 API 路由 |
| 前端 `api/` | connections / commands 的 get/put 封装 |
| Vuex state / mutations / actions | 列表改为数组；持久化改为 API；启动 `loadAndMigrate` |
| `connections.js` / `commands.js` | 保留 id / upsert / remove；Base64 编解码仅用于迁移旧数据 |
| 相关测试 | Go 读写单测；前端迁移与 API 工具测试；更新 `buildNrun` 相关断言 |

## 明确不做

- 不把语言设置迁到服务端。
- 不做命令/连接的分组、导入导出 UI。
- 不做密码加密存储（明文 JSON + `savePass` 开关）。
- 不改变侧边栏 hover、新建、管理、点击写入终端等交互。

## 验证

- 配置 `CONFIG_PATH=./data` 启动后自动创建目录。
- 新建连接/命令后，磁盘出现对应 JSON；刷新页面列表仍在。
- 旧 localStorage 有数据且服务端为空时，首次打开完成迁移并清除 localStorage。
- 服务端已有数据时，不覆盖。
- `savePass=false` 时 `connections.json` 不含密码内容。
- 侧边栏行为与改造前一致（含常用命令写入当前终端、不自动回车）。
