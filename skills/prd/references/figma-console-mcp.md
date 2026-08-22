# figma-console-mcp Integration

所有 Figma 读取、创建、更新、迁移和截图操作，只能使用本地 `figma-console-mcp` 的 `mcp__figma_console__*` 工具。不得安装、调用或回退到 Codex Figma 插件、Figma connector/app 或其他命名空间。

不得在任何 gate 待确认时调用写操作，也不得声称未由工具返回的 Figma 结果。

## Tool Discovery

工具可能延迟加载。先精确搜索：

- `mcp__figma_console__figma_execute`
- `mcp__figma_console__figma_capture_screenshot`
- `mcp__figma_console__figma_take_screenshot`
- `figma-console-mcp`

缺失时再宽泛搜索 `figma console execute screenshot`，但最终只能接受 `mcp__figma_console__*` 命名空间。

必需能力：

- 执行：`mcp__figma_console__figma_execute`。
- 截图：`mcp__figma_console__figma_capture_screenshot` 或 `mcp__figma_console__figma_take_screenshot`。

执行能力缺失，或需要验证的阶段缺少截图能力时 hard stop，并把准确失败类型写入 `index.md`。

## Read-Only Preflight

首次写操作前只读检查：

1. 活跃文件名、file ID、当前 Page 和 Page 数。
2. 目标文件是否属于本需求的产品/设计域。
3. 全部 Page 的 ID、名称和职责候选。
4. 四个基础 Page 是否缺失或重复。
5. 是否存在旧 `Design System + Views` 结构。
6. 当前 Variables、Styles、Components、Patterns、View Templates 及状态。
7. 与目标 `flowId + fidelity` 匹配的 Page。

`Untitled` 文件名可以连接成功，但目标文件身份不明确时仍须 hard stop。Smoke test 不能创建、修改、移动、重命名或删除任何节点。

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
- Smoke test 失败：说明是 Desktop、Bridge/session、权限或运行时问题。

## User Messages

执行工具缺失：

```text
未检测到 mcp__figma_console__figma_execute。请确认 figma-console-mcp 已在 Codex 中暴露；本次规格已保存，未调用其他 Figma 工具。
```

Bridge smoke test 失败：

```text
Figma 执行工具可见，但只读 smoke test 失败。请保持目标 Figma Design File 激活并确认本地 Desktop Bridge 已连接；本次规格已保存。
```

旧结构待迁移：

```text
检测到旧 Design System/Views 结构。迁移映射已保存；请确认后再原位移动资产。本次未修改 Figma。
```
