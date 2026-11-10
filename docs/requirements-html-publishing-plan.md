# 多应用可交互展示原型管理平台——实施方案

- 更新日期：2026-11-10
- 状态：待实施、待环境核验，不代表已经实现、验证或部署。
- 需求依据：用户关于 Workspace/Project、项目双仓库、统一需求包、静态模拟原型、独立候选冲突处理及整体发布的最新确认。
- 本轮范围：统一更新方案正文，不实施代码、不创建业务仓库、不修改服务器或远程分支。此前附件作为参考，其执行指令不构成本轮授权。

## 1. 定位与核心决策

平台管理一套持续演进的完整产品原型。人提出需求、决定业务取舍并确认展示效果，平台负责分支、集成、测试、预览、发布和历史追溯，AI 辅助实现及解决简单冲突。

所有原型统一采用静态网页展示与模拟交互。POS、网页管理端、小程序管理端是同一产品的不同展示入口，不运行真实 POS 或小程序环境，不调用真实支付、短信、扫码认证、设备和生产数据。模拟二维码或验证码只用于展示状态和演示业务流程。

核心规则：

1. Workspace 管理多个 Project；每个 Project 拥有独立的一组需求资料仓库和原型仓库。
2. 一个需求是完整业务变更，可以涉及多个 App，不按端拆需求，也不在需求目录下按 App 分层。
3. 原型源码可以按 App 组织；App 名称通过项目配置注册，不写成平台固定业务枚举。
4. 创建需求时自动从该项目最新 main 提交创建同名需求分支；普通功能修改在需求分支完成。
5. 准备验收时从最新 main 创建独立临时集成分支，合入需求提交并处理冲突，不覆盖原需求分支或 main。
6. AI 能解决的简单冲突也必须测试、预览和人工确认；无法解决的冲突交给人工处理。
7. 每个候选生成一套完整项目静态原型包，整体预览、按需求验收、整体合并发布，不独立发布某个 App。
8. 人工验收固定候选和完整产物；合并候选后发布同一产物，不重新构建替代。
9. 验收快照不可变，后续合并和发布事实另行追加关联。历史访问不依赖活动分支。
10. 新项目直接使用本结构；旧系统迁移不是本方案的实施前置条件。

取消低保真阶段，保留已有满足要求的页面、交互与设计规范。原型验收、原型发布与真实业务软件上线分别记录，不能用一个 Done 混为一谈。

## 2. Workspace、Project 与数据权威来源

### 2.1 组织与 Git 边界

```text
Workspace：业务团队
├─ Project：零售产品
│  ├─ retail-requirements
│  └─ retail-prototype（POS、管理后台、小程序模拟页面）
└─ Project：供应链产品
   ├─ supply-requirements
   └─ supply-prototype
```

平台层级为 Workspace → Project → Requirement。Workspace 是组织和访问管理边界，不对应一个包含所有项目的 Git 仓库。Project 是 Git 集成、完整原型构建、发布与回滚的边界；不同项目各自的主线变化不使对方候选过期。

每个仓库已绑定项目，仓库内无需重复 workspace/project 两层目录。经常由同一需求共同修改的 POS、后台和移动页面应属于同一 Project。跨 Project 需求协调不纳入首版自动集成流程。

| 对象 | 标识与职责 |
| --- | --- |
| Workspace | workspace_id，组织项目与访问范围 |
| Project | 平台唯一 project_id，归属 workspace_id，绑定两个仓库 |
| Requirement | project_id + requirement_id，完整业务变化，与 Plane 原始工作项 ID 映射 |
| App | project_id + app_id，原型中的展示入口，不是独立需求或发布单元 |
| PrototypeChange | 需求的一次修订或变更，首版一个需求一个活动变更 |
| IntegrationAttempt | attempt_id，一次冻结来源的集成尝试 |
| PrototypeBuild | build_id，一套完整项目静态原型产物 |
| AcceptanceSnapshot | snapshot_id，固定人工确认的候选与产物依据 |
| IntegrationRecord | 实际合并结果，关联 snapshot_id 与 MR |
| ReleaseRecord | 实际整体发布结果，关联 snapshot_id、build_id 与合并记录 |

Project ID 全局唯一，因此内部可以用 project_id 直接定位，外部按 Workspace 路由时必须核对归属。需求 ID 在项目内唯一、归档后不释放；App ID 在项目内唯一。分支、MR 和展示版本号均不能代替长期业务标识。

### 2.2 组件与权威来源

| 内容 | 权威来源 |
| --- | --- |
| 需求流程、责任人、业务状态 | Plane 工作项，平台保存映射和必要缓存 |
| PRD 内容与修订 | 需求资料仓库的仓库标识、文件路径、精确 Commit |
| 原型代码与需求包 | 原型仓库的精确 Commit |
| 人工验收依据 | 需求资料仓库中受控、不可覆盖的验收记录 |
| 集成与发布执行事实 | 平台追加的运行记录，关联 GitLab MR、提交及实际发布结果 |
| 可恢复原型内容 | 固定 build_id 的不可变完整归档 |

