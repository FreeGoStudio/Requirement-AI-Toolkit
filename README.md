# Requirement AI Toolkit

面向 Codex 的中文产品需求工作流技能，生成 Markdown 需求与过程文档、高保真交互原型，支持 GitLab 文档交付。

- `skills/prd`：问题探索、业务方案比较、范围收敛、业务模型、参考分析、PRD/流程图/BDD、视觉方向、设计系统与高模评审。
- `skills/prd-setup`：技能安装、本地 HTML 预览与 Linux 原型发布环境配置。
- `skills/prototype-publish`：独立发布历史 HTML 或 PRD 原型到临时服务器，复用账号、发布 ID 和访问链接。

## 使用与产出

当前 PRD 流程仅生成高保真原型，不兼容旧低保真清单/规格。旧项目会提示迁移；用户可明确要求“请将这个项目迁移到当前 PRD 流程”，由 AI 核对并迁移文档、目录、元数据和链接后验证，不自动转换或绕过检查。

安装后在新聊天输入：

```text
$prd 帮我澄清这个产品需求，并按阶段生成 Markdown 正式 PRD 和可交互的 HTML 原型。
```

AI 会先向产品经理说明并准备独立需求工作目录和分支（Git worktree），继续需求时复用。直接在 GitLab 本地仓库维护：PRD 放入实际 VitePress 源目录，其余 Markdown、原型和依赖放入源目录外的 working/<slug>/，不维护 outputs 副本。所有文件按需提交 GitLab；仅 PRD 在批准后随需求分支合并 main 发布。各需求可并行推进。

原型发布顺序：验证 → 提交并推送源码 → 发布该版本 → 脚本回写 Markdown 标记区和发布记录 → 提交推送记录。固定发布标识随 Git 保存，凭据与运行状态留本机。记录提交不会重复上传原型。

| 阶段 | 交付 | 下一步条件 |
| --- | --- | --- |
| 探索、比较与收敛 | 原始需求、含探索与必要比较的澄清 Markdown、业务模型 Markdown | 必要问题已回答，方案与范围随业务模型确认 |
| 需求文档 | prdPath 对应正式 PRD、07-flowchart.md、08-bdd.md  | PRD/BDD 已批准 |
| 原型参考 | 参考决策、界面基线与清单 | 参考决策明确，入选截图已分析 |
| 视觉方向与设计系统 | 必要时提出一套视觉方向、design-system/ 与评审 Markdown | 方向及设计系统已确认 |
| 高模 | prototypes/high/、高模规格与评审 Markdown | 代码依赖、浏览器交互和视觉检查通过，用户验收 |

探索深度按需求成熟度调整：模糊需求先辨认真实目标与遗漏场景，有实质取舍才比较 2–3 个业务方案；已确认的简单修改直接核对缺口。区分事实、假设、建议与已确认决策，不把候选方案当作新增范围。等待决策只阻止依赖它的正式生成，可以继续独立分析和待确认草案。探索记录复用澄清与业务模型 Markdown，正式需求文档仍在业务模型确认后生成；旧任务不补做历史比较。

高模使用稳定 flowId 与 screenId，每个流程/保真度保留一个正式入口，修复更新原文件。高模复用已批准的 CSS token、组件、组合与模板。浏览器能力缺失时可保存文件及静态检查结果，实际渲染/交互标记待验证，不虚报完成。

## 安装

所有非原型文档使用原生 Markdown；GitLab 交付遵循 [文档交付规范](skills/prd/references/gitlab-delivery.md)，先检查 VitePress 实际源目录与构建约定。全部需求 Markdown 都提交 GitLab：正式 PRD 放入源目录（如 `docs/requirements/<slug>/index.md`），其余 Markdown 放在源目录外（如 `working/<slug>/`）；站点只发布正式 PRD，保留既有导航首页。项目资料保存在本机 `$CODEX_HOME/private/prd-projects.json`（默认 `%USERPROFILE%/.codex/private/prd-projects.json`），不随技能分发。HTML 原型、实际依赖与治理元数据也在 `working/<slug>/` 直接维护并入库；按已推送源码通过 prototype-publish 独立发布。Markdown 使用经验证的原型 URL，不依赖 HTML 链接脚本。

从 GitHub 当前开发分支 `codex/html-prototype-output` 一条命令安装或更新三个技能（需先将该分支的新脚本推送到 GitHub）：

```powershell
& { $ErrorActionPreference = 'Stop'; $f = Join-Path $env:TEMP ('update-requirement-toolkit-' + [guid]::NewGuid().ToString('N') + '.ps1'); Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/codex/html-prototype-output/scripts/update-from-github.ps1' -OutFile $f; & (Get-Process -Id $PID).Path -NoProfile -ExecutionPolicy Bypass -File $f -Branch 'codex/html-prototype-output' }
```

该命令使用当前 PowerShell 进程对应的解释器，从指定分支下载 ZIP，无需 Git；安装 prd（自动安装 prototype-publish）及 prd-setup，默认备份旧技能，不修改服务器配置或初始化服务器。更新后新开 Codex 聊天。GitHub 无法访问时明确失败，原安装保留。发布原型仍需要 PowerShell 7 和 Python 3.10+。

