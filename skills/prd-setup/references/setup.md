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

1. 首次配置先引导创建设计草稿：在 Figma Desktop 回到文件首页，进入当前团队的 **Drafts（草稿）**，点击新建入口并选择 **Design（设计文件 / New design file）**，进入空白画布；不要选择 FigJam、Slides 或 Make。可命名为“PRD 连接验收”，保留 Untitled 也可以。已有本次配置的设计草稿或已连接的 Design 文件时直接复用。创建方式参考 [Figma 官方说明](https://help.figma.com/hc/en-us/articles/360038511153-Create-a-new-file)。
2. 先定位并验证 `manifest.json`：原文版本位于 `%USERPROFILE%\.figma-console-mcp\plugin\manifest.json`，若版本不同则采用服务输出或上游记录的实际路径。文件不存在时先排查，不让用户导入不存在的文件。
3. 将已验证文件的**父文件夹绝对路径**单独放在 `text` 代码块中，使用 Windows 反斜杠，展开环境变量和用户名。代码块只含一行路径，不加引号、命令、占位符或 Markdown 链接；不能只说“上述文件”。
4. 紧接路径给出操作：在刚创建或复用的 **Design 草稿画布**中，选择 Plugins → Development → Import plugin from manifest；在弹出的文件选择窗口按 `Ctrl+L`，粘贴刚才的文件夹路径并回车，选择 `manifest.json`，点击“打开”。
5. 导入后，在 **Plugins & widgets** 的 **Development** 列表中，点击 **Figma Desktop Bridge** 这一行（带 Development 标签、下方显示刚导入的 manifest 路径），启动插件。这里选择已导入的插件，不选 New plugin、New widget 或再次 Import from manifest；不能只笼统写“运行 Bridge”。若列表已关闭，重新打开 Plugins → Development，选择 Figma Desktop Bridge。
6. 等待 Bridge 插件窗口打开并保持开启，再回到 Codex 继续连接验收。列表中出现插件只表示导入成功，不代表插件已经运行或连接已通过。端口自动选择，不固定改成 9223。
7. 工具已加载时直接对当前草稿做页面读取和截图验收。仅在新增 MCP 尚未加载时提示重新加载或重启 Codex；让用户保持草稿和 Bridge 开启，恢复后输入“继续 prd-setup 连接验收”。不要求发送测试文件链接，不要求重建草稿或重复导入插件。
