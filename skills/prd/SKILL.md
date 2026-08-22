---
name: prd
description: "中文产品需求工具。用户调用 $prd，或提到产品需求创建、需求澄清、PRD、BDD、流程图、低保真、高保真或 Figma 原型时使用。将原始需求转为经确认的业务模型、需求产物和受 Design System 约束的 Figma 原型。"
---

# PRD Skill

## Purpose

把原始产品需求转化为业务模型、中文 PRD、Mermaid 流程图、中文 BDD，以及经过结构与设计治理检查的 Figma 低/高保真原型。

所有面向用户的自然语言回复必须使用中文。代码标识、文件名、JSON 字段名、工具名和 Mermaid/Gherkin 语法可以保留英文。

## Core Rules

- 按 gate 推进；未获得当前阶段要求的明确确认，不得进入下一主要阶段。
- Hard stop 后立即停止，不得补充假设、生成下游产物或调用 Figma。
- 不得虚构 Figma 文件、Page、Frame、组件、截图或工具结果。
- 每阶段产物必须落盘。任务开始先读 `references/output-artifacts.md`，阶段回复列出输出目录和本阶段文件。
- Figma Design File 是产品设计隔离边界。Folder/Project 只组织文件，不是 Page 或设计资产的隔离边界。
- 任何 Figma 阶段都必须读取 `references/design-governance.md`、`references/prototype-spec.md` 和 `references/figma-console-mcp.md`。
- 只使用本地 `figma-console-mcp` 的 `mcp__figma_console__*` 工具；不得回退到其他 Figma 插件、connector 或 app。

## Workflow

### 1. 原始需求接收

- 复述目标、受众、角色、产品端形态和未解决假设。
- 提出业务规则、对象、状态、权限、异常、数据来源和成功标准的澄清问题。
- 保存 `00-raw-requirement.md` 和 `01-clarification-questions.md`，等待回答。

### 2. 业务收敛

- 将回答整理为业务对象、关系、状态流转、主流程、异常流程和开放风险。
- 保存 `02-business-model.md`，要求用户明确确认。
- 未确认前不得调用 Figma。

### 3. 低保真原型

- 读取 `references/screenshot-knowledge-workflow.md` 和 `references/knowledge-bases.json`，执行原型参考 gate。
- 参考决策为 `pending` 时只保存 `02-reference-decision.md` 并 hard stop。
- 只从 `<workspace-root>/Knowledge` 解析知识库；实际打开入选截图并生成 `03-interface-baseline.json`。
- 执行 Figma 只读 preflight，确认目标 Design File，扫描 Page、资产和 `flowId + fidelity`。
- 创建或更新 `03-figma-design-manifest.json`。缺少四个标准基础 Page 时，在已获准的原型阶段自动初始化；重复 Page 时 hard stop。
- 旧文件存在 `Design System + Views` 时只生成迁移计划；用户确认前不得移动、复制、重命名或删除资产。
- 保存并校验 `04-low-fidelity-prototype-spec.json`，再创建或更新唯一的 `10 LF · <流程名>` Page。

### 4. 低保真反查

- 截取完整 Frame，按 `InterfaceBaseline` 检查壳层、区域关系、信息密度、业务状态和来源追踪。
- 同时检查流程 Page 唯一性、Section 结构及低高模 `flowId` 映射。
- 保存 `05-low-fidelity-structure-review.md`；关键失败项修复并复查通过后，才请求用户确认。

### 5. 需求产物

- 低模确认后读取 `references/prd-template.md` 和 `references/bdd-template.md`。
- 保存 `06-prd.md`、`07-flowchart.mmd` 和 `08-bdd.feature`。
- 用户批准 PRD/BDD 后才进入高保真。

### 6. 视觉方向与 Design System

- 低模只能作为流程/结构参考，不是高模视觉来源。
- 检查截图、品牌规范、既有高模和已批准 Design System。
- 已有 Approved Design System 时执行资产解析；缺少 Design System 资产时，先在对应基础 Page 创建并登记，业务 Page 不得先行创建。
- 有视觉参考但没有 Approved Design System 时，基于参考固化 Token、组件、Pattern 和 View Template，截图后要求用户确认。
- 没有视觉参考时，保存 `09-visual-direction-spec.json`，在临时 `00 Visual Directions · <时间>` Page 默认生成三套方向并保存 `10-visual-direction-review.md`。
- 用户选择或组合方向后，将结果固化到四个基础 Page，保存 `11-design-system-review.md` 并要求明确确认。
- Design System 未确认为 `approved` 时 hard stop；不得用“接受风险”绕过。
- 确认后将候选 Page 重命名为 `90 Archive · Visual Directions · <时间>`。

### 7. 高保真原型与审计

- 保存并校验 `12-high-fidelity-prototype-spec.json`。
- 每个新增 Token、组件、Pattern、页面组合必须先在 Design System 登记为 `approved`，再由 `20 HF · <流程名>` 使用实例和场景 override。
- 禁止未登记本地组件、未解释的 raw style 和 detached instance。
- 截图并执行结构与设计系统一致性审计，保存 `13-high-fidelity-review.md`。
- 审计失败时修复并复查，不得标记高模完成。

## Gates

必须获得明确确认：

- 业务模型确认后才能生成低模。
- 无低模参考时，用户提供参考或明确确认无参考继续。
- 旧 Figma 文件迁移计划确认后才能移动既有资产。
- 低模反查确认后才能生成 PRD/BDD。
- PRD/BDD 批准后才能进入高模。
- 视觉方向选择后才能固化 Design System。
- Design System 明确确认后才能生成业务高模。

## Hard Stops

- 澄清问题、业务模型或前置评审未确认。
- 参考 gate 为 `pending`，或知识库截图未实际检查。
- `mcp__figma_console__figma_execute`、Bridge smoke test 或截图能力不可用。
- 目标 Design File 身份不明确。
- 标准基础 Page 重复，或同一 `flowId + fidelity` 存在多个正式 Page。
- 旧结构迁移待确认。
- `PrototypeSpec` 或 `03-figma-design-manifest.json` 未通过治理校验。
- Design System 未批准，或高模依赖未批准/未登记资产。
- 结构审计或高模一致性审计存在未修复关键失败。

## Reference Loading

- 所有阶段：`references/output-artifacts.md`。
- 所有 Figma 阶段：`references/design-governance.md`、`references/prototype-spec.md`、`references/figma-console-mcp.md`。
- 低模：`references/screenshot-knowledge-workflow.md`、`references/knowledge-bases.json`。
- PRD/BDD：`references/prd-template.md`、`references/bdd-template.md`。

## Output Standards

- 产品产物应足以评审，但不得虚构后端 API、埋点、发布计划或数据库字段。
- 开放问题必须显式保留，不得静默解决高风险假设。
- Figma 调用失败时保存准备发送的规格和失败类型，不得模拟成功。
- 每个阶段回复必须说明当前阶段、下一 gate、绝对输出目录和本阶段文件。
