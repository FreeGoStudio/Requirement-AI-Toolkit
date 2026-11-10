# 通用多应用需求与持久原型管理平台——实施规范 v2.0

> 状态：待实施 / 待环境核验；本文不是已实现或已部署能力说明。
> 日期：2026-11-10
> 目标读者：Codex / AI Agent、研发工程师、产品负责人
> 原则：平台规则通用化；项目通过配置声明 App；人类负责验收；AI 执行实现与辅助冲突解决。
> 本轮范围：按用户提供的 v2.0 规范更新实施文档，不执行附件中的 P0/P1 指令，不修改代码、业务仓库、远程分支或部署。
> 文档来源：通用多应用需求与持久原型管理平台_实施规范_v2.0.md，并整合此前已确认的分仓、候选验收、同产物晋级、历史标注和发布恢复约定。

## 0. 执行摘要与决策

本平台用于管理“一个需求影响一个或多个可交互原型应用”的全生命周期：创建需求、自动建立分支、开发和预览、自动生成集成候选、CI 验证、AI 辅助解决冲突、人工验收、合并主线、长期追溯需求对应的原型与标注。

**确定的架构决策**：

1. **双仓库**：`{project}-requirements` 保存 PRD / 规范；`{project}-prototype` 是多应用 Monorepo，保存可运行原型及需求原型包。Plane 管需求流程，GitLab 管版本和 MR，VitePress 发布文档。
2. **App 配置驱动**：平台没有 `pos`、`web-admin`、`mini-admin` 等硬编码枚举。每个项目在 `prototype.yaml` 注册任意数量、任意 ID 的 App。
3. **代码按 App 划分**：`apps/{app-id}/src/`；**标注按需求归属、再按 App 划分**：`requirements/{requirement-id}/{app-id}/`；跨 App 流程：`requirements/{requirement-id}/flows/`。
4. **分支按需求创建**：创建 Plane 需求时，平台幂等创建同名 Git 分支 `{requirement-id}`，记录创建时的 `origin_commit`；没有必要立即构建或部署。正式业务标识不依赖分支是否仍存在。
5. **集成候选隔离**：从最新 `main` 创建 `integration/{requirement-id}/{attempt-id}`，把需求分支变更合入该候选。无冲突自动进行；Git 冲突交给隔离的 AI 执行器处理。所有候选必须经过 CI、预览与人工验收，**不得自动未经授权合入 `main`**。
6. **验收绑定不可变身份**：至少锁定 PRD Commit、需求分支 Head SHA、目标 main SHA、候选 SHA、各 App Artifact SHA-256、标注修订、场景修订与验收人。审批成功不等于未来任何代码都可合并。
7. **历史独立于分支**：需求合并、发布及历史引用验证通过后可删除无未交付改动的活动分支，历史需求预览使用验收快照：固定构建产物 + 场景 + 对应 App 标注。不要依赖长期运行的 MR Review App。
8. **版本与快照分离**：`main` 每次合并形成新提交，但不强制每个需求打正式产品 Tag；历史需求快照可独立保存。正式产品基线 Tag 可按发布节奏创建。
9. **存储三级管理**：在线热缓存、不可变归档、可选冷存储；历史快照引用去重，缓存可清理，正式验收归档不得被普通 GC 删除。
10. **初期保持简单**：第一阶段不实现复杂微服务、MinIO、向量数据库、全面多 Agent 编排或独立大型管理门户。先验证完整闭环。

### 非目标

- 不实现正式业务后端、真实支付、真实设备驱动或生产业务数据。
- 不把原型等同于实际软件上线状态；原型验收与真实开发/上线状态独立。
- 不实现一套新的 Git 版本控制系统；充分利用 GitLab 分支、MR、Commit、Tag、CI。
- 不把每个需求做成独立的原型项目或长期容器。

## 1. 术语与数据边界

| 实体 | 唯一标识 | 职责 |
|---|---|---|
| Project | `project_id` | 一个业务产品或项目 |
| Requirement | `project_id + requirement_id` | 稳定业务标识，与 Plane 原始 Work Item ID 映射 |
| PRD Revision | `prd_repo + prd_path + prd_commit` | 对应需求文档的精确内容版本 |
| Prototype Repository | `repo_id` | 可交互原型 Monorepo |
| Prototype App | `project_id + app_id` | 可独立构建、预览及验收的应用；非技术平台枚举 |
| Requirement Prototype Package | `project_id + requirement_id` | 对应需求的 App 标注、场景、步骤、跨 App 流程 |
| Prototype Change | `change_id` | 一次可独立审查的原型变更；初期一个需求一个活动 Change |
| Integration Attempt | `attempt_id` | 某次需求与具体 main 版本集成的尝试 |
| Candidate | `candidate_commit` | 待验收的完整集成结果 |
| Acceptance Snapshot | `snapshot_id` | 不可变的验收依据及对应可运行原型资产 |
| Baseline | `tag` / `commit` | 整个产品的正式设计基线 |

工具仓库 `Requirement-AI-Toolkit` 维护技能、模板、校验与发布能力，不作为某个产品的需求或原型业务仓库。

业务状态分离：`requirement_status`、`prototype_change_status`、`development_status` 不能混用。PRD 已批准、原型已验收、软件已上线是三种不同事实。

一个需求可影响 0..N 个 App；一个 App 可被 N 个需求修改；一个需求未来可能关联多个 Prototype Change，因此数据库层不要将 Requirement 与 MR 写死为永久 1:1。

