# PrototypeSpec

每次业务 Flow Figma 调用前创建 `PrototypeSpec`。视觉方向使用单独的 `09-visual-direction-spec.json`，不得冒充业务高模规格。

在参考 gate 为 `pending`、旧结构迁移待确认或高模 Design System 未批准时，不得创建对应业务 `PrototypeSpec`。

## Required Shape

```json
{
  "mode": "low-fidelity | high-fidelity",
  "flowIdentity": {
    "flowId": "",
    "flowName": "",
    "objective": "",
    "fidelity": "low | high",
    "changeType": "new-flow | fix | iteration | redesign"
  },
  "figmaPageStrategy": {
    "action": "create-new-page | update-existing-page | archive-and-create-replacement",
    "pageName": "",
    "targetPageId": "",
    "pairedPageId": "",
    "reason": ""
  },
  "designFile": {"fileId": "", "fileName": "", "manifestPath": "03-figma-design-manifest.json"},
  "productSurface": "b-side | c-side | mobile | desktop | mixed | unknown",
  "objective": "",
  "audience": "",
  "sourceArtifacts": [],
  "projectKnowledgeBase": {
    "productId": "",
    "root": "",
    "manifest": "",
    "resolvedBy": "workspace | none | not-applicable",
    "searchTerms": [],
    "candidateScreens": [],
    "selectedScreens": [],
    "selectionRationale": []
  },
  "interfaceBaseline": {
    "artifactPath": "",
    "globalShell": {},
    "persistentRegions": [],
    "layoutConstraints": [],
    "componentPatterns": [],
    "mustPreserve": [],
    "allowedChanges": [],
    "confidence": "high | medium | low"
  },
  "prototypeReferenceGate": {
    "existingPrototypeChecked": false,
    "existingPrototypeFound": false,
    "visualReferenceRequested": false,
    "userDecision": "provided-reference | use-existing-prototype | continue-without-reference | pending",
    "notes": ""
  },
  "highFidelityVisualReferenceGate": {
    "required": false,
    "lowFidelityUsedOnlyForFlow": true,
    "visualSourceFound": false,
    "visualSourceTypes": [],
    "userDecision": "use-approved-design-system | provided-visual-reference | use-existing-high-fidelity | generate-visual-directions | selected-visual-direction | pending | not-applicable",
    "notes": ""
  },
  "designSystemDependency": {
    "status": "not-applicable | approved",
    "tokenCollectionIds": [],
    "componentIds": [],
    "patternIds": [],
    "viewTemplateIds": []
  },
  "assetResolution": [
    {
      "assetId": "",
      "assetType": "token-collection | component | pattern | view-template",
      "targetPageId": "",
      "status": "approved",
      "instanceIds": [],
      "createdBeforeFlowInstance": true
    }
  ],
  "conformanceRequirements": {
    "rawStyleCount": 0,
    "unexplainedDetachedInstanceCount": 0,
    "unregisteredLocalComponentCount": 0
  },
  "visualReferences": [],
  "businessObjects": [],
  "states": [],
  "pages": [],
  "flows": [],
  "components": [],
  "interactions": [],
  "emptyStates": [],
  "errorStates": [],
  "annotations": [],
  "referenceTraceability": [],
  "openQuestions": []
}
```

## Flow 与 Page

- `flowId` 在低模、高模和后续修复中保持稳定；使用 lowercase ASCII、数字和连字符。
- `fidelity` 必须与 `mode` 一致。
- 新流程 Page：`create-new-page`，命名 `10 LF · <流程名>` 或 `20 HF · <流程名>`。
- `fix|iteration` 必须 `update-existing-page` 并提供现有 `targetPageId`。
- `archive-and-create-replacement` 只用于用户明确要求保留旧版的根本重构。
- `pairedPageId` 指向同一 `flowId` 的另一保真 Page；不存在时为空。
- 生成前用 `03-figma-design-manifest.json` 和实时 Page 扫描按 `flowId + fidelity` 查重。

## Design System Dependency

- 低模可使用 `status=not-applicable`，但必须完成四个基础 Page 的文件治理。
- 高模必须 `status=approved`，并列出实际使用的 Token Collection、Component、Pattern 和 View Template ID。
- `assetResolution` 包含本次新增或扩展的每个资产。必须先在相应基础 Page 创建并批准，再创建 Flow Page 实例。
- Flow Page 只使用实例和场景 override；不得 detach 或创建未登记本地组件。
- `conformanceRequirements` 三个计数在正式高模中必须为 0。

## Low-Fidelity Rules

- 只表达信息架构、状态、关键交互和业务流程，使用灰阶线框。
- 先读取截图知识库并生成 `03-interface-baseline.json`；关键区域必须可追溯到需求或实际检查截图。
- 一个流程独占一个低模 Page；主流程、异常、空错状态和交互注释放入标准 Section。

## High-Fidelity Rules

- 只基于已评审 PRD/BDD、已确认低模和 Approved Design System。
- 低模不得作为唯一视觉来源。
- 没有视觉来源时先走视觉方向与 Design System gate；不存在“接受风险后直接高模”。
- 所有视觉属性应绑定 semantic token，所有组件和页面组合来自已批准资产。
- 不得增加未确认业务范围。

## VisualDirectionSpec

没有视觉来源时，先保存：

```json
{
  "designFile": {"fileId": "", "fileName": ""},
  "temporaryPage": {"pageName": "00 Visual Directions · <yyyyMMdd-HHmm>", "pageId": ""},
  "candidateCount": 3,
  "candidates": [
    {
      "directionId": "",
      "name": "",
      "rationale": "",
      "colors": [],
      "typography": [],
      "spacing": [],
      "radii": [],
      "shadows": [],
      "coreComponents": [],
      "representativeView": {},
      "bestFor": []
    }
  ],
  "selection": {"status": "pending | selected", "directionIds": [], "combinationNotes": ""}
}
```

必须先截图、保存 review 并等待选择。选定方向固化并经用户确认后，才允许创建高模 `PrototypeSpec`。

## Screenshot References

- 截图路径被记录不等于已经检查；必须实际打开并记录观察结果。
- 截图只提供结构或视觉指导，不得覆盖已确认业务规则。
- 不复制第三方品牌、Logo、私有数据或无权使用的专有内容。
