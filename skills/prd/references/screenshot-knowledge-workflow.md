# 截图知识库工作流

在任何低保真 `PrototypeSpec` 前执行本工作流。截图路径被登记但图片未被实际读取，不算完成参考分析。

## 1. 定位知识库

1. 读取 `knowledge-bases.json`，根据需求词和产品别名识别产品。
2. 调用 `scripts/Resolve-KnowledgeBase.ps1`，传入产品 ID 和 Codex 当前 workspace 根目录。
3. 只读取 `<workspace-root>/Knowledge`。不要把需求输出目录、skill 安装目录或任意嵌套 shell 当前目录当作 workspace 根目录；不得读取用户指定知识库根目录、环境变量或 fallback 目录。
4. 只有 `<workspace-root>/Knowledge` 下的 manifest 文件和截图目录同时存在才算有效。
5. 将解析器输出的 `root`、`manifestPath`、`screenshotPath`、`resolvedBy` 和 `status` 写入 gate 与 `InterfaceBaseline`。`resolvedBy` 只能是 `workspace | none`。
6. `status=blocked` 时记录 workspace 知识库的失败原因并进入参考 gate；不得静默按无参考生成，也不得切换到其他目录。

用户提供的截图覆盖默认检索结果，但仍可使用知识库基准页面补足全局壳层。

## 2. 检索和选择

读取 manifest 的人工语义和自动元数据，不得只搜索文件名。

- 根据产品、页面族、页面类型、状态和关键词排序候选。
- 默认选择一张 `pageType=base` 的基准页面和最多三张相关状态、弹窗或局部操作截图。
- 优先选择与候选的 `baseScreenId` 关联的基准页面。
- 没有直接匹配时，选择同页面族的基准页面，标记 `confidence=low` 并记录缺口。
- 检查候选文件确实存在；缺失文件不得入选。

## 3. 实际读图

使用可用的本地图片查看能力逐张打开所选截图，检查完整画面。仅列出路径、依据文件名推断或复制 manifest 描述均不算读图。

每张截图记录：

- 实际检查状态和检查时间。
- 选择理由。
- 画布尺寸与比例。
- 全局壳层、固定区域、内容层级、组件模式、弹窗/覆盖关系。
- 可借用结构和不得复制的敏感内容。

如果任何入选截图无法读取，将 `screenshotAnalysisGate.status` 设为 `blocked` 并停止低模生成。

## 4. 生成 InterfaceBaseline

在低模规格前保存 `03-interface-baseline.json`：

```json
{
  "productId": "",
  "screenFamily": "",
  "knowledgeBase": {"root": "", "manifest": "", "resolvedBy": "workspace | none"},
  "selectedReferences": [
    {"screenId": "", "path": "", "role": "base | related", "reason": "", "actuallyInspected": true}
  ],
  "viewport": {"width": 0, "height": 0, "aspectRatio": ""},
  "globalShell": {},
  "persistentRegions": [],
  "contentHierarchy": [],
  "layoutConstraints": [],
  "componentPatterns": [],
  "overlayPatterns": [],
  "interactionConventions": [],
  "mustPreserve": [],
  "shouldPreserve": [],
  "mayChange": [],
  "screenshotConflicts": [],
  "requirementConflicts": [],
  "confidence": "high | medium | low"
}
```

`mustPreserve` 只放置现有产品的稳定壳层、关键区域关系和核心交互惯例。业务字段、文案和本次需求明确要改变的区域放入 `mayChange`。截图与已确认业务规则冲突时遵循业务规则，并在 `requirementConflicts` 和 `PrototypeSpec.annotations` 中记录。

## 5. 来源追踪

每个关键低模区域必须在 `referenceTraceability` 中追溯到已确认需求或实际读取的截图：

```json
{
  "prototypeElement": "",
  "sourceType": "requirement | screenshot",
  "source": "screenId、文件路径或需求产物路径",
  "sourceRegion": "",
  "decision": "preserve | adapt | add",
  "reason": ""
}
```

缺少来源的关键区域不得进入 Figma 调用。

## 6. 结构一致性 Gate

低模生成后必须使用 Figma 截图能力捕获完整 frame，与 `InterfaceBaseline` 对照并保存 `05-low-fidelity-structure-review.md`。逐项检查：

- 画布尺寸和比例。
- 全局壳层与固定导航。
- 主内容区、主操作区的位置和面积关系。
- 弹窗、遮罩和底层页面关系。
- 信息密度与组件分组。
- 所有 `mustPreserve`。
- 所有关键区域的来源追踪。
- 当前业务流程只占用一个 `10 LF · <流程名>` Page，且 `flowId + fidelity` 唯一。
- `00 Flow Overview`、`10 Main Flow`、`20 Exception Flows`、`30 Empty & Error States`、`40 Interaction Notes` 等标准 Section 完整或明确标记不适用。

每项标记 `pass | fail | not-applicable` 并附证据。任一关键项或 `mustPreserve` 失败时，修正低模并重新截图检查；通过前不得进入低模用户确认、PRD 或高模阶段。

## 7. 高保真设计治理反查

高模截图检查除视觉层级、信息密度和状态覆盖外，还必须结合 Figma 节点数据与 `03-figma-design-manifest.json` 检查：

- `20 HF · <流程名>` 与低模共享同一 `flowId`，且各自 Page 唯一。
- Flow Page 使用已批准 Component、Pattern 和 View Template 的实例。
- 颜色、字体、圆角和阴影绑定已批准 semantic token。
- `rawStyleCount=0`、`unexplainedDetachedInstanceCount=0`、`unregisteredLocalComponentCount=0`。
- 本次新增资产的创建与批准发生在业务 Flow 实例之前。
- 截图中的组件状态与 `PrototypeSpec.designSystemDependency`、`assetResolution` 一致。

将结果保存到 `13-high-fidelity-review.md`。任一关键项失败时，修复、重新截图并重新运行 `scripts/Test-DesignGovernance.ps1`；通过前不得标记高模完成。
