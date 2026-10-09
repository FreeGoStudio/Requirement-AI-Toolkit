# 缺项时才读的配置步骤

## 基础软件与 prd

缺软件时引导安装 [Figma Desktop](https://www.figma.com/downloads/)、[Node.js 受支持的 LTS](https://nodejs.org/en/download) 和在线安装所需的 [Git](https://git-scm.com/downloads)。安装后重新打开 Codex，让新 PATH 生效。登录和账号操作由用户完成。

有本工具库 checkout 时，先检查安装脚本，再从仓库根目录运行：

```powershell
.\scripts\install-skill.ps1 -SkillName prd
```

没有 checkout 时，从 [Requirement-AI-Toolkit](https://github.com/FreeGoStudio/Requirement-AI-Toolkit) 下载到独立目录，检查 `scripts/install-skill.ps1` 后安装。不要为安装而重置用户已有仓库。安装后新开 Codex 聊天加载技能。

项目未建立时，让用户将业务文件夹添加为 Codex 项目；已有项目复用。环境验收不要求先准备业务知识库。

## 本地 MCP

优先复用能通过验收的版本。原快速上手文档使用 `1.40.9` 作为复现版本，并非“最新版”；新装或升级时核对 [Figma Console MCP 上游说明](https://github.com/southleft/figma-console-mcp) 的版本、Node 要求与插件路径，再在测试文件验收。

在 Codex 的 MCP 设置中添加本地 STDIO 服务，或备份实际生效的用户配置后仅修改同名段。配置文件通常为 `$CODEX_HOME/config.toml`，未设置时为 `%USERPROFILE%\.codex\config.toml`。保留其他服务和用户设置，不重复追加表。

以下为原文的固定版本示例：

```toml
[mcp_servers.figma-console]
command = "npx"
args = ["-y", "figma-console-mcp@1.40.9"]
[mcp_servers.figma-console.env]
FIGMA_ACCESS_TOKEN = "REPLACE_WITH_YOUR_FIGMA_TOKEN"
```

用户在 Figma 账号设置的 Personal access tokens 中创建本人 token，文件读取需要 File content Read，其他权限按实际功能核对。让用户在本机私密填写，不能要求粘贴到聊天、写入仓库或显示在日志。保留已有效配置的 token；占位值未替换时报告未完成。

配置方式依据 [Codex MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。遇到平台差异先查实际启动错误，不盲目替换命令。

## Desktop Bridge

1. 重新加载 MCP（必要时重启 Codex），确认服务启动成功。
2. 在 Figma Desktop 打开测试文件，进入 Plugins → Development → Import plugin from manifest。
3. 原文版本的 manifest 位于 `%USERPROFILE%\.figma-console-mcp\plugin\manifest.json`；先检查文件存在，若版本不同则采用服务输出或上游记录的实际路径。
4. 运行 Figma Desktop Bridge 并保持开启，回到主流程验收。端口自动选择，不固定改成 9223。