VitePress 发布文档，GitLab 管理两仓库与 MR/CI，Nginx 服务静态原型，Codex 执行受限修改。平台服务协调事件、候选、验收及归档；可采用模块化单体，语言和数据库根据现有环境确定，不预先拆微服务。OpenHands 等编排不是首版依赖。

人工批准由真实身份和受控流程确认，不能靠 PRD 中 approved 字段、普通分支 YAML 或 AI 自述代替。数据库索引可缓存验收结果，但不能成为第二套可随意修改的审批真相。

工具仓库 Requirement-AI-Toolkit 维护技能、模板、校验和发布能力，不作为某项目的需求或原型业务仓库。

## 3. 新项目仓库与配置

### 3.1 目录结构

```text
{project}-requirements/
├─ requirements/
│  └─ req001/
│     ├─ prd.md
│     ├─ decisions.md                 # 按需记录业务确认
│     └─ acceptance-records/          # 受控验收记录
├─ standards/
├─ .vitepress/
└─ README.md

{project}-prototype/
├─ prototype.yaml
├─ apps/
│  ├─ pos/src/
│  ├─ admin/src/
│  └─ mobile/src/
├─ packages/                          # 按实际需要复用组件、SDK 和模拟逻辑
├─ requirements/
│  └─ req001/
│     ├─ manifest.yaml
│     ├─ annotations.yaml
│     ├─ scenarios.yaml
│     └─ walkthrough.yaml
├─ schemas/
├─ tests/
├─ scripts/
├─ AGENTS.md
└─ .gitlab-ci.yml
```

需求资料仓库保存业务文字与确认；原型仓库需求包保存本需求统一的标注、场景及演示步骤，不重复 PRD 全文。需求包没有 App 子目录，也不另设跨端流程目录，跨应用演示直接写入 walkthrough。

apps 下名称只是示例，可为任意符合命名规则的 App。按应用划分源码便于维护，不代表分别创建需求、审批、发布或回滚。共享代码仅按实际需要提取，不强制所有页面共用 UI。

### 3.2 prototype.yaml

```yaml
schema_version: 1
workspace_id: team-a
project_id: retail
repository:
  default_branch: main
applications:
  - id: pos
    name: POS 展示原型
    root: apps/pos
    build_command: pnpm --filter pos build
    output: apps/pos/dist
    entry: /login
  - id: admin
    name: 管理后台展示原型
    root: apps/admin
    build_command: pnpm --filter admin build
    output: apps/admin/dist
    entry: /settings
```

配置只声明应用名称、源码位置、静态构建命令、输出目录和入口。每个应用输出均为静态 HTML/CSS/JavaScript 和所需资源，由项目打包器统一收集；不设置预览类型选择或能力矩阵。

workspace_id、project_id 必须与平台注册关系一致。app_id 使用安全的小写字母、数字和连字符，不允许路径分隔符或路径穿越；root/output 解析后必须位于本项目隔离工作区。构建脚本运行在受限 Runner，不允许项目配置扩大部署权限或取得生产凭据。

每次候选冻结其配置版本。本次需求包按候选配置验证应用引用；过去已验收的需求包投影到当前原型时，缺失目标作为失效诊断，不以修改历史包来消除错误。历史回放按快照内配置运行，不向当前配置查询旧构建的入口。未来新需求删除展示入口时，当前视图明确提示已删除，历史快照仍保持原始内容；这是新平台历史保护，不是旧系统兼容层。

## 4. 需求 ID、创建与分支

需求 ID 沿用已有规则：手动输入英文字母和数字且两者均有，去首尾空白后转小写；空值生成 req＋日期＋随机字母数字，例如 req20261110a7f3c9。手动重复提示重输，自动重复重新生成；项目内唯一且不释放。Plane UUID 或展示编号独立映射，不直接假定其适合作为分支名。

创建流程：

1. 获取 Workspace、Project、需求 ID，验证项目归属与两个仓库配置。
2. 幂等登记需求及 PRD 路径，读取原型仓库 main 精确 SHA 和当时最新发布记录。
3. 从该 SHA 创建名称严格等于需求 ID 的原型分支。
4. 保存 origin_commit、分支和当时已发布版本；需求包骨架可在首次开发时提交。
5. 创建失败记录阶段并允许重试；已有同名分支先核对归属，不接管或覆盖未知工作。

需求资料仓库使用其常规编辑/MR 流程，不要求机械创建第二个同名分支。创建原型分支本身不构建、不部署；允许大量空闲分支，不主动批量同步。

首次开发前检查主线：无独立提交时可快进，有骨架或其他独立提交时受控同步，不强制重置。origin_commit 永不覆盖，working_base_commit 仅在实际吸收对应主线后更新。main 与在线版本可能因发布尚未完成而不同，必须分别记录。

一个需求可以只改资料而不改原型。按统一创建规则可以已有空分支；确认原型不适用后结束该 PrototypeChange，记录不适用原因，确认无未交付工作后清理分支，不制造候选或原型验收。

