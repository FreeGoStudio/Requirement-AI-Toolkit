# 首次配置与缺项补齐

## 1. Figma Desktop

先检查是否安装；常见位置为 `%LOCALAPPDATA%\Figma`，但路径不存在不能排除其他安装位置。结合 Windows 卸载注册表中的 Figma 记录、实际可执行文件或用户提供的路径判断，不只查进程。

未安装且用户请求安装或完整配置时，自动完成下载和启动安装：

1. 告知将从 [Figma Windows 安装包直链](https://www.figma.com/download/desktop/win) 下载并安装，无需重复请求安装许可。
2. 使用支持重定向的下载工具（如 PowerShell `Invoke-WebRequest -UseBasicParsing -Uri ... -OutFile ...`），下载到本次任务独立临时目录中的 `FigmaSetup.exe`。等待下载成功，检查文件非空且为 Windows 可执行安装包；下载失败或返回网页时不执行文件。
3. 下载完成后用 `Start-Process -FilePath <实际安装包路径> -PassThru -WindowStyle Hidden` 启动安装，不猜测静默参数。分段检查进程和安装状态，保持进度反馈。若出现需要用户操作的安装界面或 UAC，明确告诉用户当前要完成的操作；不要声称已自动完成该交互。
4. 安装进程结束后检查 Figma 可执行文件、安装记录及实际启动结果；不能只凭进程启动成功或安装器退出就报告安装完成。若安装器启动子进程，继续核对安装结果。
5. 安装完成后引导用户打开 Figma Desktop 并登录，再进入 Node.js 和 npm 步骤。已有可用桌面版则复用，不重复下载；用户仅要求检查时只报告状态。

## 2. Node.js 和 npm

先检查 Node.js、npm 和 npx 是否可用；已有可用版本则复用，不强制升级或降级。确需安装且用户请求安装或完整配置时：

1. 检查 Windows 系统架构。此包适用于 x64；其他架构先说明不匹配，再从 [Node.js 官方下载页](https://nodejs.org/en/download) 核对适用包，不强行安装 x64 包。
2. 告知将自动下载安装，从 [Node.js v24.21.0 x64 MSI 直链](https://nodejs.org/dist/v24.21.0/node-v24.21.0-x64.msi) 下载到本次任务独立临时目录。URL 不包含用户粘贴时可能附带的尾部空白。等待下载成功，检查文件非空且为 MSI 安装包；下载失败或返回网页时不执行。
3. 下载完成后用 `Start-Process` 启动 `msiexec.exe`，传入 `/i "<实际 MSI 路径>" /passive /norestart`，使用 `-PassThru -WindowStyle Hidden`；正确引用含空格的路径，保留默认 npm package manager 和 PATH 安装项。分段检查进程，若需用户处理 UAC，明确提示当前操作，不重复索取已授权的安装许可。
4. 检查安装退出码：`0` 后继续验证，`3010` 表示安装完成但需要重启，告知用户且不自动重启；其他退出码报告实际错误。即使退出码成功，也要验证命令可用，不能把安装器启动成功当作完成。用户仅要求检查时只报告状态。

完成后在新终端检查 `node --version`、`npm --version`、`npx --version`。如 PowerShell 仅阻止 npm/npx 的 `.ps1` 启动脚本，尝试 `npm.cmd --version`、`npx.cmd --version`，不因此要求重装或放宽全局执行策略。PATH 尚未刷新时重开 Codex 后复查。

## 3. 安装 prd

在线安装前检查 Git；缺失时引导安装 [Git](https://git-scm.com/downloads) 并重开终端验证。

有本工具库 checkout 时，先检查安装脚本，再从仓库根目录运行：

```powershell
.\scripts\install-skill.ps1 -SkillName prd
```

没有 checkout 时，从 [Requirement-AI-Toolkit](https://github.com/FreeGoStudio/Requirement-AI-Toolkit) 下载到独立目录，检查 `scripts/install-skill.ps1` 后安装。不要为安装而重置用户已有仓库。安装后新开 Codex 聊天加载技能。

项目未建立时，让用户将业务文件夹添加为 Codex 项目；已有项目复用。环境验收不要求先准备业务知识库。

## 4. Figwright MCP

以 [Figwright 上游安装说明](https://github.com/awdr74100/figwright#setup) 和当前工具定义为准。先复用已有服务，首次配置时核对当前 Node.js 要求与插件版本。

在实际生效的客户端 MCP 配置中添加名为 `figwright` 的 STDIO 服务。Codex TOML 配置示例：

```toml
[mcp_servers.figwright]
command = "npx"
args = ["-y", "@figwright/mcp@latest"]
```

只修改对应服务段，保留其他配置。Windows 启动失败时先检查 `Get-Command node,npx,npx.cmd`、客户端 PATH 和实际启动错误，按安装位置使用可执行入口。已有稳定版本直接复用；升级时同时核对服务与插件版本。此连接流程无需配置 Figma personal access token。

## 5. Figwright 插件

1. 从 [Figwright Releases](https://github.com/awdr74100/figwright/releases/latest) 下载插件 zip，解压到稳定目录；以实际发布附件为准，不猜附件名或本机路径。
2. 在 Figma Desktop 首页进入 Drafts，新建 Design 文件并打开画布；已有验收草稿则复用，不选 FigJam、Slides 或 Make。
3. 检查解压目录中的 `manifest.json` 及其引用资源确实存在。把实际所在目录的绝对路径单独放在纯文本代码块，指导用户在文件选择器地址栏粘贴，再选择 `manifest.json`。
4. 在 Figma 菜单 Plugins → Development → Import plugin from manifest 导入；随后 Plugins → Development → Figwright 启动插件。仅导入不算运行，保持插件运行并检查连接状态。
5. 发现并调用 `mcp__figwright__ping`，确认端到端插件连接；再按技能入口执行文件绑定、页面读取和截图验收。工具已可用时不要求重启客户端。
6. 服务/插件版本不兼容时按上游说明更新对应部分，再重复验收。不能仅凭插件显示 Connected 宣布所有读写与截图均通过。