## 2. 仓库结构

### 2.1 需求文档仓库

```text
{project}-requirements/
├── requirements/
│   ├── REQ-001/
│   │   ├── prd.md
│   │   └── decisions.md                # 可选，需求决策记录
│   └── REQ-002/
│       └── prd.md
├── standards/
├── .vitepress/
└── README.md
```

- PRD 是业务规则、验收条件的文字权威来源；VitePress 为发布视图。
- 文档仓库的 PRD 修订独立于原型仓库；原型 Change 必须引用当时确认的 `prd_commit`。
- 不要求文档仓库每个需求使用一个长期分支；其 MR 流程与原型开发分支独立。

### 2.2 多应用原型仓库

```text
{project}-prototype/
├── prototype.yaml
├── apps/
│   └── {app-id}/
│       ├── src/
│       ├── tests/
│       ├── package.json               # 以 Web/Vite App 为例；其他类型允许其他配置
│       └── vite.config.ts             # 非所有 App 必须有此文件
├── packages/
│   ├── prototype-sdk/                 # 稳定语义元素 ID、场景接口、消息协议
│   ├── annotation-renderer/           # 标注展示适配层
│   ├── scenario-engine/               # 固定状态/模拟数据
│   └── shared-contracts/              # 有价值的共享契约；不强行共享 UI
├── requirements/
│   └── {requirement-id}/
│       ├── manifest.yaml              # 需求影响的 App 清单、PRD 引用、验收范围
│       ├── flows/                     # 跨 App 流程，可选
│       └── {app-id}/
│           ├── annotations.yaml
│           ├── walkthrough.yaml
│           └── scenarios/
│               └── default.yaml
├── tests/
│   └── cross-app/
├── schemas/                            # 配置与需求包 JSON Schema
├── scripts/                            # lint、build、preview、schema validation
├── pnpm-workspace.yaml                 # 选用 pnpm 时
├── package.json
├── AGENTS.md
└── .gitlab-ci.yml
```

项目目前的实例可注册 `pos`、`web-admin`、`mini-admin` 三个 App（POS 端、Web 管理端、小程序掌柜端），**但这三个名称只出现在实例配置和示例中，不能出现在治理平台的硬编码分支里**。其他 ERP/CRM 项目应能声明其他 App 而不修改平台核心逻辑。

## 3. 通用项目配置 `prototype.yaml`

```yaml
schema_version: 1
project:
  id: example-project
  name: Example Product
repository:
  default_branch: main
  requirement_branch_template: "{requirement_id}"
applications:
  - id: app-a
    name: Application A
    root: apps/app-a
    kind: web-prototype                 # 可扩展的描述标签，不用作硬编码逻辑
    build:
      runner: node                      # 必须受执行器白名单/隔离策略约束
      command: pnpm --filter app-a build
      output: apps/app-a/dist
    preview:
      provider: static                  # static/container/external/artifact，可扩展
      base_path: /artifacts/{artifact_id}/app-a/ # 逻辑入口解析到固定产物地址
    capabilities:
      interactive_preview: true
      annotations: true
      scenarios: true
      automated_tests: true
  - id: app-b
    name: Application B
    root: apps/app-b
    build:
      runner: node
      command: pnpm --filter app-b build
      output: apps/app-b/dist
    preview:
      provider: static
      base_path: /artifacts/{artifact_id}/app-b/
    capabilities:
      interactive_preview: true
      annotations: true
      scenarios: true
      automated_tests: true
```

约束：
- `app_id` 在一个项目内唯一、稳定、符合安全路径字符规则（建议小写字母、数字、连字符）；禁止 `..`、斜杠与任意路径穿越。
- Manifest 引用的 App 必须存在于此配置。
- `root`、构建输出路径必须限制在仓库/隔离工作区内，不能逃逸。
- `kind` 仅为描述；构建与预览由 Provider/Capabilities 决定。
- 不可信分支中的构建脚本只能在隔离 Runner 执行，禁止生产凭据、主机 Docker Socket 和高权限密钥。
- `static` 预览需正确设置资产 base path；`container` 需配额和 TTL；`external` 必须声明外链可信边界；`artifact` 不承诺浏览器交互。
- 项目配置变更应作为受保护的配置变更审查，不能让任意需求提交直接扩大执行权限。

## 4. 需求原型包 Schema

`requirements/{requirement-id}/manifest.yaml`：

```yaml
schema_version: 1
requirement_id: REQ-001
title: Example Requirement
prd:
  repository: example-requirements
  path: requirements/REQ-001/prd.md
  commit: "<exact-prd-sha>"
applications:
  app-a:
    required_for_acceptance: true
    entry: /checkout
    annotations: app-a/annotations.yaml
    walkthrough: app-a/walkthrough.yaml
    scenarios:
      - app-a/scenarios/insufficient.yaml
  app-b:
    required_for_acceptance: false
    entry: /settings
    annotations: app-b/annotations.yaml
flows:
  - flows/cross-app-payment.yaml
```

每个 App 独立的 `annotations.yaml` 示例：

```yaml
schema_version: 1
annotations:
  - id: ANNO-001
    type: element
    target:
      route: /checkout
      element_id: payment.stored-value
    title: 储值卡入口
    description: 在此处展示储值卡支付方式
    acceptance_criteria: [AC-001]
  - id: ANNO-002
    type: note
    target:
      route: /checkout
    title: 余额不足处理
    description: 实际业务规则以 PRD 对应提交为准
    acceptance_criteria: [AC-002]
```