## 5. 统一需求包、场景与标注

### 5.1 Manifest

```yaml
schema_version: 1
requirement_id: req001
title: 启用短信验证码登录
prd:
  repository: retail-requirements
  path: requirements/req001/prd.md
  commit: <完整PRD提交SHA>
affected_apps: [admin, pos]
acceptance_criteria: [AC-001, AC-002]
annotations: annotations.yaml
scenarios: scenarios.yaml
walkthrough: walkthrough.yaml
review_scope:
  - id: admin-sms-settings
    app: admin
    route: /settings
    role: focus
    regions: [login.sms.settings]
    acceptance_criteria: [AC-001]
  - id: pos-sms-login
    app: pos
    route: /login
    role: focus
    regions: [login.sms.panel]
    acceptance_criteria: [AC-002]
  - id: pos-home
    app: pos
    route: /home
    role: context
    whole_page: true
```

affected_apps 说明业务影响和检查范围，不拆出 App 级审批或必需/可选开关。所有 PRD 验收条件在一个需求级结果中逐项确认；同一验收条件可以覆盖多个应用。影响清单不能代替共享逻辑回归分析，也不能用于跳过已确认业务要求。

四类 YAML 都版本化并校验格式及跨文件引用，PRD 引用指向精确内容而非最新网页。无原型变化时不要求补齐无意义演示文件。

review_scope 声明本需求的评审页面范围：focus 为重点评审页面，context 为完成演示必需的辅助页面，不代表该页发生了业务修改。范围 ID 在需求包内唯一；页面由 app 与 route 联合定位。regions 使用稳定的区域语义 ID，整页关注则明确声明 whole_page: true，两者互斥且必须选择一种。区域用于突出关注点，不据此禁用区域外全部操作。

同一路由下的 Tab、弹窗等如果承载不同功能，范围还须通过 states 显式列出允许进入的语义状态；省略 states 表示只允许该页面默认状态，不隐含允许其全部功能状态。可通过 scenario 引用已有场景以恢复评审起始状态，但场景初始化不能绕过范围检查。具体状态 ID 由应用声明并与 SDK 对接，不用屏幕坐标推断。

需要原型展示的 PRD 验收点必须至少关联一个 focus 页面或区域；无页面表现的验收点明确说明验证方式，不制造无意义页面。评审范围只限定浏览与关注内容，不缩减完整构建、整体发布或必要回归范围。范围随需求包版本化并冻结在候选及历史包内。

### 5.2 标注

```yaml
schema_version: 1
annotations:
  - id: anno001
    type: element
    scope_id: admin-sms-settings
    target:
      app: admin
      route: /settings
      element_id: login.sms.enabled
    title: 启用短信登录
    acceptance_criteria: [AC-001]
  - id: anno002
    type: element
    scope_id: pos-sms-login
    target:
      app: pos
      route: /login
      element_id: login.sms.entry
    title: 短信验证码登录入口
    acceptance_criteria: [AC-002]
```

标注属于需求，target.app 只说明展示位置，不形成端目录。使用稳定 data-prototype-id 或 SDK 语义 ID；同一 App 渲染范围不允许歧义重复，不要求不同 App 的同名元素全局互斥。

每条标注通过 scope_id 关联评审范围，目标页面、状态和元素必须位于该范围；旁栏 note 即使没有元素目标也必须关联范围，仅在对应范围内展示。需求评审默认只显示当前需求标注，不叠加其他需求的标注。范围缺失、区域不存在或标注越界时明确诊断，不能静默扩大范围或随机匹配。

支持 element、note、walkthrough、change 等版本化类型。旁栏 note 无元素目标时不强制 element_id。标注不能作为业务规则唯一来源，验收点必须存在于绑定 PRD。

定位检查报告需求、App、元素、路由、场景和固定构建。缺失、歧义、不可见均明确显示；坐标只能是标明可靠性的辅助，不能把错误定位当成功。当前新需求明确删除旧交互时，可以报告历史标注失效，不应为保留旧标注阻止该业务变更。

### 5.3 场景与跨应用演示

```yaml
# scenarios.yaml
schema_version: 1
scenarios:
  - id: sms-login-enabled
    description: 后台开启短信登录后的展示状态
    app_states:
      admin:
        sms_login_enabled: true
      pos:
        sms_login_enabled: true
        mock_code: "123456"
```

```yaml
# walkthrough.yaml
schema_version: 1
steps:
  - id: step001
    action: select_scenario
    scenario: sms-login-enabled
  - id: step002
    app: admin
    route: /settings
    action: highlight
    target: login.sms.enabled
    annotation: anno001
    acceptance_criteria: [AC-001]
  - id: step003
    app: pos
    route: /login
    action: highlight
    target: login.sms.entry
    annotation: anno002
    acceptance_criteria: [AC-002]
```

