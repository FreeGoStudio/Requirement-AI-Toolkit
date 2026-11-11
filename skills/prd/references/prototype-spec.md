# HTML PrototypeSpec

每次生成或迭代前保存规格。业务模型、参考决策及高模所需评审尚未确认时不进入生成。

```json
{
  "mode": "high-fidelity",
  "productDomain": "demo",
  "flowIdentity": {"flowId": "login", "flowName": "登录", "objective": "完成登录", "fidelity": "high", "changeType": "new-flow"},
  "htmlStrategy": {"action": "create", "entryPath": "working/demo/prototypes/high/login.html"},
  "prototypeReferenceGate": {"userDecision": "continue-without-reference", "evidence": "working/demo/02-reference-decision.md"},
  "designSystemDependency": {"status": "approved", "assetIds": ["tokens", "button"]},
  "sourceArtifacts": ["working/demo/02-business-model.md", "docs/requirements/demo/index.md", "working/demo/08-bdd.md"],
  "interfaceBaseline": {"artifactPath": "working/demo/03-interface-baseline.json"},
  "screens": [{"screenId": "login-form", "states": ["idle", "error", "success"]}],
  "interactions": [{"id": "submit", "trigger": "提交", "from": "idle", "to": "success", "ruleId": "RULE-01"}],
  "referenceTraceability": [],
  "openQuestions": []
}
```

- flowId 使用小写 ASCII、数字与连字符，迭代保持稳定；mode 与 fidelity 必须匹配。
- changeType 为 new-flow、fix、iteration 或 redesign。不存在正式入口时 create；已有入口及修复/迭代使用 update，entryPath 必须匹配清单。不因重试更换路径。需要保留旧版时先按已授权范围归档，再原位更新正式入口。
- 所有元数据路径相对 Git 仓库根目录，不允许绝对路径或 ..。入口为 `working/<slug>/prototypes/high/<flowId>.html`；原型内部资源引用仍相对文件。
- prototypeReferenceGate.userDecision 为 provided-reference、use-existing-prototype 或 continue-without-reference；pending 不可生成。evidence 指向真实参考决策记录。
- 高模 mode=high-fidelity、fidelity=high，designSystemDependency.status=approved，assetIds 列出实际使用的已批准资产，至少包含 tokens 和 component。视觉来源及批准记录保存在设计系统评审中。
- screens 覆盖已确认的主流程、异常、空错状态，每个 screenId 对应实际 HTML 锚点。interactions 记录触发条件、前后状态和需求规则 ID，未知规则留为开放问题，不自行决定。
- 来源记录包含 prototypeElement、sourceType（requirement/screenshot）、source、sourceRegion、decision、reason。入选截图实际查看情况记入 InterfaceBaseline。

## 视觉方向

已有批准设计系统直接复用。无视觉来源时在 `09-visual-direction.md` 提出一套方向，说明颜色、字体、间距、组件和代表性页面的设计依据；用户确认后建立设计系统。不生成三套候选、候选 HTML 或候选发布入口。
