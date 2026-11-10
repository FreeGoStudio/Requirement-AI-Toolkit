# Requirement AI Toolkit

面向 Codex 的中文产品需求工作流技能，直接生成可在浏览器打开的 HTML 需求文档与低/高保真交互原型。

- `skills/prd`：问题探索、业务方案比较、范围收敛、业务模型、参考分析、低模、PRD/流程图/BDD、视觉方向、设计系统与高模评审。
- `skills/prd-setup`：技能安装、本地 HTML 预览与 Linux 原型发布环境配置。

## 使用与产出

安装后在新聊天输入：

```text
$prd 帮我澄清这个产品需求，并按阶段生成 HTML 需求文档和可交互的 HTML 原型。
```

默认写入 `outputs/product-requirements/<yyyyMMdd-HHmm>-<slug>/`，以 `index.html` 作为交付入口。所有评审文档均为 HTML；规格与清单保留 JSON，流程图与 BDD 同时保留 `.mmd`、`.feature` 源文件。目录整体复制后可本地打开，默认不需要构建、账号、远程服务或 CDN。

| 阶段 | 交付 | 下一步条件 |
| --- | --- | --- |
| 探索、比较与收敛 | 原始需求、含探索与必要比较的澄清 HTML、业务模型 HTML | 必要问题已回答，方案与范围随业务模型确认 |
| 参考与低模 | 参考决策、界面基线、规格、prototypes/low/ | 参考决策明确，实际截图已分析 |
| 低模反查 | 浏览器交互、截图与结构评审 HTML | 关键检查通过，用户确认 |
| 需求文档 | 06-prd.html、07-flowchart.html、08-bdd.html 与源文件 | PRD/BDD 已批准 |
| 视觉方向与设计系统 | 必要的视觉候选、design-system/ 与评审 HTML | 方向及设计系统已确认 |
| 高模 | prototypes/high/、高模规格与评审 HTML | 代码依赖、浏览器交互和视觉检查通过，用户验收 |

探索深度按需求成熟度调整：模糊需求先辨认真实目标与遗漏场景，有实质取舍才比较 2–3 个业务方案；已确认的简单修改直接核对缺口。区分事实、假设、建议与已确认决策，不把候选方案当作新增范围。等待决策只阻止依赖它的正式生成，可以继续独立分析和待确认草案。探索记录复用澄清与业务模型 HTML，正式需求文档仍在低模确认后生成；旧任务不补做历史比较。

低高模共享稳定 flowId 与 screenId，每个流程/保真度保留一个正式入口，修复更新原文件。高模复用已批准的 CSS token、组件、组合与模板。浏览器能力缺失时可保存文件及静态检查结果，实际渲染/交互标记待验证，不虚报完成。

## 安装

已有本地仓库时安装当前检出版本（本分支修改尚未推送时优先此方式）：

```powershell
./scripts/install-skill.ps1 -SkillName prd
./scripts/install-skill.ps1 -SkillName prd-setup
```

默认安装到 `%USERPROFILE%/.codex/skills`；设置 CODEX_HOME 时安装到其 skills 子目录。已有版本默认先备份，`-NoBackup` 可关闭备份。安装后新开聊天，运行 `$prd-setup` 检查 HTML 预览，日常使用 `$prd`。

从远程安装需要 Git。HTML 分支推送后，可明确指定该分支：

```powershell
$installer = Join-Path $env:TEMP 'install-requirement-ai-toolkit.ps1'
Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/FreeGoStudio/Requirement-AI-Toolkit/codex/html-prototype-output/scripts/install-from-git.ps1' -OutFile $installer
& $installer -Branch 'codex/html-prototype-output' -SkillName prd
```

安装 prd-setup 时将 SkillName 改为 prd-setup。远程安装器默认 Branch 仍为 main，安装其他分支时必须显式传参。也支持 RepoUrl、CodexHome、InstallRoot 与 NoBackup 参数。

## Linux 原型自动发布

使用管理员已准备好的服务器时，按 [团队成员安装与配置说明](docs/team-prototype-publishing.md) 操作：安装两个技能、配置发布账号及本机运行时，**不执行服务器初始化**。下面的自动准备 Nginx 示例仅用于首次准备新服务器。

需要让同事通过服务器访问时，在新聊天输入：

```text
$prd-setup 配置 Linux 原型发布服务器，自动准备 Nginx；后续原型更新自动发布，只发布原型及其资源。
```

提供服务器地址和用户名，密码通过本机 PowerShell 安全提示输入，不需粘贴到聊天。默认 SSH 端口 22、网站端口 8080、远程目录 `/var/www/_tmp/prototypes`，支持自定义。密码按当前 Windows 用户加密保存在本机配置目录，技能升级不覆盖；首次连接需核对主机指纹。

首次准备服务器需支持 systemd、apt/dnf，并提供 root 或 sudo 权限；团队成员发布无需这些权限。默认发布地址为 `http://服务器地址:端口/_tmp/prototypes/<发布ID>/`，每次更新沿用地址；本地仍保存完整需求交付，服务器仅公开原型及依赖资源。未配置时保持本地流程。已配置但发布失败时明确报错并保留上次成功版本；HTTP 访问与浏览器交互验收分别记录。

配置命令、依赖、限制与故障处理见 [Linux 原型发布说明](skills/prd/references/remote-publishing.md)。

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
./skills/prd/scripts/Test-DesignGovernance.ps1 -ManifestPath '<输出目录>/03-html-design-manifest.json' -PrototypeSpecPath '<输出目录>/04-low-fidelity-prototype-spec.json' -Phase postwrite
```

治理脚本检查路径、流程唯一性、更新策略、参考决策与高模资产批准；postwrite 验证登记文件确实存在。浏览器渲染、链接锚点、交互、响应式、打印以及真实资产复用另按 `skills/prd/references/html-output.md` 验证。静态检查通过不等于最终验收。
