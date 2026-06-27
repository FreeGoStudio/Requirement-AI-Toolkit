---
name: product-requirement-prototyping
description: "将原始产品需求转化为澄清问题、业务规则、业务对象、状态模型、工作流检查、中文 PRD、Mermaid 流程图、中文 BDD 验收场景，以及 Figma 低/高保真原型。用于支持产品经理完成需求澄清、PRD/BDD/流程图生成、通过 figma-console-mcp 调用 Figma 桥接插件、原型反查与评审产物输出。中文触发: 产品需求工具, 使用产品需求工具, 产品需求原型工具, 使用产品需求原型工具, 产品需求原型助手, 产品需求创建, 需求澄清, 低保真原型, 高保真原型, PRD, 流程图, BDD, Figma 原型."
---

# 产品需求原型工具

## 核心规则

以带 gate 的产品需求工作流运行。不得跳过 gate，不得虚构 Figma 结果，在产品经理明确确认当前阶段前，不得进入下一个主要阶段。

Hard stop 表示提出必要问题后立即停止任务。不得继续做假设，不得生成下一阶段产物，也不得调用 Figma。

所有面向用户的自然语言回复必须使用中文。只有代码标识、文件名、JSON 字段名、工具名、Mermaid/Gherkin 语法关键字等技术字面量可以保留英文。

默认产物为中文 Markdown。流程图使用 Mermaid。BDD 场景默认使用中文，除非用户明确要求其他语言。

每个阶段产物都必须持久化到磁盘。每次任务开始时读取 `references/output-artifacts.md`，创建或复用其中定义的项目输出目录，并在每次面向用户的阶段总结中包含已保存文件路径。

当没有可用的项目既有原型时，可接受用户提供的截图作为原型生成的视觉参考。截图仅作为布局、信息密度、组件模式和视觉语气参考，不得覆盖已确认的业务规则或工作流 gate。

在生成任何低保真或高保真原型前，必须执行原型参考 gate：检查是否存在项目既有原型或用户提供的视觉参考。如果两者都不存在，必须明确询问用户提供截图/参考图，或确认无参考图也继续生成。

参考 gate 是 hard stop。如果 gate 决策缺失或处于 `pending`，只输出参考检查结果、已保存的 `02-reference-decision.md` 路径，以及要求用户提供截图/参考图或确认无参考继续的中文问题。

高保真必须执行视觉参考 gate。已确认的低保真原型只能作为流程和结构参考，不足以作为高保真视觉参考。高保真生成前必须至少具备一个视觉来源：截图/参考图、既有高保真 Figma 页面、设计系统/组件库、品牌 UI 指南，或用户明确确认接受质量风险并在无视觉参考下继续。

## 工作流

1. **原始需求接收**
   - 读取 `references/output-artifacts.md` 并创建需求输出目录。
   - 复述用户目标、受众、参与角色、推断的产品端形态，以及尚未解决的假设。
   - 生成聚焦于业务规则、角色、业务对象、状态、流程边界、异常、权限、数据来源和成功标准的澄清问题。
   - 停止前保存接收摘要和澄清问题。
   - 停止并等待用户回答，不得提前生成原型或 PRD。

2. **业务收敛**
   - 将回答转化为业务对象、对象关系、状态、状态流转、主流程、异常流程和开放风险。
   - 请求确认前保存收敛后的业务模型。
   - 要求用户明确确认业务模型。
   - 在获得确认前不得调用 Figma。

3. **低保真原型**
   - 读取 `references/prototype-spec.md`。
   - 执行原型参考 gate：检查当前需求是否有既有 Figma 页面/原型或已保存的视觉参考。
   - 如果不存在参考，要求用户提供截图/参考图，或明确回复“无参考图，继续生成”。
   - 生成 `PrototypeSpec` 前保存参考决策。
   - 如果参考决策为 `pending`，必须 hard stop，不得生成 `03-low-fidelity-prototype-spec.json`。
   - 生成结构化的低保真 `PrototypeSpec`。
   - 如果用户提供了截图，将其作为视觉参考写入 `PrototypeSpec`。
   - 在任何 Figma 调用前保存低保真 `PrototypeSpec`。
   - 读取 `references/figma-console-mcp.md`。
   - 除非用户明确要求修改既有 Figma 页面，否则必须为当前需求的低保真原型创建新的 Figma 页面。
   - 执行 Figma Tool Discovery Preflight，包括精确搜索、宽泛搜索、截图工具别名匹配和只读 bridge smoke test。
   - 只有 preflight 明确失败后才停止，并按失败类型说明是工具未暴露还是 bridge/session 执行失败。
   - 如果 `figma_execute` 可用但截图工具不可用，低保真草稿可以继续创建，但必须说明无法做截图校验；若当前任务要求视觉验证，则 hard stop。
   - preflight 通过后，调用工具创建或更新低保真 Figma 原型。

