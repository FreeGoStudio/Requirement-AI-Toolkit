# Requirement AI Toolkit

Requirement-AI-Toolkit 是一组面向 Codex 的产品需求工作流 skill。

当前核心 skill 是：

```text
skills/prd
```

`prd` 是短命名，代表 Product Requirement Document / Product Requirement Prototyping Workflow。它用于将原始需求转化为结构化需求交付物，包括：

- 需求澄清问题
- PRD 文档
- BDD 验收标准
- 原型规格说明
- Figma 输出约束
- 最终需求交付物

安装后可以在 Codex 中使用 `$prd` 或“产品需求工具”触发中文 PRD、BDD、流程图和 Figma 原型工作流。

## 工作流阶段

PRD skill 按以下六个阶段运行。各阶段产物会写入同一个需求输出目录；只有到达对应阶段时才创建文件，不会提前生成空白占位文件。

| 阶段 | 目标与主要动作 | 主要产物 | 进入下一阶段的条件 |
| --- | --- | --- | --- |
| 1. 原始需求接收 | 复述目标、受众、角色和产品端形态，识别未解决假设并提出业务规则、状态、权限、异常和成功标准等澄清问题。 | `00-raw-requirement.md`、`01-clarification-questions.md` | 用户回答必要的澄清问题。 |
| 2. 业务收敛 | 将用户回答整理为业务对象、对象关系、状态流转、主流程、异常流程和开放风险。 | `02-business-model.md` | 用户明确确认业务模型。 |
| 3. 低保真原型 | 执行原型参考 gate，读取 workspace 的 `Knowledge`、manifest 和实际截图，形成界面基线与来源追踪，再生成低保真规格并调用 Figma。 | `02-reference-decision.md`、`03-interface-baseline.json`、`04-low-fidelity-prototype-spec.json` | 参考决策已完成、知识库与截图检查通过、Figma preflight 成功并生成可验证的低保真原型。 |
| 4. 原型反查 | 截取完整低保真 frame，与界面基线对照检查壳层、导航、内容区、弹窗关系、信息密度和 `mustPreserve`，发现问题后先修正再复查。 | `05-low-fidelity-structure-review.md` | 关键结构检查全部通过，并由用户确认低保真原型或给出修正意见。 |
| 5. 需求产物 | 基于已确认的业务模型和低保真反馈，生成可评审的中文 PRD、Mermaid 流程图和中文 BDD 验收场景。 | `06-prd.md`、`07-flowchart.mmd`、`08-bdd.feature` | 用户完成 PRD/BDD 评审，并明确批准进入高保真阶段。 |
| 6. 高保真原型 | 再次执行参考 gate；使用参考图、既有高保真页面、设计系统或品牌规范生成高保真规格与 Figma 原型，并完成视觉检查。 | 更新后的 `02-reference-decision.md`、`09-high-fidelity-prototype-spec.json`、`10-high-fidelity-review.md` | 具备有效视觉来源，或用户明确接受无视觉参考风险；高保真生成和检查完成。 |

### Gate 与 Hard Stop

该工作流不是一次性生成全部文件。以下关键节点必须等待用户明确确认：

- 澄清问题回答完成后，确认业务模型。
- 业务模型确认后，才可生成低保真原型。
- 没有既有原型或视觉参考时，用户需要提供参考，或明确确认无参考继续。
- 低保真反查通过后，才可生成 PRD、流程图和 BDD。
- PRD/BDD 评审通过后，才可生成高保真原型。

当必要回答、参考决策、知识库、实际截图检查、Figma 工具或截图校验能力缺失时，skill 会执行 hard stop：保存当前阶段已经完成的产物，说明阻塞原因并停止，不生成后续阶段文件，也不虚构 Figma 结果。

默认输出目录为：

```text
<workspace-root>\outputs\product-requirements\<yyyyMMdd-HHmm>-<short-requirement-slug>\
```

同一需求任务的后续阶段复用该目录，并通过 `index.md` 记录当前阶段、Figma 状态和已生成产物。用户明确指定输出目录时，使用用户指定路径。

## 知识库目录

PRD skill 只从 Codex 当前 workspace 根目录下的 `Knowledge` 读取项目知识库：

```text
<workspace-root>\Knowledge\
├─ manifests\
│  └─ POS\
│     └─ screens.json
└─ screenshot\
   └─ POS\
      └─ *.png
```

`manifests\POS\screens.json` 和 `screenshot\POS` 必须同时存在。任一项缺失时，知识库解析状态为 `blocked`；skill 不会读取用户指定目录、环境变量、安装目录或 fallback 目录。

在业务 workspace 根目录中解析知识库：

```powershell
.\skills\prd\scripts\Resolve-KnowledgeBase.ps1 `
  -ProductId POS `
  -WorkspaceRoot "<workspace-root>"
```

维护截图后，同步 manifest 中的自动元数据：

```powershell
.\skills\prd\scripts\Sync-ScreenshotManifest.ps1 `
  -KnowledgeRoot "<workspace-root>\Knowledge" `
  -ManifestPath "manifests\POS\screens.json"
```

校验 manifest、截图文件和图片尺寸：

```powershell
.\skills\prd\scripts\Test-ScreenshotManifest.ps1 `
  -KnowledgeRoot "<workspace-root>\Knowledge" `
  -ManifestPath "manifests\POS\screens.json"
```

修改仓库中的 skill 后，需要重新运行安装脚本，并新开一个 Codex 任务使新规则生效：

```powershell
.\scripts\install-skill.ps1 -SkillName prd
```

## 推荐安装方式

在 PowerShell 中执行：

```powershell
iwr -UseB https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/main/scripts/install-from-git.ps1 | iex
```

脚本会自动：

- 从 GitHub 下载或更新仓库到临时目录。
- 调用本仓库的通用本地安装脚本。
- 安装 `prd` skill。
- 如已有旧版本，默认先备份再安装。

安装完成后，建议新开一个 Codex 线程测试：

```text
Use $prd.
```

或直接说：

```text
使用产品需求工具
```

## 指定 Git 地址或分支

如果使用 fork 或私有仓库，可以先下载脚本再传参数：

```powershell
$script = "$env:TEMP\install-requirement-ai-toolkit.ps1"
iwr -UseB https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/main/scripts/install-from-git.ps1 -OutFile $script
powershell -ExecutionPolicy Bypass -File $script -RepoUrl "https://github.com/your-org/Requirement-AI-Toolkit.git" -Branch "main"
```

如果不想备份旧版本，直接覆盖安装：

```powershell
powershell -ExecutionPolicy Bypass -File $script -NoBackup
```

## 本地安装方式

如果已经 clone 了仓库，也可以直接运行：

```powershell
.\scripts\install-skill.ps1 -SkillName prd
```

默认安装到 `%USERPROFILE%\.codex\skills`。如设置了 `CODEX_HOME`，则安装到 `$env:CODEX_HOME\skills`。