场景、标注和步骤 ID 在需求包内唯一。先初始化场景，再切换应用、导航和定位；跨应用场景初始化覆盖其声明的应用状态。需展示操作联动时，由项目模拟状态或受控 SDK 消息更新状态，不依赖真实业务后端。步骤失败显示具体 ID、原因和可重试动作，不静默跳过。

初始化重置上一次演示数据，固定必要时间、随机种子和 Mock 响应。动作由 Schema 白名单解释，不将 YAML 当任意脚本执行。历史标注、场景、步骤及 SDK 固定在原型包内，修改形成新修订，不覆盖已验收快照。

## 6. 功能开发与独立集成候选

### 6.1 正常需求开发

新增二维码登录、短信验证码登录等功能必须创建需求，通过同名需求分支修改。开发预览可以随分支变化，但不能更新正式入口或作为最终验收依据。复用已有原型能力，不为每个需求复制整套源码。

AI 普通功能开发在需求分支；集成冲突修复在本次隔离候选工作区。两种情况均不得直接修改 main，也不能由 Agent 自行签发人工验收。

### 6.2 集成与冲突处理

1. 准备验收时冻结批准 PRD、需求源 HEAD 和最新目标 main SHA。
2. 从目标 SHA 创建新的 integration/{requirement_id}/{attempt_id} 临时候选分支和隔离工作区。
3. 合入冻结的需求提交。无冲突也必须测试，不能把 Git 成功当作业务正确。
4. 简单代码冲突由 AI 尝试解决，保留原冲突、处理差异、依据和影响报告；限制尝试次数、时间及修改范围。
5. 无法解决、规则互斥或业务含义不明确时进入 awaiting_manual_resolution，保存现场并交给人工。
6. 人工可以给出明确业务取舍后让 AI 继续，也可直接在该候选隔离工作区修改；需保留实际处理者和差异。
7. 处理完成后提交候选、执行测试、构建完整原型并生成固定预览，人工判断整体效果。

候选处理中允许新增修复提交；一旦进入可验收预览，candidate_commit 与产物冻结。再有修改则创建新尝试或候选修订，保留旧记录，重新测试和确认。不得反复覆盖同一已供审查的预览。

冲突处理不得覆盖原需求分支。AI 不能通过删除测试、禁用功能或忽略错误消除冲突；旧能力仍有效时保留，当前需求明确替换旧行为时按新要求执行。无法确定由人决定。

候选驳回后保留报告和已确认决策，再修订需求分支、生成新候选；可参考旧修复，不机械复制整个候选。默认一次需求修订对应一个主要候选 MR，保留未来多 Change 关系，不将需求与 MR 永久绑定为一对一。

### 6.3 登录需求示例

```text
main@v0.0.1：账号密码登录
├─ reqqr001：二维码登录需求分支
└─ reqsms001：短信登录需求分支

二维码需求 → 候选 → 测试与人工确认 → 合并候选 → v0.0.2
短信需求 → 从 v0.0.2 的 main 创建新候选 → 合入短信需求
         → AI/人工解决冲突 → 测试与预览 → 人工确认
         → 合并候选 → v0.0.3
```

版本号仅用于说明；不要求每次合并都创建正式 Tag。短信候选应同时保留仍有效的账号密码和二维码登录，并新增短信流程。最后合并的是已确认候选，包括其中的冲突修复，不是再合并一次原短信分支。

## 7. 整体构建、预览与演示验证

每次需要构建的候选统一构建项目全部已注册应用，收集为一个完整静态包。应用构建命令只是内部步骤，不产生独立发布或验收单元。首版不实现逐 App 产物复用、独立晋级或单端发布。

```text
项目构建包/
├─ index.html                     # 项目/需求展示入口
├─ apps/
│  ├─ pos/
│  └─ admin/
├─ requirements/                  # 运行标注、场景和演示所需资产
└─ build-manifest.json            # 固定应用入口、源码和资源摘要
```

build_id 指向完整包，记录 candidate_commit、项目配置、依赖与工具链信息、需求包摘要、SDK 版本及内容摘要。可对包内文件计算摘要用于校验，但不维护独立 App 发布版本。相同完整包摘要可以共用归档，构建执行来源单独记录。

所有资源和模拟数据包含在包内，不引用会被覆盖的共享运行资源。部署前验证固定子路径、深层刷新、懒加载、图片和脚本引用。预览与正式入口解析到同一固定产物地址，不能为了修改 base path 重新打包后沿用旧批准。

展示与演示验证范围：

- 配置、需求包、PRD 验收点和应用引用有效。
- 全部注册应用构建成功，入口及必要资源可访问。
- 本需求场景和关键既有场景能够初始化并完成模拟交互。
- 同一需求的跨应用演示、语义标注、步骤顺序和必要视觉状态正确。
- 评审页面、区域和状态引用有效；范围内及辅助流程正常，范围外导航被阻止，明确退出评审后可完整浏览。
- 无真实支付、短信认证、设备及生产接口调用；模拟动作有确定结果。
- 按变化运行必要类型检查、单元测试和浏览器回归，不把原型验证扩展成真实业务后端或终端认证测试。

