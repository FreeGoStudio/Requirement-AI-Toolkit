# Figma Design Governance

在任何 Figma 读取、创建、更新、迁移或截图阶段读取本文件。

## 1. 隔离边界与基础 Page

一个产品或设计域使用一个 Figma Design File 作为隔离边界。Folder/Project 只组织文件。

目标 Design File 必须且只能存在一套标准基础 Page：

```text
01 Foundations
02 Components
03 Patterns
04 View Templates
```

- `Foundations`：Variables、semantic tokens、颜色、字体、间距、圆角、阴影和栅格。
- `Components`：所有基础/复合组件及 variant。
- `Patterns`：可复用业务组合。
- `View Templates`：页面壳层和完整页面组合。

首次进入 Figma 阶段时执行只读扫描。缺失 Page 可在已经获准的原型阶段自动创建；同名或同职责 Page 重复时 hard stop。所有 Page ID 写入 `03-figma-design-manifest.json`，后续只按 ID 更新。

## 2. 旧结构迁移

当文件存在 `Design System`、`Views` 等旧 Page，而四 Page 标准不完整时：

1. 只读盘点 Variables、Styles、Components、Patterns、Views 及引用关系。
2. 在 manifest 的 `legacyMigration.moves` 写入源 node/page ID、目标 Page、原因和 `executed=false`。
3. 保存迁移方案并要求用户明确确认，然后 hard stop。
4. 确认后原位移动节点，保持组件 ID 和实例关系；不得复制组件代替移动。
5. 未明确授权时不得删除旧 Page。清空后的旧 Page 重命名或归档也需要包含在已确认迁移方案中。

## 3. 业务流程边界

一个业务流程必须有一个用户目标、一个可识别入口、连续关键步骤和一个明确终态。同一目标的主流程、异常、空错状态、权限状态、弹窗和抽屉属于同一流程。

每个流程按保真度独占 Page：

```text
10 LF · <流程名>
20 HF · <流程名>
```

低模与高模共享稳定 `flowId`。每个 Flow Page 使用：

```text
00 Flow Overview
10 Main Flow
20 Exception Flows
30 Empty & Error States
40 Interaction Notes
90 Fix Review
```

`90 Fix Review` 仅用于临时修复对照；确认后合并并清理。

## 4. Page 决策

生成前扫描 manifest 与 Figma Page，按 `flowId + fidelity` 查重：

- 不存在：`create-new-page`。
- 已存在且 `changeType=fix|iteration`：`update-existing-page`，必须提供 `targetPageId`。
- `changeType=redesign` 且用户明确要求保留旧版：`archive-and-create-replacement`；旧 Page 归档，新 Page 继承同一 `flowId`。
- 同一组合存在多个正式 Page：hard stop，要求用户确定主 Page。
- 文案、样式、组件替换、异常状态、同目标步骤调整和生成重试都不得创建新 Page。

## 5. 资产先行与准入

高模采用严格准入：所有新资产先进入 Design System，再进入 Flow Page。

1. Token/视觉原语 → `Foundations`。
2. 组件/variant → `Components`。
3. 业务组合 → `Patterns`。
4. 页面组合 → `View Templates`。
5. Flow Page → 只使用已登记且 `approved` 的实例和场景 override。

禁止在 Flow Page 创建资产后补登记。资产记录至少包含稳定 ID、名称、类型、目标 Page ID、状态、来源和创建时间。未批准资产不得被正式高模依赖。

## 6. 视觉方向 Gate

低模只提供结构，不提供视觉方向。

- 已有 Approved Design System：直接资产解析。
- 有截图、品牌规范或既有高模但没有 Approved Design System：先据此固化 Design System，再确认。
- 无任何视觉来源：创建临时 `00 Visual Directions · <yyyyMMdd-HHmm>` Page，默认生成三套候选。

每套候选必须包含颜色、字体、间距、圆角、阴影、核心组件和一个代表性 View，并明确差异与适用场景。截图后保存 `09-visual-direction-spec.json` 和 `10-visual-direction-review.md`，等待用户选择单套或组合。

选择后先更新四个基础 Page，再截图保存 `11-design-system-review.md`。只有用户明确确认，manifest 的 `designSystem.status` 才能设为 `approved`。确认后把候选 Page 重命名为 `90 Archive · Visual Directions · <yyyyMMdd-HHmm>`。

## 7. FigmaDesignManifest

`03-figma-design-manifest.json` 是持续更新的设计治理事实源：

```json
{
  "designFile": {"fileId": "", "fileName": "", "productDomain": ""},
  "pageRegistry": {
    "foundationsPageId": "",
    "componentsPageId": "",
    "patternsPageId": "",
    "viewTemplatesPageId": ""
  },
  "designSystem": {
    "status": "absent | initialized | candidate | approved",
    "visualDirectionId": "",
    "tokenCollections": [],
    "components": [],
    "patterns": [],
    "viewTemplates": []
  },
  "flows": [
    {
      "flowId": "",
      "flowName": "",
      "objective": "",
      "pages": {"lowFidelityPageId": "", "highFidelityPageId": ""}
    }
  ],
  "legacyMigration": {
    "required": false,
    "status": "not-applicable | pending-confirmation | approved | complete",
    "moves": []
  }
}
```

资产数组中的记录使用相应 ID 字段：`collectionId`、`componentId`、`patternId`、`viewTemplateId`，并包含 `status`。

## 8. Conformance Audit

高模完成前同时执行截图检查和节点检查：

- 四个基础 Page ID 唯一且有效。
- `flowId + fidelity` 唯一，低高模正确配对。
- 所有依赖 ID 已登记且 `approved`。
- 关键颜色、字体、圆角和阴影使用 semantic token；未解释 raw style 数为 0。
- 未解释 detached instance 数为 0。
- 未登记本地组件数为 0。
- View Template、Component 和 Token 的创建/批准先于 Flow Page 实例。

任一关键项失败时修复并重新截图、重新运行治理校验；通过前不得把高模标记为完成。
