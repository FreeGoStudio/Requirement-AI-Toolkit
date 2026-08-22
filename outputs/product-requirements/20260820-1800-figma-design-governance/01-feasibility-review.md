# Figma 设计治理方案可行性评审

## 结论

方案方向正确，整体可行，建议采纳，但不建议原样实施。它能把当前主要依赖截图和自然语言提示的“视觉参考”，升级为可检查的“设计资产依赖”，预计会明显降低跨流程、跨批次生成时的风格漂移。

需要修正三个关键点：

1. Figma 的 Page 位于 File 内，不直接位于 Project/Folder 内。Figma 自 2026 年 8 月起正将 `Projects` 改名为 `Folders`；真正的隔离边界应明确为“一个产品/设计域对应一个 Figma File”，Folder 只负责组织一个或多个文件。
2. Design Token、基础组件、页面模板和业务流程不能只靠 Page 名称形成约束；Skill 必须读取并引用变量、样式、组件和实例的稳定 ID。
3. “任何新设计先进入 Design System”和“所有页面先封装成组件”不宜作为绝对规则，否则会产生大量一次性组件、过早抽象和维护负担。

## 推荐对象层级

### 小型项目：单文件模式

```text
Figma Folder（原 Project）
└─ Product UI.fig
   ├─ 00 Cover & Rules
   ├─ 01 Foundations
   │  ├─ Variables / Tokens
   │  ├─ Color / Typography / Effect Styles
   │  └─ Grid / Breakpoints
   ├─ 02 Components
   │  ├─ Primitives
   │  └─ Composite Components
   ├─ 03 Patterns
   │  └─ 可复用业务模式：筛选表格、步骤表单、详情侧栏等
   ├─ 04 View Templates
   │  └─ 页面壳层与可复用页面模板
   ├─ 10 LF · <业务流程>
   ├─ 20 HF · <业务流程>
   └─ 90 Archive
```

### 中大型项目：多文件模式

```text
Figma Folder（原 Project）
├─ Product Design System.fig   # 发布 Variables、Styles、Components
├─ Product View Templates.fig  # 使用已发布库，维护 Pattern 与 View Template
└─ Feature Flows.fig           # 低模、高模、场景和原型连线
```

多文件模式治理更清晰，但依赖 Figma Library 发布、权限和版本管理；个人或早期项目先采用单文件模式更实际。

Figma 官方说明：Page 用于组织 File 内的画布；组件、样式和 Variables 最初只在源 File 内可用，跨 File 复用需要发布 Library，且 Library 能力受套餐与权限影响。因此，单文件模式是最稳妥的最小版本，多文件模式应作为具备 Library 条件后的升级路径。

## 对原方案逐条判断

| 设想 | 判断 | 建议修正 |
| --- | --- | --- |
| 以项目隔离 | 基本合理 | 用“产品/设计域 → Figma File”作为实际执行边界；不要把 Figma Folder（原 Project）当成 Page 容器。 |
| `Design System` 包含 Token、Component | 合理 | 小项目可同 Page 分区；规模增大后至少拆为 `Foundations`、`Components` 两个 Page。 |
| `Views` 封装具体页面 | 有条件合理 | 改名 `View Templates` 更准确；复用页面壳层、布局和稳定区域，不应把所有完整业务页面都组件化。 |
| 每个业务流程单独建低模 Page | 合理 | 使用稳定命名；Page 内以 Section 区分主流程、异常流、空/错状态，并为 Frame 写入 flow/screen ID。 |
| 高模只能使用 Design System | 非常合理 | 除组件实例外，还要强制颜色、字号、间距、圆角、阴影绑定 semantic token，禁止任意 raw value。 |
| 新设计必须先进入 Design System | 方向正确但过严 | 新 primitive、通用 variant 或跨两个以上 View 可复用的模式先入库；一次性业务组合先局部实现，满足晋升规则后再进入 Pattern/Component。 |
| 流程页复用 `Views` | 合理但需控制粒度 | 流程页放 View Template 的实例，再填入场景数据和状态；交互复杂或只出现一次的完整屏幕可保留为业务 Frame。 |

## 为什么它能降低漂移

当前视觉 gate 只要求存在截图、既有高保真页面、设计系统或品牌规范，甚至允许用户接受风险后在无视觉来源下继续。这能防止完全盲生，但不能保证生成结果真正复用了同一套资产。

新的治理模型形成四层约束：

1. **Token 层**：颜色、字号、间距、圆角、阴影来自 semantic variables。
2. **Component 层**：按钮、输入框、表格、弹窗等来自稳定 component/variant ID。
3. **Pattern / View Template 层**：页面壳层、导航、内容密度和常见业务组合可复用。
4. **Flow 层**：只负责场景、数据、状态、跳转和业务逻辑，不再重新发明视觉语言。

这比“参考某张截图做得像”更稳定，因为引用关系可以被机器检查。

## 不应采用的绝对规则

### 不应要求每个完整页面都是 Component