正式候选仍需人工判断业务表达和展示效果，自动测试通过不能替代验收。只有文档或验收记录变化时，不重建未变原型。开发分支无原型或演示变化时不制造新预览，失败补发不能被路径过滤漏掉。

## 8. 需求入口与固定演示版本

统一入口：`/workspaces/{workspace_id}/projects/{project_id}/requirements/{requirement_id}`。

| 视图 | 内容 |
| --- | --- |
| 开发预览 | 需求分支最新有效构建，可变，明确不是最终验收依据 |
| 待验收 | 指定 attempt_id 的固定完整项目包 |
| 历史验收 | 指定 snapshot_id 的原始包、标注、场景和演示步骤 |
| 当前产品 | 当前成功发布的完整项目包，按需展示该需求的标注 |
| 需求差异 | 实际 target_main_sha 与 candidate_commit 的业务变化清单，必要时辅以截图 |

应用切换菜单来自所选包内的项目配置，需求入口可突出受影响应用，不按端拆成多个需求页面。差异不默认比较需求最初 origin_commit，否则会混入其他并行需求。

### 8.1 需求评审模式与范围约束

需求开发预览、待验收和历史验收入口默认进入需求评审模式。旁栏按 review_scope 列出重点页面及关联验收点，辅助页面单独标记为“流程辅助”。选择条目时先恢复声明的场景，再导航到允许的页面和状态，滚动并高亮关注区域。可弱化其他区域并提供“查看完整页面”；该动作只取消视觉弱化，不解除评审范围约束，也不切换构建版本。

评审采用“限定浏览＋明确退出”，不只过滤外层菜单。应用统一导航层与页面/状态进入守卫共同执行当前需求范围检查：

| 操作 | 评审模式下的行为 |
| --- | --- |
| 进入已声明的重点页面或状态 | 正常进入，显示对应标注与关注区域 |
| 进入已声明的辅助页面或状态 | 正常进入，明确标为流程辅助 |
| 点击链接、按钮进入范围外页面或状态 | 阻止跳转并保留当前页面与模拟数据，提示“该页面不在本次评审范围” |
| 自动重定向、模拟登录后跳转、跨应用切换 | 使用相同检查，不能绕过范围 |
| 浏览器前进、后退或直接访问评审会话内的地址 | 在路由进入时检查；越界则恢复最近允许位置，无有效位置时返回需求评审入口 |
| 普通链接、新窗口或外部地址 | 同样检查；范围内新窗口须继承固定版本与评审上下文，无法继承或目标越界则阻止打开 |
| 用户主动选择“退出评审，浏览完整产品” | 明确退出后解除范围约束，保留当前固定完整包，并持续显示完整产品浏览状态 |

范围外操作提示提供“留在评审”和“退出评审，浏览完整产品”，不得自动放行，也不得静默扩大 review_scope。完整浏览中提供返回需求评审入口；返回时恢复范围约束并进入允许的页面和状态。关闭弹窗、选择数据等必要页内操作不因处于非高亮区域而被一律禁用；若操作会进入其他功能状态，仍须检查 states。

例如短信登录评审允许“后台短信设置 → POS 短信登录 → 登录成功首页（辅助）”，登录成功跳转正常执行；点击库存管理则留在当前页，只有明确退出评审后才可浏览。必需流程被阻止时，报告范围配置缺口，由需求修订补齐并重新验证，不能在运行时自动添加允许页面。

所有应用接入同一版本化 SDK 导航约定，覆盖应用路由、普通链接、新窗口、跨应用消息及语义状态切换；不能仅靠外层 iframe 或鼠标点击拦截宣称范围约束成立。评审约束用于聚焦需求，不替代 Workspace/Project 访问权限。

### 8.2 固定版本与 SDK

一次打开候选或快照后，整个演示会话固定 build_id/snapshot_id。当前产品入口也只在打开时解析 current，随后切换应用沿用同一个完整包；显式刷新至新版本时提示版本变化。不在每次应用切换时重新读取 current。

当前包无法定位旧标注时显示失效或目标已删除；历史包保持原样。历史定位按其包内配置，不能因当前应用列表改变而丢失旧入口。历史默认展示最近一次已成功发布的验收修订，尚待发布的已验收候选另列；未验收需求明确显示待验收。

原型使用版本化浏览器 SDK，支持场景初始化、应用切换、语义定位和演示步骤。外层与 iframe 之间采用含消息类型、requestId、schemaVersion 的协议，检查来源窗口、Origin、目标 Origin、格式和权限，配置 CSP/frame-ancestors。应用的模拟业务状态由受控场景接口处理。

未来 SDK 演进不能改写旧产物。不支持某命令时显示原始页面与旁栏说明，明确能力不可用，不伪造成功；这用于新平台自身历史回放，不引入旧项目结构兼容。

## 9. 人工验收与受控合并

