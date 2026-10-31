---
name: prd
description: "中文产品需求工具。用户调用 $prd，或需要需求澄清、PRD、BDD、流程图、低保真或高保真 HTML 原型时使用。按需求成熟度探索问题、比较方案并收敛业务模型，产出可浏览的 HTML 需求文档与交互原型。"
---

# 产品需求与 HTML 原型

用中文开展需求探索、方案比较、业务收敛和评审，直接写出可在浏览器打开的 HTML 文档与低/高保真原型。代码标识和 Mermaid/Gherkin 语法可保留英文。

## 核心规则

- 以用户原始需求及明确确认作为业务依据，不虚构 API、数据库字段、发布计划或业务规则。开放问题显式保留。
- 任务开始读取 `references/output-artifacts.md`，复用同一输出目录；仅创建已到达阶段的文件。
- 进入原型阶段时读取 `references/html-output.md`、`references/design-governance.md`、`references/prototype-spec.md`。直接生成本地 HTML/CSS/JavaScript，不依赖设计平台账号、插件或远程设计服务。
- 按以下评审节点推进，已有明确确认可沿用。前置业务确认不足时，仅等待依赖该决策的正式产物与原型变更；可继续独立的探索、比较和草案整理，不假定确认通过。
- 区分文件生成、自动校验、浏览器实际验证和用户验收。无浏览器能力时保存可执行产物并标记待验证，不虚报截图或交互通过，不推进依赖该检查的评审。

## 1. 需求接收、探索与比较

读取 `references/requirement-discovery.md`，先判断需求成熟度。模糊目标先探索真实问题与关键未知；已确认的简单修改直接核对缺口，不强制重开讨论。

保留原始需求，复述目标、受众、角色和产品端形态，区分用户提出的功能与目标。按相关性检查对象、状态、权限、异常、数据来源、成功标准及遗漏场景与替代办法。标明已知事实、待验证假设、建议方案和已确认决策；有实质取舍时比较 2–3 个业务方案并给出推荐，不强凑方案，不把建议当成承诺。原型展示数量不限制需求分析范围。

保存 `00-raw-requirement.html` 和 `01-clarification-questions.html`，后者承载探索结论、关键问题、假设和必要的比较。等待回答期间可整理不依赖未决规则的草案；规则、流程和验收场景草案明确标记待确认。

## 2. 业务收敛

将探索发现分为当前目标必要、待决定、暂不纳入；“必要”判断本身不等于已授权范围。将回答和采纳方案整理为对象、关系、状态流转、主流程、异常和风险，保存 `02-business-model.html`，记录范围、决策来源及确认状态。方案选择与范围确认并入现有业务模型确认，不新增固定关卡；已确认事项不重复询问。确认前不生成业务原型。

## 3. 低保真原型

- 读取 `references/screenshot-knowledge-workflow.md` 与 `references/knowledge-bases.json`，检查既有原型及参考来源。
- 保存 `02-reference-decision.html`。无参考时请用户提供参考或明确确认无参考继续；决策 pending 时不生成低模。
- 实际查看入选截图，保存 `03-interface-baseline.json`；无参考获准继续时标记低置信度及需求来源，不伪造截图。
- 扫描已有输出，建立或更新 `03-html-design-manifest.json`，按稳定 `flowId + fidelity` 定位唯一入口。
- 保存 `04-low-fidelity-prototype-spec.json`，通过 preflight 校验后写入 `prototypes/low/<flowId>.html`。灰阶表达结构，使用模拟数据演示已确认的主流程、异常和状态。

## 4. 低保真反查

在浏览器打开原型，实际操作并截图，对照界面基线检查壳层、导航、内容区、弹窗、信息密度、mustPreserve 与来源追踪。运行 postwrite 校验，保存 `05-low-fidelity-structure-review.html`。关键问题修正并复查后请求用户确认。

## 5. 需求文档

正式规则与验收场景只使用已确认内容，未决假设单列为开放问题。低模确认后读取 `references/prd-template.md` 和 `references/bdd-template.md`，生成 `06-prd.html`、`07-flowchart.html` 和 `08-bdd.html`。同时保留 `07-flowchart.mmd` 与带中文语言声明的 `08-bdd.feature` 作为可编辑源文件。需求规则链接到原型对应 screen/state 锚点；流程图须实际可见，不能仅显示源码。用户批准 PRD/BDD 后进入高保真准备。

## 6. 视觉方向与设计系统

低模只作结构参考。已有经批准设计系统时复用；有品牌或高模参考时据此建立 CSS token、组件、组合与模板，并在 `design-system/index.html` 展示与评审。无视觉来源时保存 `09-visual-direction-spec.json`，默认生成三套可浏览候选 `visual-directions/index.html`，截图并保存 `10-visual-direction-review.html`，等待选择。选择后固化设计系统，保存 `11-design-system-review.html`，用户明确确认后才能标记 approved。

## 7. 高保真原型

保存 `12-high-fidelity-prototype-spec.json`，先登记并批准新增设计资产，再在 `prototypes/high/<flowId>.html` 使用共享样式/组件。保留低模相同 flowId 与 screenId。运行治理校验，检查实际代码依赖、浏览器渲染、响应式、键盘操作与业务状态，保存 `13-high-fidelity-review.html`。失败项修复并复查后请求最终验收。

## 阻塞与恢复

业务确认或参考决策未完成、入选截图未查看、同一流程存在重复正式入口、规格校验失败、设计系统未批准时，不进入对应下游阶段。保存实际错误和待验收项到 `index.html`。恢复时读取原始需求、最新确认和实际文件，不用摘要代替需求，不以重试为由生成重复原型。已确认的旧任务直接续接，不补做历史方案比较；新增不确定性只影响相关决策，用户否决的建议不进入正式范围。

每阶段回复给出当前阶段、下一确认点、绝对输出目录和本阶段文件链接。