场景数据示例：

```yaml
schema_version: 1
id: insufficient
initial_state:
  order_total: 128
  card_balance: 30
expected:
  remaining_payment: 98
```

操作步骤示例：

```yaml
schema_version: 1
steps:
  - id: STEP-001
    action: select_scenario
    scenario: insufficient
  - id: STEP-002
    action: highlight
    target: payment.stored-value
    annotation: ANNO-001
```

**标注规则**：

1. 业务上属于 Requirement，文件在其需求目录；开发上与需求分支一起版本化；验收后固定为不可变修订。
2. 页面组件通过稳定 `data-prototype-id` 或 SDK 注册语义 ID，避免仅靠屏幕像素坐标、源码行号定位。
3. 不允许同一渲染范围出现歧义的重复语义 ID；CI/运行时检测缺失、重复、不可见目标。
4. 标注不得作为业务规则唯一来源；标注内容须引用 PRD 验收条件。
5. 历史标注不可因新版本组件改名而原地覆盖；当前版本视图的迁移结果是新修订，并显示失效/人工确认状态。
6. `flows/` 保存跨 App 业务步骤，不复制散落在不同 App 的同一业务规则。每个 flow 固定 ID、required_for_acceptance、PRD 验收点及有序步骤；每步明确 app_id、场景/步骤引用与预期状态。Schema 校验 App 和引用存在，运行时记录逐步结果；跨 App Mock 契约与数据版本一并冻结。
7. 没有涉及的 App 不必建立目录；`required_for_acceptance` 明确是否必须参与整体验收。声明为非必需不代表可跳过受依赖影响的回归，也不能借此排除 PRD 明确要求的能力。0 App 的需求可只更新文档，记录原型不适用，不伪造空产物或原型验收。

## 5. 分支、基线与版本策略

- `main`：已验收并集成的持久原型；受保护，不允许一般人员或 Agent 直接推送。
- `{requirement-id}`：平台创建的需求分支，例如 `REQ-001`；创建时记录 `origin_commit`；不自动开长期预览。
- `integration/{requirement-id}/{attempt-id}`：一次集成候选；候选从确定的 `target_main_sha` 创建后整合需求提交，隔离 AI 冲突修复。
- `tag`：按产品设计基线发布节奏产生，不要求每次 MR 合并都加 Tag。

需求记录必须保留：

```yaml
requirement_id: REQ-001
prototype_change_id: CHG-001
origin_baseline:
  commit: <immutable-created-from-sha>
working_baseline:
  commit: <most-recent-main-sha-actually-integrated-into-feature>
source_branch: REQ-001
source_head: <current-feature-sha>
latest_attempt_id: INT-001-003
accepted_snapshot_id: null
introduced_baseline: null
```

`origin_baseline` 永不覆盖。`working_baseline` 只有在代码真正整合该 SHA 时才更新。需求已合并后不因最新 `main` 变化而更改其历史来源/引入版本；新版本的回归保障来自测试。

空闲分支允许长期存在；首次开发前无独立提交时可以快进到最新 `main`。如已有独立提交，必须使用合并/重建候选，不能强制 reset 丢失改动。

## 6. 自动化工作流

### 6.1 创建需求

1. Plane 创建 Requirement，获得全局/项目内稳定 ID。
2. 平台接收事件并去重（事件 ID、project ID、requirement ID）。
3. 确保对应 PRD 路径存在或安排生成；**从原型仓库最新 main SHA 创建 `{requirement-id}` 分支**。
4. 写入 `origin_commit`、分支引用、同步状态。创建 `requirements/{requirement-id}/manifest.yaml` 的初始模板（可在分支首次开发提交），不强制创建任何 App 子目录。
5. 若重复事件到达，不重复创建；若存在同名非平台管理分支，进入人工异常队列。
6. 创建分支本身不触发完整构建、容器或永久部署。

### 6.2 开发预览

- AI/Codex 只在需求分支工作，修改 `apps/`、相关 `requirements/{id}/`、测试及必要共享包。
- 推送后 CI 运行 Schema 校验、类型/单测和受影响 App 构建；可按需生成可变开发预览 URL。
- 在进入最终验收前，PRD 版本、需要验收的 App 清单、场景和标注应确定。

### 6.3 集成候选（必须幂等、有记录）

1. 固定 `source_head_sha`、`target_main_sha`、`prd_commit`。
2. 基于 `target_main_sha` 新建唯一候选分支 `integration/{id}/{attempt-id}`。
3. 尝试把需求变更合入候选；**不直接更新 main，不在需求分支中覆盖原始实现**。
4. 无 Git 冲突：生成 candidate commit，进入 CI。
5. 有 Git 冲突：在隔离工作区调用 AI，提供 PRD、两个版本的场景、冲突列表、组件契约；AI 可修改候选并产出结构化冲突报告。
6. 发生互斥业务规则、无法推断的操作语义、跨 App 契约冲突时，AI 只能 `blocked_business_conflict`，要求人工决策，不能擅自选一方。
7. 对候选执行全量适用 CI：Schema、lint/typecheck、单测、依赖受影响 App 构建、关键 Playwright 场景、标注目标检查、必要跨 App E2E。
8. 测试通过，发布基于固定 `candidate_commit` 的**集成验收预览**；只有该候选版本可申请正式人工验收。
9. AI 对冲突所做的修改必须可审查，并不得触碰不属于此次变更的安全配置、部署密钥或生产数据。

`IntegrationAttempt` 最少字段：

