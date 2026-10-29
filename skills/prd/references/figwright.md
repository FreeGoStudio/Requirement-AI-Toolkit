# Figwright Integration

所有 Figma 读取、创建、更新、迁移和截图操作使用 `mcp__figwright__*`。不得在 gate 待确认时写入，不得虚构工具结果或回退到其他 Figma 服务。

## Tool Discovery

先发现 `mcp__figwright__ping`、`list_files`、`use_file`、`get_pages`、`get_screenshot`（后续简称均属 `mcp__figwright__`）。按阶段发现对应专用工具并读取当前参数定义，不假设存在任意 JavaScript 执行入口。

| 目的 | 工具 |
| --- | --- |
| 文件连接与绑定 | `ping`、`list_files`、`use_file` |
| 页面与节点检查 | `get_pages`、`get_document`、`get_node`、`get_design_context` |
| 设计资产检查 | `get_variable_defs`、`scan_components`、`get_styles` |
| 页面与布局 | `add_page`、`rename_page`、`create_section`、`create_frame`、`set_auto_layout`、`set_layout_props` |
| 组件与 Token 复用 | `create_instance`、`bind_variable_to_paint`、`bind_variable_to_node`、`apply_style_to_node` |
| 原位移动与交互 | `reparent_nodes`、`set_reactions`、`update_flows` |
| 截图与保存 | `get_screenshot`、`save_screenshots` |

阶段所需工具缺失时保存已有规格，在 `index.md` 记录准确失败类型并停止该阶段。

## Read-Only Preflight

1. 调用 `ping`，确认 Figma 内的 Figwright 插件已连接；服务在线不等于插件连接成功。
2. 用 `list_files` 读取实际文件名、session 和当前 Page。多文件连接时先按用户目标调用 `use_file`；同名文件使用返回的 `sessionId`，目标不明时询问，不猜测。不能靠 URL 直接打开远程文件，目标必须在 Figma 中打开并运行插件。
3. 用 `get_pages` 读取全部 Page 的 ID、名称，核对产品/设计域、四个基础 Page、旧 `Design System + Views` 结构及 `flowId + fidelity` 对应页。
4. 读取 Variables、Styles、Components、Patterns、View Templates 及其状态，优先复用现有资产。精确布局与数值来自节点/设计上下文，截图只用于视觉核验。
5. `list_files` 的 `fileKey` 可能为 null；`sessionId`、Page ID 均不能充当 file ID。连接验收不要求 file ID；业务 manifest 要求真实 `designFile.fileId` 时从用户提供的文件链接核对，无法取得则保存待补信息，不伪造标识或绕过治理校验。

`Untitled` 可以通过连接检查；业务阶段仍需确认目标设计域。只读检查不创建、修改、移动、重命名或删除节点。

## File Architecture Actions

- 新文件或没有旧结构的文件：在已获准的原型阶段自动创建缺失的标准基础 Page，并把返回 ID 写入 manifest。
- 标准基础 Page 重复：停止，不自动合并。
- 旧结构：只读生成 `legacyMigration.moves`，等待用户确认；确认后只原位移动，禁止复制组件代替移动。
- 每次写操作后重新读取受影响 Page/节点，更新 manifest，再截图验证。

## Page Strategy

使用 manifest 和实时扫描决定：

```text
flowId + fidelity 不存在        -> create-new-page
已存在且 changeType=fix/iteration -> update-existing-page
根本重构并明确保留旧版          -> archive-and-create-replacement
存在多个正式 Page              -> hard stop
```

不得因工具重试、文案、样式、组件替换或同流程异常状态增加而新建 Page。

## Call Contract

业务 Flow 调用必须包含：

- Design File ID/name 和 `03-figma-design-manifest.json`。
- `flowIdentity`、Page strategy、目标/配对 Page ID。
- 标准 Section、Frame 和原型连线。
- 低模的知识库、InterfaceBaseline 和来源追踪。
- 高模的 Approved Design System 依赖和资产解析。
- 交互、业务状态、异常、空错状态和开放问题。
- Conformance 要求。

视觉方向调用必须包含临时 Page、三套候选的完整规格和截图要求。不得在同一调用中继续创建业务高模。

## Result Handling

- 成功：记录返回的 file/page/node/component/variable ID，更新 manifest，截图并执行治理校验。
- 失败：保存规格，记录原始错误和失败分类，停止；不要推断部分写入是否成功，下一次先只读重查。
- 工具不可用：说明是工具未暴露；不要误报为 Desktop 断开。
- Smoke test 失败：说明是 Figwright 插件/session、权限或运行时问题。

## Result Verification

- 写操作按当前工具 schema 分步调用；失败或超时后先读取真实状态，再决定是否重试，避免重复 Page/节点。
- `get_screenshot` 使用实际 Frame/node ID（`nodeIds`）；图片必须实际查看。`empty: true`、无图片或不可导出不能算视觉验收通过。
- 空白文件可验证连接和 Page 读取，但没有可导出节点时记录截图待验收，不为只读检查自动创建节点。
- 连接异常分别报告工具未暴露、插件未连接、文件目标不明、权限/编辑模式不支持、版本不兼容或截图失败。根据工具原始错误处理，不把任意失败统称为连接断开。
- 工具返回版本不兼容或未验证警告时先处理兼容性并重新读取/截图，不能仅凭 `ok: true` 宣布完成。