完整页面组件会带来深层实例、override 失效、属性爆炸和原型连线维护困难。应优先组件化以下内容：

- 全局壳层和导航；
- 跨多个流程复用的页面模板；
- 稳定的业务 Pattern；
- 有明确状态或 variant 的交互组件。

业务流程中的一次性页面可以是普通 Frame，但其内部仍必须使用 token 和组件实例。

### 不应把所有首次出现的组合立即加入 Design System

建议采用晋升规则：

- 新增基础视觉原语或既有组件缺失的必要 variant：必须先更新 Design System；
- 在两个及以上 View 中出现、语义稳定的组合：晋升为 Pattern 或 View Template；
- 单流程、一次性组合：保留为局部业务 Frame，并记录为 candidate；
- 未批准的资产标记 `Draft`，不得被其他正式高模依赖。

## 建议加入 Skill 的强制流程

### 1. Figma Architecture Preflight

首次进入目标 Figma File 时检查并建立：

- `Foundations`、`Components`、`Patterns`、`View Templates` 所需 Page/Section；
- token/variable collection、mode、style 和 component set；
- 资产状态：`Draft`、`Approved`、`Deprecated`；
- 文件是否为预期产品/设计域。

已存在时只能复用或增量迁移，不应每次重新创建一套。

### 2. Design System Gate

高保真前必须输出 `DesignSystemManifest`，至少包括：

```json
{
  "fileId": "",
  "foundationsPageId": "",
  "componentsPageId": "",
  "patternsPageId": "",
  "viewTemplatesPageId": "",
  "variableCollections": [],
  "approvedComponentSets": [],
  "approvedViewTemplates": [],
  "version": "",
  "status": "ready | migration-required | blocked"
}
```

若 manifest 不存在或状态不是 `ready`，高保真应 hard stop；“无视觉参考并接受风险”不能绕过同一项目已经规定的 Design System 合规要求。

### 3. Asset Resolution

生成高模前，逐项完成：

```text
页面所需资产
├─ 已有 Approved 组件/模板 → 记录 ID 后复用
├─ 已有但缺 variant → 先扩展 Design System，再复用
├─ 新通用模式 → 在 Patterns/View Templates 定义并批准
└─ 一次性业务组合 → 本地 Frame，仍绑定 token 与基础组件
```

### 4. 高模生成

- Flow Page 使用组件或 View Template 实例；
- 只通过 component properties/instance overrides 填充场景数据和状态；
- 禁止 detach instance，除非记录原因并进入 review；
- 每个高模 Frame 记录来源低模 screen ID、View Template ID 和使用的关键 component IDs。

### 5. Conformance Audit

截图检查之外，再增加结构检查：

- raw color、raw font、raw spacing 的数量；
- detached instance 数量；
- 未批准组件和本地重复组件数量；
- token 绑定覆盖率；
- View Template 使用率；
- 高模 Frame 与低模 screen/flow 的映射完整率；
- 新资产是否先在 Design System 注册。

建议正式高模的最低门槛为：关键视觉属性 token 绑定率 100%、未说明的 detached instance 为 0、关键交互组件 Approved 引用率 100%。间距 token 覆盖率是否能被当前 Bridge 稳定检查，应先做技术验证。

## 当前 Skill 的具体缺口

1. `PrototypeSpec.components` 只是组件清单，没有组件 ID、variant、属性、token binding 或批准状态。
2. 只有 `figmaPageStrategy`，没有 Figma Folder/File 架构和 Design System Page 的稳定定位。
3. `highFidelityVisualReferenceGate` 把 Design System 视为多个可选视觉来源之一，而不是同项目高模的强制依赖。
4. 默认每阶段新建 Page，但没有稳定的基础 Page、命名注册表、重复 Page 检测与归档策略。
5. 没有 `Pattern`、`ViewTemplate`、`ScreenInstance` 三者的区分。
6. 没有“先解析已有资产 → 决定复用/扩展/新增 → 再生成页面”的 gate。
7. 反查主要依赖截图和结构基线，缺少 token、instance、detach、variant 等机器可校验项。
8. “无视觉参考继续并接受风险”仍可能制造新的视觉语言，需限制为初始化 Design System 的显式任务，而非普通业务高模的通行证。

## 推荐最小落地版本

不建议一次引入完整企业级 DesignOps。第一版只实现：

1. 单 Figma File 内固定四个基础 Page：`Foundations`、`Components`、`View Templates`、业务 Flow Pages。
2. 新增 `DesignSystemManifest`，记录 Page ID、变量集合和 Approved Component/View Template ID。
3. 高模前强制资产解析，禁止随意 raw color、font、radius 和 shadow。
4. Flow Page 优先使用 View Template 实例，但不强制每个完整页面组件化。
5. 高模后执行 token binding、component instance、detached instance 三项审计。

完成这五项后，风格漂移会从“靠提示词和视觉判断发现”转为“在生成前限制、生成后量化检查”。

## 最终判断