```yaml
attempt_id: INT-REQ-001-003
requirement_id: REQ-001
change_id: CHG-001
source_head_sha: <sha>
target_main_sha: <sha>
prd_commit: <sha>
candidate_branch: integration/REQ-001/INT-REQ-001-003
candidate_commit: <sha>
status: preview_ready
conflict_report_artifact: <optional-path>
ci_pipeline_id: <pipeline-id>
```

状态建议：`pending → merging → resolving? → testing → preview_ready → awaiting_acceptance → approved → merged → publishing → published`，并提供 `blocked_business_conflict`、`failed`、`stale`、`rejected`，保留每次失败的独立记录和失败阶段；发布失败保留 merged 事实，重试仅补发缺口。

### 6.4 验收与合并门禁

- 需求级和 App 级验收要分别记录；所有 `required_for_acceptance=true` 的 App 均需通过。跨 App flow 如声明 required，也需测试与确认。
- 验收人查看 **候选预览**（而不只是需求原始分支），可切换 App、场景、步骤、标注、代码变更和冲突处理说明。
- 正式验收记录固定：人、时间、`prd_commit`、`candidate_commit`、`target_main_sha`、各 App 构建产物 SHA、标注/场景修订和结论。
- 准备合并时重新读取 `main`。若 `main SHA` 与验收时不同，则候选过期；平台重新集成并运行 CI，受影响交互必须重新验收。不能将旧批准直接套用到新 Commit。
- 通过 GitLab 受保护分支与受限合并身份实现最终合并。若当前 GitLab 版本/许可无法原生强制审批，使用**独立受保护验收服务 + 受保护 CI 合并门禁**；不能靠开发分支可编辑的 YAML 中 `approved: true`。
- 验收前可靠保存候选的各 App 不可变产物与需求包；人工确认后先持久化受信任验收记录，成功后才开放合并门禁。需求资料仓库的验收记录仍是权威来源，服务中的索引和状态不形成另一套可任意编辑的审批真相。
- 最终 MR 的源是已验收的候选分支，不是原需求分支。采用 fast-forward 合并，禁用 squash 和验收后 rebase，合并后核实 main 指向 candidate_commit。正式发布晋级各 App 已验收的同一产物，不重新构建替代。
- 同一项目的最终检查与合并串行，所有常规 main 更新经过同一受控入口；实际合并必须拒绝过期候选，不能先检查后无条件合并。平台合并身份与开发 Agent 分离。
- 第一版源 HEAD、目标 main、批准 PRD、候选、App 验收范围、标注、场景或 flow 依据变化时，旧凭证不授权新结果；新尝试重新测试并确认受影响内容。验收记录自身的元数据提交不算 PRD 内容变更。
- 合并成功后记录 merged_commit，晋级固定 App 产物集合并验证访问，再登记发布映射；分别记录验收、合并、发布状态。发布失败保留旧入口、验收与合并事实并允许幂等重试，不标记完整交付。
- 仅在发布及历史引用验证通过、需求分支无新增未交付提交后清理临时分支和入口；不得删除历史索引或唯一可恢复产物。

### 6.5 AI 冲突处理边界

- 仅限隔离临时工作区，设置执行超时、最大尝试次数和文件变更范围。
- 保留原始冲突文本、AI 修复差异、测试输出、Agent 版本/执行 ID。
- AI 可处理语法、结构、导入、组件映射等技术冲突；**业务含义有歧义必须升级到人工判断**。
- 无 Git 冲突也必须跑回归测试，不能以 `git merge` 成功当作业务验收通过。

## 7. 需求预览入口与 App 选择

统一稳定入口：`/projects/{project-id}/requirements/{requirement-id}`。

1. **开发与待验收视图**：开发分支最新 Preview 可变，不是验收依据；待验收入口明确指向固定集成候选，不能混用。
2. **历史验收视图**：默认展示，读取 Acceptance Snapshot 内的固定 App Artifact、场景、标注和步骤；不依赖已删除的需求分支。
3. **当前产品视图**：最新已发布 `main` 的 App Artifact，叠加目前仍能映射的需求标注；对失效目标明确提示，不静默猜测位置。
4. **需求差异视图**（P4）：验收前后原型的业务语义变化与截图比较，不能只用 Git Diff 替代业务解释。

每个需求入口可以选择 App；App ID 从 manifest/registry 动态生成，不写死端名。Preview Provider 由 App 配置指定。历史预览网址示例（仅设计）：

```text
/design/projects/example/requirements/REQ-001?view=accepted&app=app-a
/design/projects/example/requirements/REQ-001?view=current&app=app-b
/preview/{candidate-id}/{app-id}/
/archive/{snapshot-id}/{app-id}/
```

### 标注渲染

浏览器类 App 可先采用“外层需求视图 + iframe 内 App + 同版本 SDK + postMessage 协议”。消息必须校验 origin、request ID、schema 版本与数据权限；部署设置 CSP/frame-ancestors。不能保证所有非浏览器 App 使用 iframe，需 Preview Provider 适配。

浏览器 Provider 先协商 SDK 能力；旧 SDK 不支持新功能时展示原始快照加旁栏，明确不支持的操作，不修改历史产物。定位诊断包含 project_id、requirement_id、app_id、元素 ID、场景、路由和目标产物摘要。

历史快照应冻结可运行构建与其 SDK/场景数据，不仅是截图。对依赖服务的 App 需归档可复现的模拟数据/Mock 契约版本。

## 8. 历史归档、版本数量与回收