已有本地仓库时安装当前检出版本（本分支修改尚未推送时优先此方式）：

```powershell
./scripts/install-skill.ps1 -SkillName prd
./scripts/install-skill.ps1 -SkillName prd-setup
```

默认安装到 `%USERPROFILE%/.codex/skills`；设置 CODEX_HOME 时安装到其 skills 子目录。已有版本默认先备份，`-NoBackup` 可关闭备份。安装后新开聊天，运行 `$prd-setup` 检查 HTML 预览，日常使用 `$prd`。

安装或更新 `prd` 会先自动安装或更新同版本的 `prototype-publish`，沿用相同的 `CodexHome` 和 `NoBackup` 参数；依赖安装失败时停止，不替换 prd。不会重新配置服务器、安装发布运行时或执行服务器初始化。仅发布历史 HTML 时仍可单独运行 `./scripts/install-skill.ps1 -SkillName prototype-publish`。单独安装 prd-setup 不触发此依赖安装。

从远程安装需要 Git。HTML 分支推送后，可明确指定该分支：

```powershell
$installer = Join-Path $env:TEMP 'install-requirement-ai-toolkit.ps1'
Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/codex/html-prototype-output/scripts/install-from-git.ps1' -OutFile $installer
& $installer -Branch 'codex/html-prototype-output' -SkillName prd
```

安装 prd-setup 时将 SkillName 改为 prd-setup。远程安装器默认 Branch 仍为 main，安装其他分支时必须显式传参。也支持 RepoUrl、CodexHome、InstallRoot 与 NoBackup 参数。

## Linux 原型自动发布

使用管理员已准备好的服务器时，按 [团队成员安装与配置说明](docs/team-prototype-publishing.md) 操作：安装三个技能、配置发布账号及本机运行时，**不执行服务器初始化**。仅发布历史 HTML 时可单独安装 prototype-publish，不依赖 prd。下面的自动准备 Nginx 示例仅用于首次准备新服务器。

需要让同事通过服务器访问时，在新聊天输入：

```text
$prd-setup 配置 Linux 原型发布服务器，自动准备 Nginx；后续原型更新自动发布，只发布原型及其资源。
```

提供服务器地址和用户名，密码通过本机 PowerShell 安全提示输入，不需粘贴到聊天。默认 SSH 端口 22、网站端口 8080、远程目录 `/var/www/_tmp/prototypes`，支持自定义。密码按当前 Windows 用户加密保存在本机配置目录，技能升级不覆盖；首次连接需核对主机指纹。

首次准备服务器需支持 systemd、apt/dnf，并提供 root 或 sudo 权限；团队成员发布无需这些权限。默认发布地址为 `http://服务器地址:端口/_tmp/prototypes/<发布ID>/`，每次更新沿用地址；本地仍保存完整需求交付，服务器仅公开原型及依赖资源。未配置时保持本地流程。已配置但发布失败时明确报错并保留上次成功版本；HTTP 访问与浏览器交互验收分别记录。

配置命令、依赖、限制与故障处理见 [Linux 原型发布说明](skills/prototype-publish/references/remote-publishing.md)。

### 发布历史 HTML

独立发布历史原型时可直接调用：

```text
$prototype-publish 发布 D:\历史原型\订单，入口是 index.html，复用本机已配置的临时服务器，不初始化服务器。
```

历史 HTML 不要求 PRD 清单；指定入口及资源根目录后，仅上传可达页面与依赖资源。现有 PRD 流程继续在检查后调用发布技能，沿用原配置、发布 ID 和临时 URL 前缀。

## 截图知识库

保留工作区截图参考流程：`<workspace-root>/Knowledge/manifests/POS/screens.json` 与 `Knowledge/screenshot/POS/` 同时存在才算知识库可用。不使用安装目录或环境变量作为知识库回退。用户参考优先，任何入选截图必须实际打开分析。无参考时须记录用户明确的继续决定。

```powershell
./skills/prd/scripts/Resolve-KnowledgeBase.ps1 -ProductId POS -WorkspaceRoot '<workspace-root>'
./skills/prd/scripts/Sync-ScreenshotManifest.ps1 -KnowledgeRoot '<workspace-root>/Knowledge' -ManifestPath 'manifests/POS/screens.json'
./skills/prd/scripts/Test-ScreenshotManifest.ps1 -KnowledgeRoot '<workspace-root>/Knowledge' -ManifestPath 'manifests/POS/screens.json'
```

## 校验

```powershell
./skills/prd/tests/Test-DesignGovernance.ps1
./skills/prd/scripts/Test-DesignGovernance.ps1 -ManifestPath '<输出目录>/03-html-design-manifest.json' -PrototypeSpecPath '<输出目录>/12-high-fidelity-prototype-spec.json' -Phase postwrite
```

治理脚本检查路径、流程唯一性、更新策略、参考决策与高模资产批准；postwrite 验证登记文件确实存在。浏览器渲染、链接锚点、交互、响应式、打印以及真实资产复用另按 `skills/prd/references/html-output.md` 验证。静态检查通过不等于最终验收。