验收单位是一个需求修订及其完整候选原型，按 PRD 验收条件逐项记录结果。条件可涉及多个应用，但没有独立的 App 批准状态或以可选端绕过需求的开关。

顺序：

1. 固定候选完成测试，完整产物已可靠保存且可访问。
2. 用户查看需求、固定候选、场景、标注、演示步骤及适用的冲突报告。
3. 真实登录验收者确认具体候选；平台保存不可变验收快照及受控批准记录。
4. 记录写入需求资料仓库成功后，才允许进入合并门禁；缓存或内存批准不够。
5. 校验通过后将候选分支通过 MR 合入 main，追加合并记录，随后整体发布。

每次最终检查与合并按 Project 串行，全部常规 main 更新经过同一受控入口。检查源 HEAD、目标 main、候选、批准 PRD 内容修订、测试、需求包和快照一致，且没有待人工处理事项。实际合并必须拒绝过期结果，不能先读取 main 后无条件提交合并。

采用 fast-forward 合并，禁用 squash 和验收后 rebase，使 main 指向已验收 candidate_commit。平台合并身份与开发 Agent 分离；main 受保护，可信检查和合并权限不能由普通候选改写。

源或目标、候选、批准 PRD、需求范围、标注、场景、演示依据发生变化时，旧批准不授权新结果。新尝试重测并重新确认受影响内容，保留旧记录。验收记录自身新增元数据不算 PRD 内容变化：批准引用精确 PRD 提交，并核对被批准文件及其明确依赖的内容，而不是要求资料仓库整个 HEAD 永远不变。

GitLab 版本、许可证、保护分支及合并 API 能力在环境核验时验证。不假定普通 MR approval 等于强制门禁。只能人工受控合并时明确标为流程门禁及自动化未完成，不宣称自动闭环通过。

## 10. 验收快照、合并与发布记录

### 10.1 验收快照

```yaml
snapshot_id: snap-req001-001
workspace_id: team-a
project_id: retail
requirement_id: req001
requirement_revision: 1
attempt_id: int-req001-001
prd:
  repository: retail-requirements
  path: requirements/req001/prd.md
  commit: <完整SHA>
prototype_repository: retail-prototype
source_head_sha: <完整SHA>
target_main_sha: <完整SHA>
candidate_commit: <完整SHA>
build_id: build-001
artifact_sha256: <完整项目包摘要>
prototype_config_digest: <配置摘要>
requirement_package_digest: <统一需求包摘要>
sdk_version: <版本>
acceptance_record_id: acc-req001-001
```

批准记录保存真实确认者、时间、逐验收条件结果及快照 ID。快照在合并前即可成立，不包含尚未发生的合并和发布事实。快照内容不可变，新增修订或撤销以追加记录表达，不覆盖过去记录。

### 10.2 后续执行记录

```yaml
integration_record:
  id: merge-001
  snapshot_id: snap-req001-001
  gitlab_project_id: 123
  mr_iid: 45
  merged_commit: <实际合并SHA>
  merged_at: <实际时间>
release_record:
  id: release-001
  integration_record_id: merge-001
  snapshot_id: snap-req001-001
  build_id: build-001
  status: published
  published_at: <实际时间>
  baseline_tag: null
```

合并结果和发布结果分别登记、追加关联，不回写验收快照。MR 使用 GitLab 项目与 IID 联合定位；执行记录的状态变化保留审计事件。

origin_commit 为创建需求时主线，永不覆盖；working_base_commit 只表示需求分支实际吸收的基线；merged_commit 表示实际合入事实；正式 baseline_tag 可按发布节奏创建，不要求一需求一 Tag。需求首次进入正式 Tag 的关联一旦登记不随以后发布改写。

运行状态分开表达：候选 awaiting_acceptance/approved/rejected/stale；冲突 awaiting_manual_resolution；合并 pending/merged/failed；发布 pending/published/failed。失败注明阶段，不因发布失败抹掉已经发生的验收和合并事实。

## 11. 整体发布、失败恢复与回滚

候选验收后，整体晋级同一个完整包：取得项目发布锁，检查合并与批准依据，校验归档和固定入口，验证页面及资源，原子切换项目 current 指针，检查访问并登记发布结果。已经打开的演示继续使用原固定包。

项目包缺文件、任何应用构建或验证失败，都不发布半套原型。应用间没有独立晋级路径。旧流水线不得覆盖新成功版本，重试幂等，不重复制造验收快照或正式发布事实。

合并成功但发布失败时，保留旧 current、已确认快照和合并记录，标明发布待重试；不得标记完整交付，也不自动撤销源码。切换后检查失败恢复上一指针。需求文档发布和原型发布是跨仓操作，分别报告结果、补发缺口，不能伪装原子跨仓事务。

回滚以整个项目包为单位，只改变展示入口，不修改 Git 历史和验收快照。若后续开发应恢复旧行为，需要在源码中撤销相关变更并重新走需求/候选流程；不提供单 App 回滚，也不承诺整体回滚只影响一个需求。