正式验收快照至少包含：

```yaml
snapshot_id: SNAP-REQ-001-001
project_id: example
requirement_id: REQ-001
prd_commit: <sha>
source_head_sha: <sha>
target_main_sha: <sha>
candidate_commit: <sha>
merged_commit: <sha>
acceptance_record_id: <id>
prototype_config_digest: <sha256>
requirement_manifest_digest: <sha256>
flow_digest: <sha256-or-not-applicable>
apps:
  app-a:
    artifact_sha256: <sha256>
    annotation_revision: <sha-or-revision>
    scenario_revision: <sha-or-revision>
    walkthrough_digest: <sha256>
    sdk_version: <version>
  app-b:
    artifact_sha256: <sha256>
    annotation_revision: <sha-or-revision>
    scenario_revision: <sha-or-revision>
    walkthrough_digest: <sha256>
    sdk_version: <version>
```

### 三类存储对象

- **元数据索引**：永久保存引用关系及权威审核记录的可核验索引（SQLite 初期可用，后续迁移 PostgreSQL 时保留迁移路径）。
- **不可变归档**：保留验收所需静态构建、标注、场景、Manifest、校验和、必要构建依赖信息；初期本地文件系统，后续可替换 MinIO/S3。归档应定期备份与哈希校验。
- **在线缓存**：Nginx 直接服务近期版本；旧版本从归档按需恢复、校验、缓存并按 TTL/LRU 清理。

多个需求可引用同一正式基线/同一 Artifact SHA，不复制数据。正式版本 Tag 不需要一需求一份。初期以完整构建压缩包归档即可；后期再按实际规模考虑 CAS 文件级去重。

**GC 不变量**：任何被验收快照引用的最后一份归档不可自动删除；可以删除在线缓存、过期 MR 预览、临时集成分支。恢复失败必须明确提示，不要退回加载最新版本假装是历史版本。

## 9. 治理服务：模块和初始接口

优先采用模块化单体，可内嵌现有平台；Go 是 v2.0 推荐方案，具体语言和数据库在 P0 根据已有实现确定，避免过早微服务化。模块：

- `ProjectConfig` / `AppRegistry`：解析 schema，加载 App 和 Provider。
- `RequirementSync`：消费 Plane Webhook、与 PRD 关联、创建分支。
- `GitIntegration`：安全创建候选、自动合并、冲突识别。
- `AgentConflictResolver`：沙箱执行 AI 与冲突报告。
- `BuildPreview`：执行 CI/部署、获取 Artifact/Preview URL。
- `AnnotationService`：读取、校验、加载指定版本的需求标注。
- `AcceptanceService`：受控审批、候选 SHA 锁定、最终门禁。
- `SnapshotArchive`：不可变归档、校验、按需恢复、缓存清理。

建议 HTTP API（初期按需求实现，不要求一次性全部实现）：

```text
POST   /api/projects/{projectId}/requirements/sync
GET    /api/projects/{projectId}/apps
GET    /api/projects/{projectId}/requirements/{requirementId}
POST   /api/projects/{projectId}/requirements/{requirementId}/integrations
GET    /api/integrations/{attemptId}
GET    /api/integrations/{attemptId}/previews
POST   /api/integrations/{attemptId}/acceptance
POST   /api/integrations/{attemptId}/merge
GET    /api/projects/{projectId}/requirements/{requirementId}/views
GET    /api/snapshots/{snapshotId}
POST   /api/snapshots/{snapshotId}/restore
```

API 行为要求：所有 POST 幂等或支持 Idempotency-Key；需要鉴权、授权、审计；验收人由真实会话识别，授权用户可提交批准或驳回；禁止调用者伪造他人身份或由 Agent 自签人工结果；所有合并执行在安全检查后由受限服务身份实施。

基础数据表（实体级建议，具体数据库迁移由实施阶段定义）：`projects`、`prototype_apps`、`requirements`、`prototype_changes`、`integration_attempts`、`app_build_artifacts`、`acceptance_records`、`acceptance_app_results`、`snapshots`、`snapshot_app_assets`、`archives`、`audit_events`、`webhook_events`。

`project_id + requirement_id`、`attempt_id`、`snapshot_id` 等应具备唯一约束；分支创建与事件消费需要事务/幂等防重。

## 10. CI/CD 与部署门禁

阶段性 Pipeline：

```text
validate-config
  → validate-requirement-package
  → lint / typecheck / unit
  → affected-app-build
  → scenario-e2e / annotation-target-check / cross-app-regression
  → publish-candidate-preview
  → acceptance-gate (受控外部验收记录)
  → merge-main (有权限的合并操作)
  → promote-accepted-app-artifacts / register-published-mapping
```

- 候选预览前已可靠保存产物；验收记录持久化成功后再运行 acceptance-gate。合并后晋级同一 App 产物集合，不能在 main 重新打包并沿用旧批准。
- CI 构建应记录原始 `commit SHA` 与构建产物哈希；测试覆盖需求指定 App 及共享包依赖影响范围。
- 首版可所有 App 全构建，后续引入按影响范围的构建优化；优化不能漏掉共享 SDK/契约改动影响。
- 候选预览地址应绑定 `attempt_id`，验收构建在审查过程中不可被无提示替换。
- 禁止开发分支未经批准直接推送/合并 `main`；保护签名/授权凭据与 Runner Secrets。
- GitLab 社区版特性以当前实际部署版本为准，P0 核查 MR、Branch API、Webhook、CI、Runner、Protected Branch 的真实支持；不依赖可能需要付费版本的强制审批或 Merged Results Pipelines。