4. **原型反查**
   - 检查低保真原型输出，或工具返回的 frame/component 摘要。
   - 识别缺失步骤、交互不清、状态冲突、规则缺口、空/错状态，以及角色权限不匹配。
   - 保存反查报告。
   - 在生成最终需求产物前，要求用户确认或给出修正。

5. **需求产物**
   - 读取 `references/prd-template.md` 和 `references/bdd-template.md`。
   - 生成可评审的中文 PRD、Mermaid 流程图和中文 BDD 场景。
   - 分别保存 PRD、Mermaid 流程图和 BDD 文件。
   - 在高保真工作前要求用户评审并批准。

6. **高保真原型**
   - 高保真只能基于已评审的 PRD/BDD 和低保真反馈。
   - 再次执行原型参考 gate：已批准的低保真原型只能作为流程/结构参考。
   - 执行视觉参考 gate：检查截图/参考图、既有高保真 Figma 页面、设计系统/组件库或品牌 UI 指南。
   - 如果没有可用视觉来源，要求用户提供一个视觉来源，或明确回复“无视觉参考，继续生成并接受风险”。
   - 生成 `PrototypeSpec` 前保存参考决策。
   - 如果参考决策为 `pending`，必须 hard stop，不得生成 `08-high-fidelity-prototype-spec.json`。
   - 生成高保真 `PrototypeSpec`。
   - 如果用户提供了截图，将其作为视觉参考写入 `PrototypeSpec`，并说明会复用哪些视觉方面。
   - 在任何 Figma 调用前保存高保真 `PrototypeSpec`。
   - 除非用户明确要求修改既有 Figma 页面，否则必须为当前需求的高保真原型创建新的 Figma 页面。
   - 调用 Figma 前再次执行 Figma Tool Discovery Preflight，包括精确搜索、宽泛搜索、截图工具别名匹配和只读 bridge smoke test。
   - 高保真或任何需要视觉验证的阶段必须具备截图能力；若只有 `figma_execute` 可用但截图工具不可用，必须 hard stop 并说明缺少截图校验能力。
   - 只有在获得明确批准后，才创建或更新高保真 Figma 原型。

## Gates

以下节点必须获得用户明确确认：

- 收集澄清问题答案后，在将业务收敛视为最终版本前。
- 汇总业务对象、状态和主流程后，在生成低保真 Figma 原型前。
- 没有既有原型或视觉参考时，在生成原型前。
- 低保真原型反查后，在生成 PRD/流程图/BDD 前。
- PRD/BDD 评审后，在生成高保真 Figma 原型前。

如果用户要求在缺少确认时继续，必须用中文总结风险并请求缺失的确认。如果用户明确覆盖 gate，必须在输出中记录该覆盖决定。

## Hard Stops

出现以下情况时必须立即停止，且不得生成下游产物：

- 澄清问题尚未回答。
- 业务收敛尚未确认。
- 原型参考 gate 决策为 `pending`。
- 高保真视觉参考 gate 决策为 `pending`。
- 低保真原型评审尚未确认。
- PRD/BDD 评审尚未批准进入高保真。
- Figma Tool Discovery Preflight 经过精确搜索和宽泛搜索后仍缺少 `figma_execute`。
- Figma bridge smoke test 失败。
- 当前 Figma 阶段要求视觉验证但缺少 `figma_capture_screenshot` 或 `figma_take_screenshot`。

当原型参考 gate 处于 `pending` 时，只能询问以下一个中文决策问题：

```text
未找到当前需求可复用的已有原型或视觉参考。请提供截图/参考图，或明确回复“无参考图，继续生成”。
```

然后停止。

当高保真视觉参考 gate 处于 `pending` 时，只能询问以下一个中文决策问题：

```text
低保真只能作为流程和结构参考，不能单独支撑高保真视觉生成。请提供参考图、设计系统、已有高保真页面，或明确回复“无视觉参考，继续生成并接受风险”。
```

然后停止。

## 参考文件加载

- 生成任何阶段产物前，读取 `references/output-artifacts.md`。
- 进入任何 Figma 原型阶段前，读取 `references/prototype-spec.md`。
- 检查或调用 Figma 工具前，读取 `references/figma-console-mcp.md`。
- 起草 PRD 前，读取 `references/prd-template.md`。
- 起草 BDD 场景前，读取 `references/bdd-template.md`。

## 输出标准

- 产品产物要具体到足以评审，但除非用户要求实现深度，否则不要虚构后端 API、埋点、发布计划或数据库字段。
- 从需求推断 B 端、C 端、移动端、桌面端或混合产品端形态。说明推断结果，并在该推断会显著影响原型时向用户确认。
- 将开放问题保留为明确章节，不得静默解决高风险假设。
- 当 Figma preflight 失败时，提供原本会发送的精确 `PrototypeSpec`，说明失败类型，然后停止。
- 每个完成阶段的回复都必须列出本阶段写入或更新的文件。
