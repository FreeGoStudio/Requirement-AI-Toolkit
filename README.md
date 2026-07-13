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