## 11. Codex / Agent 的工作要求

在 `AGENTS.md` 中落实：

1. 首先读取本仓库 `prototype.yaml`、对应需求 Manifest、固定 PRD Commit、目标 App 规范。
2. 修改功能只能在需求分支，不能直接写入 `main`。
3. 只为涉及的 App 添加/更新目录；不能把 `pos`、`web-admin` 等当前项目名称当平台常量。
4. 尽可能复用组件及 SDK；保留稳定语义 ID；新增场景和测试。
5. 不允许执行真实支付、退款或设备操作，必须使用 Mock。
6. 需求标注、场景、跨 App 流程跟需求包走；变更标注要维护验收条件引用。
7. 不允许自行批准需求、修改受保护审批记录或在没有授权时合并 `main`。
8. 遇到业务冲突必须报告选项与影响，停止自动决策。
9. 每次变更输出：代码影响 App 列表、关联 PRD、测试、预览、风险、未实现事项。
10. 不因“通用化”引入无需求的复杂抽象；优先交付经过测试的最小闭环。

## 12. 分阶段实施计划与验收标准

### P0：环境核验与技术基线

交付：
- 核实 GitLab 实例版本/许可证、Runner、Branch/MR API、Webhook、Protected Branch；Plane 版本、可用 API、需求 ID 规则、鉴权；Nginx、域名/内网、静态发布路径、存储与备份。
- 调查现有仓库和已有原型，不覆盖已存在的代码。
- 提交 ADR（架构决策记录）和差异清单，明确第一阶段 App 的示例配置与执行环境。

验收：可以用受限测试账户创建/查询 Git 分支、触发最小 CI、接收模拟 Plane 事件；没有生产修改。

### P1：通用 Monorepo + 配置校验 + 自动分支

交付：
- `prototype.yaml`、Schema 校验、通用 `AppRegistry`；至少两个不同 App ID 的示例应用（可以使用当前项目实际 App，但平台逻辑不可硬编码）。
- `requirements/{id}/manifest.yaml` Schema；需求同步、幂等创建同名分支、保存 `origin_commit`。
- 原型普通开发预览、App 独立构建与静态部署。

验收：新加一个未预设 ID 的 App，只改配置与该 App 文件即可构建/预览；重复同步事件不产生额外分支；100 个闲置分支不启动 100 份预览资源。

### P2：标注、场景、需求视图

交付：
- 按需求/App 组织标注、步骤、场景和可选 flows。
- 语义元素 SDK、标注渲染、场景初始化；统一需求页面按 App 动态切换。
- 标注缺失/重复/不可见检测和初始 E2E 测试。

验收：一个需求可跨两个 App 标注；两个 App 的标注互不污染；只关联一个 App 的需求不需生成其他 App 目录。

### P3：自动集成、AI 冲突解决、人工验收

交付：
- 需求分支自动合并到独立 `integration/{id}/{attempt-id}`。
- 冲突检测、AI 在隔离候选中处理、结构化报告、业务冲突人工阻塞。
- CI 验证、固定候选预览、App 级与需求级验收、可靠保存产物与验收凭证、受控门禁、并发 main SHA 检查、候选正式合并和同产物发布。
- P3 内先跑通无冲突的完整闭环，再加入 AI 冲突解决；不以 AI 调度前置阻塞基本验收验证。

验收：
- 无冲突自动生成候选，不修改 main；验收后才由有权身份合入 main。
- 人为制造同文件文本冲突，AI 修复只影响候选，原始需求分支不被破坏。
- 人为制造互斥业务规则，系统进入阻塞，不自行选方案。
- 人为在验收后先合并另一需求，原候选被标记过期，不能用旧批准直接合入。

### P4：历史访问、归档恢复与回收完善

交付：
- 在 P3 已固定的多 App Artifact、标注、场景、flow、PRD/Commit 基础上完善历史入口及恢复能力。
- 默认历史验收视图、当前产品视图、按需恢复旧构建。
- 热缓存 TTL、受保护不可变归档、归档完整性校验和定期备份。
- 可选语义差异对比、历史标注迁移建议（不自动改历史）。

验收：
- 测试 `main v0.0.1 → REQ-002 → v0.0.2 → REQ-001 → v0.0.3`。
- REQ-002 历史视图仍指向当时验收快照；当前视图加载最新原型；删除旧版本在线缓存后可从归档恢复。
- 已合并需求分支删除后仍可访问历史标注与可运行原型。
- 被正式验收引用的最后一份归档不会被 GC 删除。

### P5（可选）：持续治理与多 Agent 编排

仅在 P0–P4 稳定后：Plane 任务自动回写、跨 App 影响分析、需求变更追踪、变更差异可视化、Agent 自动编排和历史资产去重；不作为 MVP 前置依赖。

## 13. 第一轮端到端验收用例

使用独立测试项目与两个配置 App（A、B）：

1. `main` 初始化为 `v0.0.1`。平台创建 REQ-001 与 REQ-002，均记录原始 SHA，分支创建后不部署。
2. REQ-002 改 App A 与 App B，各有不同标注、场景、步骤；构建、预览、验收、合并后 `main` 达到下一基线（示例 v0.0.2）。
3. REQ-001 的历史原始 SHA 保留；从旧基线开发并申请集成，候选从最新 main 构建。
4. 测试无冲突自动集成，新增跨 App 回归；人工验收后合入，`main` 达到示例 v0.0.3。
5. 打开 REQ-002：历史验收视图复现 v0.0.2 的两个 App 与对应标注；当前产品视图显示 v0.0.3；如标注无法定位，明确告警。
6. 删除 REQ-002 活动分支和历史在线缓存，从归档恢复原型，验收快照仍可访问。
7. 模拟 main 竞态、AI 修复失败、PRD SHA 失效、缺失 App ID、重复语义 ID、归档损坏，确认系统安全失败并输出诊断。

