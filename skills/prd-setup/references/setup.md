# 首次配置与缺项补齐

## 1. Figma Desktop

先检查是否安装；常见位置为 `%LOCALAPPDATA%\Figma`，但路径不存在不能排除其他安装位置。结合 Windows 卸载注册表中的 Figma 记录、实际可执行文件或用户提供的路径判断，不只查进程。

未安装时，让用户打开 [Figma 下载页](https://www.figma.com/downloads/)，选择适合电脑架构的 Desktop app for Windows，完成安装并登录。确认能打开桌面版后继续。

## 2. Node.js 和 npm

让用户打开 [Node.js 下载页](https://nodejs.org/en/download)，选择受支持的 LTS、Windows 安装包，保留 npm package manager 和 PATH 安装项；npm 随此安装包一起安装。

完成后在新终端检查 `node --version`、`npm --version`、`npx --version`。如 PowerShell 仅阻止 npm/npx 的 `.ps1` 启动脚本，尝试 `npm.cmd --version`、`npx.cmd --version`，不因此要求重装或放宽全局执行策略。PATH 尚未刷新时重开 Codex 后复查。

## 3. 从 Figma 获取 token

按 [Figma 官方步骤](https://developers.figma.com/docs/rest-api/personal-access-tokens/) 引导用户：

1. 登录 Figma，回到文件浏览首页，点击左上角账号菜单 → Settings。
2. 打开 Security → Personal access tokens → Generate new token。
3. 设置名称（若界面要求）、有效期与权限。文件读取选择 File content Read（`file_content:read`）；其他权限按实际功能添加。
4. 点击 Generate token，立即复制并私密保存；该 token 只在生成时提供复制机会。下一步由用户填入本机 MCP 配置的 `FIGMA_ACCESS_TOKEN`。

只需用户确认“已准备好”，不能要求粘贴到聊天、写入仓库或显示在日志。已有有效 token 时复用，无须再生成。

## 4. 安装 prd

在线安装前检查 Git；缺失时引导安装 [Git](https://git-scm.com/downloads) 并重开终端验证。

有本工具库 checkout 时，先检查安装脚本，再从仓库根目录运行：

```powershell
.\scripts\install-skill.ps1 -SkillName prd
```

没有 checkout 时，从 [Requirement-AI-Toolkit](https://github.com/FreeGoStudio/Requirement-AI-Toolkit) 下载到独立目录，检查 `scripts/install-skill.ps1` 后安装。不要为安装而重置用户已有仓库。安装后新开 Codex 聊天加载技能。

项目未建立时，让用户将业务文件夹添加为 Codex 项目；已有项目复用。环境验收不要求先准备业务知识库。

## 5. 本地 MCP

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

让用户将第 3 步准备好的 token 私密填入本机配置。保留已有有效 token；占位值未替换时报告未完成，不启动连接验收。

配置方式依据 [Codex MCP 官方文档](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)。遇到平台差异先查实际启动错误，不盲目替换命令。

## 6. Desktop Bridge

1. 重新加载 MCP（必要时重启 Codex），确认服务启动成功。
2. 在 Figma Desktop 打开测试文件，进入 Plugins → Development → Import plugin from manifest。
3. 原文版本的 manifest 位于 `%USERPROFILE%\.figma-console-mcp\plugin\manifest.json`；先检查文件存在，若版本不同则采用服务输出或上游记录的实际路径。
4. 运行 Figma Desktop Bridge 并保持开启，回到主流程验收。端口自动选择，不固定改成 9223。
