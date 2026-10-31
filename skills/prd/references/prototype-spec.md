# HTML PrototypeSpec

每次生成或迭代前保存规格。业务模型、参考决策及高模所需评审尚未确认时不进入生成。

```json
{
  "mode": "low-fidelity",
  "productDomain": "demo",
  "flowIdentity": {"flowId": "login", "flowName": "登录", "objective": "完成登录", "fidelity": "low", "changeType": "new-flow"},
  "htmlStrategy": {"action": "create", "entryPath": "prototypes/low/login.html"},
  "prototypeReferenceGate": {"userDecision": "continue-without-reference", "evidence": "02-reference-decision.html"},
  "designSystemDependency": {"status": "not-applicable", "assetIds": []},
  "sourceArtifacts": ["02-business-model.html"],
  "interfaceBaseline": {"artifactPath": "03-interface-baseline.json"},
  "screens": [{"screenId": "login-form", "states": ["idle", "error", "success"]}],
  "interactions": [{"id": "submit", "trigger": "提交", "from": "idle", "to": "success", "ruleId": "RULE-01"}],
  "referenceTraceability": [],
  "openQuestions": []
}
```

- flowId 使用小写 ASCII、数字与连字符，低高模保持一致；mode 与 fidelity 必须匹配。
- changeType 为 new-flow、fix、iteration 或 redesign。不存在正式入口时 create；已有入口及修复/迭代使用 update，entryPath 必须匹配清单。不因重试更换路径。需要保留旧版时先按已授权范围归档，再原位更新正式入口。
- 所有路径相对清单目录，不允许逃逸到包外。入口固定为 `prototypes/<low|high>/<flowId>.html`。
- prototypeReferenceGate.userDecision 为 provided-reference、use-existing-prototype 或 continue-without-reference；pending 不可生成。evidence 指向真实参考决策记录。
- 高模 mode=high-fidelity、fidelity=high，designSystemDependency.status=approved，assetIds 列出实际使用的已批准资产，至少包含 tokens 和 component。视觉来源及批准记录保存在设计系统评审中。
- screens 覆盖已确认的主流程、异常、空错状态，每个 screenId 对应实际 HTML 锚点。interactions 记录触发条件、前后状态和需求规则 ID，未知规则留为开放问题，不自行决定。
- 来源记录包含 prototypeElement、sourceType（requirement/screenshot）、source、sourceRegion、decision、reason。入选截图实际查看情况记入 InterfaceBaseline。

## 视觉方向规格

`09-visual-direction-spec.json` 记录 candidates（默认三项），每项含 directionId、name、rationale、colors、typography、spacing、radii、shadows、coreComponents、representativeView、entryPath；selection 含 status=pending/selected、directionIds、combinationNotes。候选输出到 visual-directions/，实际截图后请求选择，再建立并确认设计系统。低模不作为唯一视觉来源。