## 14. 完成定义（Definition of Done）

功能只有同时满足以下条件才算完成：

- 变更内容通过 Schema 校验、单测与对应 App 的端到端测试。
- 有可重现的操作记录、版本 SHA 与构建产物 ID。
- 所有配置不依赖固定业务终端名称。
- 有明确的成功路径和失败/恢复路径。
- 安全边界有效：未审批无法合并主线，AI 无法伪造人工批准。
- 对应 README/ADR/API 契约已更新，无重复或相互矛盾的规范文件。
- CI 在干净环境可运行；验收步骤可以由另一名工程师复现。

## 15. 后续实施入口与本轮边界

后续获得实施任务后，先执行 P0 环境核验，输出已有实现、差异、风险和 P1 依赖；不能从本次文档更新推断已授权立即执行 P0/P1。附件中的首条 Agent 指令已转为待实施流程，本轮不调用业务服务、不创建业务仓库、不修改权限、不推送或部署。

当前已有目标服务器信息为私网 `10.94.164.176`，仅是待核验实例配置，不是平台常量。内网 Runner、Nginx、域名、认证和备份均需核实。第一版优先 static Provider 与已有能力，其他 Provider 按声明能力实现或明确不支持，不能默认为可交互。

## 16. 与已有方案的衔接及实施细则

### 16.1 ID、文件与迁移

需求 ID 继续沿用已有创建规则：手动输入英文字母和数字且两者均有，去首尾空白并转小写；空值生成 req＋日期＋随机字母数字。产品内唯一，归档不释放；手动重复提示重输，自动重复重新生成。Plane UUID 或展示编号另行映射，示例 REQ-001 不构成现有 ID 批量迁移授权。原型分支名称等于实际规范化需求 ID；候选统一采用 integration/{requirement_id}/{attempt_id}。

项目使用 project_id；旧 product_id 仅作兼容映射，不维护两份可变身份。app_id 在项目内唯一，任意是指符合配置 Schema 的可注册 ID，而非允许路径穿越或平台内置固定终端集合。

需求资料继续使用 requirements，取消低保真。新原型结构采用 apps/{app_id}/src，标注按 requirements/{requirement_id}/{app_id} 组织；需求根 manifest 与可选 flows 属于跨 App 范围。示例 Markdown/VitePress 不要求立即重写已有 HTML 需求文档，prd_path 必须指向实际版本文件。

旧 prototype/、requirements 下直接放置的标注包、outputs/product-requirements 或历史地址不得自动删除搬迁。先盘点并确认各旧原型对应 App，保留原始记录与固定快照，制定路径和链接兼容后再授权迁移。共享包只抽取有实际价值的 SDK、契约或组件，不强制所有 App 共用 UI。

### 16.2 App 构建、测试与发布集合

按需求发布独立文档包，按 App 构建完整运行产物，不按需求切碎某 App。首版可全量构建所有注册 App；优化后通过配置、共享包依赖和需求影响范围计算构建与回归集合，不仅依赖 manifest 手填清单。共享 SDK、模拟契约、配置变动不能漏测依赖 App；无法确定影响时扩大到相关集合验证。

候选记录每个 App 的产物来源。未变化 App 可以复用验证有效的固定产物，仍记录来源提交、执行和摘要。只有配置所声明能力能满足该 App 验收条件时才可参与对应验收；artifact 类型只提供下载时不得宣称通过交互验收。

原型内容、标注、场景、演示步骤、flow、运行依赖发生变化均须更新相应摘要与验证依据。只改文档或保存验收记录不重新构建未变 App。内容指纹采用排序相对路径及文件摘要，排除时间、流水线编号等执行元数据；执行来源另外保存。

正式发布使用不可变的项目发布清单，映射 app_id 到各 App 产物摘要和固定入口。先准备并验证整个待发布集合，再原子切换项目 current 清单，避免跨 App flow 混用未经验证的版本组合。某 App 晋级失败时保留原 current 集合，单独报告失败并重试；不可把部分成功冒充需求完整交付。同项目发布串行，旧任务不得覆盖新版本。

同产物晋级依赖固定产物地址：候选、历史和 current 入口解析到对应 App 的同一产物。prototype.yaml 中的 artifact_id 为发布系统分配的稳定定位键，不要求在构建前知道内容摘要；最终记录其 SHA-256。不得因部署路径变化重建后仍沿用旧验收，需验证深层刷新、懒加载及场景初始化。

### 16.3 验收、快照与正式基线

必须冻结参与验收的 App 清单及 required_for_acceptance、必要 flow 和逐 App 结果。所有必需 App、必需 flow 通过后才形成需求级批准；可选项失败仍需说明，不能用可选标记掩盖 PRD 要求。0 App 需求走文档流程，不要求凭空生成原型候选。

人工记录至少保存 prd_repo、prd_path、prd_commit、源/目标/候选 SHA、配置摘要、需求清单摘要、各 App 产物及标注/场景/步骤摘要、SDK 版本、flow 与 Mock 契约版本、确认者及逐项结果。批准 PRD 由受控流程确认，不靠修改 front matter 的 approved 字段替代。

