# 常用命令抽屉设计

## 目标

在页面右侧「连接」按钮上方增加「常用命令」入口。交互与连接抽屉一致：hover 展开侧边栏，支持新建、管理（编辑/删除），点击命令将内容填入当前打开的终端 Tab（不自动回车执行）。

## 页面布局与交互

- 右侧固定两个竖排按钮：上方「常用命令」，下方「连接」。
- 「连接」按钮相对原位置略下移，避免与常用命令按钮重叠；窄屏（≤480px）时两个按钮在底部附近竖排错开。
- hover 或点击「常用命令」按钮展开右侧抽屉；无 modal 遮罩。
- 鼠标移入抽屉表面保持打开；移出按钮与抽屉后约 150ms 关闭。
- 抽屉顶部标题为「常用命令」，工具区提供「新建」「管理」；不包含语言切换（语言仍在连接抽屉中）。
- 两个抽屉各自独立，不做强制互斥。

## 命令管理

- 点击「新建」打开表单对话框，字段：
  - 名称（必填，单行）
  - 内容（必填，多行 textarea，可保存脚本片段）
- 保存写入命令列表，不写入终端。
- 每条命令拥有独立 `id`。
- 点击「管理」进入管理模式；列表项显示编辑、删除按钮；再点「完成」退出。
- 编辑复用同一表单并覆盖原记录。
- 删除前二次确认。
- 管理模式下点击列表项不写入终端。
- 列表展示：主标题为名称；副标题为内容首行预览（过长省略）。

## 写入终端

- 非管理模式下，点击某条命令，将 `content` 原样填入**当前打开**的终端 Tab。
- 写入方式：通过 `App → Tabs → Terminal`，调用 xterm 的 `paste(content)`，**不追加回车**，不自动执行。
- 写入成功后关闭常用命令抽屉。
- 若没有打开任何终端 Tab，或当前终端未就绪（`term` 为空）：显示警告提示「请先打开终端」，不写入、不关闭抽屉以外的额外操作（可保持抽屉打开以便用户先去连接）。
- 多行内容按原文粘贴，保留换行。

## 数据存储

- 命令列表保存在浏览器 `localStorage`，key 为 `commandList`。
- 编码方式与 `sshList` 一致（JSON + Base64）。
- 单条结构：`{ id: string, name: string, content: string }`。
- 通过 Vuex state `commandList` 与 mutations `UPSERT_COMMAND` / `DELETE_COMMAND` 同步内存与 `localStorage`。

## 组件划分

| 文件 | 职责 |
|------|------|
| `web/src/utils/commands.js` | encode/decode、upsert、remove、createId（仿 `connections.js`） |
| `web/src/components/CommandDrawer.vue` | 触发按钮、抽屉、列表、管理模式、新建/编辑对话框 |
| `web/src/store/state.js` | 增加 `commandList` 初始化 |
| `web/src/store/mutations.js` | `UPSERT_COMMAND`、`DELETE_COMMAND` |
| `web/src/App.vue` | 挂载 `CommandDrawer`，处理 `@insert` |
| `web/src/components/Tabs.vue` | 暴露 `insertToCurrentTerm(text)` |
| `web/src/components/Terminal.vue` | 暴露 `insertText(text)`，内部 `term.paste(text)` |
| `web/src/lang/zh.js` / `en.js` | 中英文案 |
| `web/src/components/ConnectionDrawer.vue` | 仅调整触发按钮垂直位置，不改业务逻辑 |

## 校验与错误处理

- 名称、内容必填；校验失败不关闭对话框、不修改列表。
- 删除必须确认。
- 无可用终端时用 `Message.warning` 提示，不抛未捕获异常。

## 明确不做

- 不自动回车执行命令。
- 不做命令分组、拖拽排序、导入导出。
- 不修改连接抽屉的业务逻辑（仅布局避让）。

## 验证

- hover「常用命令」可展开抽屉；移出后延迟关闭；无 modal。
- 新建保存后出现在列表，不写入终端。
- 编辑后列表与 `localStorage` 同步。
- 删除确认后消失，取消则保留。
- 有活动终端时点击命令：内容出现在终端输入区且未自动执行；抽屉关闭。
- 无终端 Tab 时点击命令：出现「请先打开终端」提示。
- 「连接」按钮仍可正常 hover/使用，且与常用命令按钮不重叠。

## 测试

- `web/tests/commands.test.js`：encode/decode、upsert、remove。
- `web/tests/command-hover.test.js`：hover 打开、无 modal、延迟关闭（风格对齐 `connection-hover.test.js`）。
- 静态断言：`Terminal` 含 `insertText` 且使用 `paste`；`Tabs` 含写入当前 tab 的方法。