- **可行性：高。** `figma-console-mcp` 若能读取/创建 variables、components、instances 和 node IDs，就能落地核心闭环。
- **合理性：方向合理，原始粒度略重。** 应把“全页面组件化”改为“模板化 + 场景实例化”，把“所有新设计先入库”改为“基础原语/通用资产先入库，一次性组合候选化”。
- **预期收益：高。** 对跨需求、跨批次风格一致性帮助显著，也会改善修改传播和审计能力。
- **主要成本：中高。** 需要资产命名、状态、版本、迁移和审计规则；早期生成速度会稍慢，但返工会下降。
- **建议：实施。** 先做单文件最小版本，验证 Bridge 对 Variables、Components、Instances 的读写与检查能力，再决定是否升级为多文件 Library 模式。

## 补充规则：一个业务流程独占一个 Page

### 判断

该规则合理，建议设为默认强约束。不同业务流程不得混放在同一个业务 Page；对既有业务流程的缺陷修复、小范围交互修正或已确认需求内的迭代，应更新原 Page，不得重复新建 Page。

但“一项业务流程一个 Page”不等于低保真和高保真混在同一个 Page。建议一个业务流程在每种保真阶段各占一个 Page：

```text
10 LF · 应用升级
20 HF · 应用升级
```

两者属于同一 `flowId`，通过元数据建立映射；低模负责结构与流程，高模负责最终视觉与交互状态。

### 业务流程边界

一个业务流程应同时满足：

- 有一个明确的用户目标；
- 有可识别的触发入口；
- 有连续的关键步骤与决策；
- 有明确成功终态；
- 异常分支仍服务于同一个目标。

例如“发起应用升级 → 选择升级包 → 检查设备 → 执行升级 → 查看结果”可视为一个流程；“升级包管理”若可以独立进入、独立完成目标，则应另建 Page。

### 可以放在同一业务 Page 的内容

- 主流程；
- 同一目标下的异常分支；
- 空状态、错误状态、权限不足状态；
- 弹窗、抽屉、Toast 等过程状态；
- 同一流程的不同角色视图，但角色差异过大时应拆分；
- 修复前后对照区，但修复完成后旧版本应归档或删除，不能长期并列作为正式设计。

建议 Page 内使用固定 Section：

```text
00 Flow Overview
10 Main Flow
20 Exception Flows
30 Empty & Error States
40 Interaction Notes
90 Fix Review（临时）
```

### 必须新建 Page 的情况

- 用户目标不同；
- 入口和完成状态可以独立存在；
- 流程由不同角色独立负责，且页面结构明显不同；
- 新流程可以脱离原流程单独评审、发布或验收；
- 原流程发生根本重构，需要保留旧版作为已发布基线。

最后一种情况应创建带版本的替代 Page，并将旧 Page 移到 `Archive`，而不是让两个正式版本长期并存。

### 不得新建 Page 的情况

- 文案修正；
- 样式、间距或组件替换；
- 同一流程中的缺陷修复；
- 增补同一业务目标下的异常状态；
- 已确认需求范围内的小步骤调整；
- 因生成失败而重试。

这些情况必须通过目标 `pageId` 更新原 Page，并记录修复说明。Figma 自身的版本历史可承担大部分历史追踪，不应使用复制 Page 代替版本管理。

### 对 Skill 的修改建议

把当前“每次原型生成阶段默认创建新 Page”改为以下决策：

```text
先解析 flowId 与 fidelity
├─ 相同 flowId + 相同 fidelity 的 Page 已存在
│  ├─ 修复/迭代 → update-existing-page
│  └─ 用户明确要求重做且保留旧版 → archive-and-create-replacement
└─ 不存在
   └─ create-new-page
```

`PrototypeSpec` 应新增：

```json
{
  "flowIdentity": {
    "flowId": "application-upgrade",
    "flowName": "应用升级",
    "objective": "完成应用升级并确认结果",
    "fidelity": "low | high",
    "changeType": "new-flow | fix | iteration | redesign"
  },
  "figmaPageStrategy": {
    "action": "create-new-page | update-existing-page | archive-and-create-replacement",
    "targetPageId": "",
    "pairedPageId": "",
    "reason": ""
  }
}
```

生成前必须扫描目标文件内现有 Page，按 `flowId + fidelity` 查重。若发现同一组合存在多个正式 Page，应 hard stop 并要求确定主 Page，不得继续制造重复页面。

### 风险与控制

- **Page 数量增长**：这是可接受的可见成本；通过统一前缀、Index Page、Archive 和排序规则控制。
- **流程边界判断不稳定**：以“用户目标和独立终态”作为拆分标准，而不是按菜单或屏幕数量拆分。
- **跨流程共享页面重复**：共享结构放入 `View Templates`，各流程 Page 使用实例，不复制主组件。
- **修复污染正式展示**：使用临时 `Fix Review` Section；确认后合并到主流程并清理临时内容。

综合判断：建议实施，且应作为业务 Flow Page 的默认 hard rule；唯一需要保留的例外是明确的根本重构与版本替换，而不是普通修复。