文档按需求增量发布，只修改文档或登记验收不会重发未变原型。临时构建目录不提交源码仓库。目录或登记删除仅报告待处理，不自动清空线上内容。

## 12. 历史归档与清理

保存三类对象：受控验收和执行索引、不可变完整项目包、可回收在线缓存。历史引用关联完整 build_id，不按 App 分拆归档。相同完整内容摘要可去重，首版不做文件块级去重或复杂冷热存储平台。

历史包包含所有应用静态资源、项目配置、需求标注、场景、演示步骤、SDK 和模拟数据。只保存 Git 源码或截图不算满足可交互历史回放。

在线缓存缺失时，授权查询、按 build_id 加恢复锁、校验摘要、安全解压、原子进入只读缓存，返回同一固定入口。页面展示恢复进度、失败和重试；损坏时不能回退到最新版冒充历史，也不从当前源码静默重建。

当前版本、验收引用版本、明确留存的评审版本及被文档引用的包必须可恢复。定期校验、备份元数据与完整产物并演练恢复。缓存可按期限清理，但被引用的最后一份归档不得由普通清理任务删除。

临时需求分支和候选分支仅在整体发布、历史入口验证完成且无新增未交付内容后清理。纯文档需求按第 4 节不适用流程结束。归档需求不释放 ID，删除分支不删除历史记录。

## 13. 平台接口、权限与执行边界

采用模块化服务，职责包括 Workspace/Project 登记、应用配置解析、需求同步、候选集成、冲突执行、完整包构建预览、需求验收、整体发布和历史恢复，不拆成多个独立服务作为首版前置条件。

建议接口：

```text
GET  /api/workspaces/{workspaceId}/projects
GET  /api/projects/{projectId}/apps
POST /api/projects/{projectId}/requirements/sync
GET  /api/projects/{projectId}/requirements/{requirementId}
POST /api/projects/{projectId}/requirements/{requirementId}/integrations
GET  /api/integrations/{attemptId}
POST /api/integrations/{attemptId}/acceptance
POST /api/integrations/{attemptId}/merge
GET  /api/projects/{projectId}/requirements/{requirementId}/views
GET  /api/snapshots/{snapshotId}
POST /api/snapshots/{snapshotId}/restore
```

所有操作校验 Workspace/Project 权限，不能仅凭知道全局 ID 就访问；POST 幂等或支持幂等键。验收身份来自真实会话，服务签发受控记录，不接受伪造审核人。Agent 不持有 main 直接推送或验收签发权限。

建议实体为 workspaces、projects、requirements、prototype_changes、integration_attempts、prototype_builds、acceptance_records、snapshots、integration_records、release_records、archives、audit_events、webhook_events。App 是配置中的展示项，不引入单端批准或单端发布表。

Plane 事件验证来源、去重和重试，必要时轮询与对账；不能假定实例支持尚未验证的 Webhook 或字段。只同步指针与状态摘要，PRD 和验收内容分别保留自己的权威来源。

普通开发工作区与冲突工作区均隔离，构建和预览只用模拟数据，部署凭据不暴露给候选脚本。GitLab 仓库权限不等于静态页面权限，预览和历史访问需独立校验。

## 14. 分阶段实施

| 阶段 | 工作与完成定义 |
| --- | --- |
| P0 环境核验 | 确定 Workspace/Project 映射、新项目双仓库、GitLab/Plane 能力、Runner、身份、Nginx 和归档；产出现状与差异，不执行旧项目迁移 |
| P1 新结构与自动分支 | 建立至少两个静态展示应用、配置及统一需求包；幂等创建同名分支，空分支不构建；完整项目包可预览 |
| P2 场景与演示 | 统一需求评审范围、标注、场景、跨应用 walkthrough；固定包内限定浏览，明确退出后可完整浏览，定位和模拟交互可验证 |
| P3 候选与验收发布 | 先无冲突跑通固定候选、完整包、验收记录、fast-forward 合并和整体发布，再接入 AI 冲突修复及人工接管 |
| P4 历史与恢复 | 完善历史入口、缓存恢复、引用保护、备份与演练；删除临时分支后仍可回放 |
| 后续可选 | 业务差异可视化、影响分析、自动编排等，按实际需求另行确定 |

P3 首个正式验收闭环就必须可靠保存完整产物和验收记录，不能等到 P4 才保留历史；P4 完善访问与运维。新建未预设 App 只需配置和该应用源码，平台核心不添加业务端名分支。

已有目标服务器信息为私网 10.94.164.176，仅作待核验实例配置，不是平台常量。先检查实际 GitLab 版本、许可证、分支与 MR API、保护规则、Runner、Plane 接口、域名、页面权限、空间及备份，不能把曾可用当作本次已验证。

本方案直接面向新项目和新结构，不建设旧目录、旧地址或旧数据兼容层。确有旧资料导入需求时单独立项，由用户明确输入、目标和验收依据，AI 可以辅助迁移；不将迁移作为当前阶段前置工作，也不自动删除旧资料。