权威验收记录写入需求资料仓库后才允许合并；运行服务可缓存索引和逐 App 结果，但必须可核验到同一受控记录。验收元数据提交不循环改写所引用 PRD。源、目标、候选或批准依据变化的失效规则按第 6.4 节执行，旧历史不覆盖。

snapshot_id 独立于正式 Tag，验收快照在可靠保存后即可存在；未发布时明确显示待合并/待发布。merged_commit 记录首次实际进入主线，introduced_baseline 只有进入某正式 Tag 时才填写。项目 current 可随成功部署更新，不要求每次合并生成 SemVer Tag。

历史默认展示最近一次成功发布的已验收修订，尚待发布的候选另列；新驳回不改写旧通过记录。当前视图展示最新成功发布集合，App 选择由所选快照及 manifest 动态产生，不能用当前注册表把历史已删除 App 隐藏掉。归档恢复失败不得回退最新内容冒充历史。

### 16.4 标注与演示的兼容细节

场景、标注和演示步骤在需求/App 范围内唯一；语义元素在 App 的实际渲染范围内唯一，不要求不同 App 的同名元素全局互斥。定位报告包含 App 及具体构建，两个 App 的标注不能相互污染。可见性、歧义和缺失必须明确报告。

支持 element、note、walkthrough、change 等版本化类型，按类型定义必填字段，note 无元素目标时不强制 element_id。验收条件引用必须存在于固定 PRD。演示先初始化状态再导航定位，等待页面就绪；失败报告步骤及原因。坐标只能是明确标记可靠性的辅助，不能掩盖语义定位失败。

浏览器 SDK 协议校验消息类型、requestId、schemaVersion、来源窗口、双向 Origin 和权限，并配置 CSP/frame-ancestors。非浏览器 Provider 使用适配协议，不假定 iframe 通用。旧 SDK 不支持时降级为原始产物与旁栏说明，不伪造执行成功。

历史 AnnotationRevision 不可变。当前视图的定位状态属于对目标 App 构建的诊断；迁移产生新修订并保留人工确认状态，不自动覆盖历史或随机匹配元素。构建归档包含所需 SDK、场景、演示步骤与 Mock 契约，使删除分支后仍可回放。

### 16.5 AI、清理与回滚

AI 优先保留仍有效的旧能力，但当前已确认需求明确替换旧行为时应按新要求修改，不能以保留旧功能抵消需求。禁止删除测试、禁用功能或忽略错误消除冲突。候选被驳回后保留冲突差异、处理报告和已确认业务决策；下一轮参考但不能机械复制整个旧候选。

清理临时入口、分支前确认发布及历史引用正常，且没有新增未交付提交。归档按 App 内容摘要去重，快照引用同一产物不复制；清理缓存不删除最后可恢复副本。元数据与归档均需备份、校验及恢复演练，永久删除须满足保留与授权规则。

回滚 current 清单只影响展示，不改 Git 历史和验收记录。源码回退需新提交；单 App 回滚仍须验证项目集合和跨 App 契约，不能承诺仅撤销一个需求且不影响其他需求。目录或登记删除仅报告待下线，不自动清空线上内容。

### 16.6 补充验收检查

- 新增未预设 App ID，只修改注册配置和 App 文件即可接入受支持 Provider，无平台核心分支改动。
- 一个需求涉及两个 App，分别保存产物、标注、场景、步骤和结果；只有全部必需 App/flow 通过才能整体验收。
- 一个需求只涉及一个 App，不生成其他 App 的需求包；0 App 需求可单独完成文档流程。
- 缺失 App、非法路径、越权执行器、缺少预览能力和歧义语义 ID 明确失败；配置不能扩大分支执行权限。
- 共享契约变化触发相关 App 与跨 App 回归；可选标记不绕过业务验收要求。
- 验收记录保存失败、源/目标/PRD 变化、两个合并并发、某 App 发布失败均不导致未经确认的组合进入 current。
- 正式集合各 App 摘要与候选验收一致；不重新构建后冒用旧批准，不强制每个需求创建正式 Tag。
- 删除历史 App 的当前注册、需求分支和在线缓存后，历史仍能恢复原 App 产物与标注；当前失效明确提示。
- 旧 SDK 降级和非法消息拒绝可验证；跨 App flow 回放显示每步所用 App、场景与结果。

分别报告实现完成、自动验证通过和最终业务验收完成，并区分验收、合并、发布状态。文档保存与本地 Git 提交仅表示本轮方案更新完成。

## 17. 技术参考

- [GitLab 合并方式](https://docs.gitlab.com/user/project/merge_requests/methods/)
- [GitLab MR API](https://docs.gitlab.com/api/merge_requests/)
- [GitLab MR approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
- [GitLab merged results pipelines](https://docs.gitlab.com/ci/pipelines/merged_results_pipelines/)
- [GitLab CI/CD 配置](https://docs.gitlab.com/ci/yaml/)
- [GitLab 部署资源组](https://docs.gitlab.com/ci/resource_groups/)
- [GitLab 部署安全](https://docs.gitlab.com/ci/environments/deployment_safety/)
- [Vite public base path](https://vite.dev/guide/build.html#public-base-path)
- [Nginx 静态服务](https://nginx.org/en/docs/beginners_guide.html)

以上为已有评审参考，具体配置须按实际实例版本核验；本轮未进行运行环境验证。