## 15. 验收剧本与完成标准

### 15.1 并行登录需求及冲突

1. 初始项目 v0.0.1 只支持账号密码登录；创建 reqqr001 和 reqsms001，均记录同一 origin_commit。
2. 二维码需求在自己的分支修改，生成候选，经测试和人工确认后整体发布 v0.0.2。
3. 从最新 main 为短信需求创建临时集成分支，合入旧基线开发的短信改动。
4. 分别验证无冲突、AI 能处理的简单冲突、必须人工解决的冲突；都不修改原需求分支或 main。
5. 人工处理后仍重新测试、预览并确认，最终合并已确认候选，发布同一完整包 v0.0.3。
6. v0.0.3 保留仍有效的三种登录方式；二维码需求历史仍显示其原验收版本。

### 15.2 一个需求跨多个展示入口

1. 一个需求同时涉及后台设置与 POS 登录，统一写入该需求四类 YAML，不创建端目录。
2. 在同一候选中从后台演示切换到 POS，展示状态与标注对应正确。
3. 演示期间发布新的 current，原会话仍使用原完整包，显式打开新版才切换。
4. 按同一 PRD 的验收条件整体确认，不新增逐 App 审批或独立发布步骤。
5. 需求入口默认只列重点页面与明确标记的辅助页面；点击后进入对应场景和状态，高亮关注区域，仅显示当前需求标注。
6. 后台短信设置、POS 短信登录及已声明的登录成功首页可顺畅演示；点击库存管理等范围外功能时保持当前页及模拟数据，显示范围提示。
7. 分别检查应用路由、普通链接、自动重定向、跨应用跳转、新窗口、前进后退和直接访问评审地址，范围外目标均不能绕过约束；同一路由下未声明的其他功能 Tab 或弹窗状态也不能进入。
8. “查看完整页面”仅取消视觉弱化，范围限制仍有效；区域外必要操作可用。明确选择“退出评审，浏览完整产品”后可自由浏览同一固定包，返回需求评审后重新启用范围约束。
9. 缺少必需辅助页面或状态时明确报告配置缺口，不自动扩大范围；范围、标注及验收点引用可验证，历史回放使用原包内范围。

### 15.3 失败与历史保护

| 条件 | 预期结果 |
| --- | --- |
| 重复需求事件或部分创建失败 | 幂等重试，不覆盖未知分支，不丢失原始来源 |
| 大量闲置需求 | 不为每个分支构建或运行独立服务 |
| PRD、源、目标或候选在验收后变化 | 旧批准不授权新结果，创建新尝试重新验证 |
| 两个候选并发合并 | 项目门禁拒绝过期候选，无检查后无条件合并窗口 |
| AI 无法解决冲突 | 保存现场，进入人工处理；人工解决后仍需测试与预览确认 |
| 验收记录保存失败 | 不允许合并，不用缓存批准冒充持久记录 |
| 一个应用构建失败 | 完整包不发布，不产生部分新版 |
| 合并成功但发布失败 | 旧 current 可用，验收和合并事实保留，发布幂等重试 |
| 旧发布任务晚完成 | 不覆盖较新成功版本 |
| 保存验收记录或只改文档 | 不重建未变完整原型 |
| 删除分支、在线缓存 | 历史完整包、标注和演示仍可恢复 |
| 当前页面或语义 ID 改变 | 当前标注提示失效，历史不改写、不随机匹配 |
| 缺失引用、重复目标、非法 SDK 消息 | 明确拒绝或诊断，不伪造展示成功 |
| 归档损坏 | 报告错误，不以最新版替代，不删除最后可恢复副本 |
| 纯文档需求 | 原型标记不适用，结束空分支关联，不制造原型验收 |
| Workspace 下不同 Project 更新 | 各自仓库、候选和发布独立，不因对方 main 更新而失效 |

完成要求：满足对应业务验收点，展示与演示测试可复现，来源 SHA 和完整产物摘要可追溯，文档、配置与测试保持一致。分别报告实现完成、自动验证通过、最终业务验收完成；执行记录另区分验收、合并和发布。

本轮文档提交只代表方案整理完成，不代表上述系统能力已开发或部署。

## 16. 技术参考

- [GitLab 合并方式](https://docs.gitlab.com/user/project/merge_requests/methods/)
- [GitLab MR API](https://docs.gitlab.com/api/merge_requests/)
- [GitLab MR approvals](https://docs.gitlab.com/user/project/merge_requests/approvals/)
- [GitLab CI/CD 配置](https://docs.gitlab.com/ci/yaml/)
- [GitLab 部署资源组](https://docs.gitlab.com/ci/resource_groups/)
- [GitLab 部署安全](https://docs.gitlab.com/ci/environments/deployment_safety/)
- [Vite public base path](https://vite.dev/guide/build.html#public-base-path)
- [Nginx 静态服务](https://nginx.org/en/docs/beginners_guide.html)

具体实现按实际部署版本核验；本轮未执行运行环境验证。
