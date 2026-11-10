# 团队成员安装技能与发布原型

服务器已由管理员准备完毕。本说明帮助你在 Windows 上安装技能并配置发布账号，随后通过 Codex 制作和发布原型。全程使用 `prd-publisher`，无需 root、sudo、安装 Nginx 或初始化服务器。

当前是临时原型环境，文件目录和网址均带 `_tmp` 标识，不作为后续正式系统的部署路径。这里的“临时”表示用途隔离，不表示自动过期或自动删除。

已使用旧版安装包的同事：重新安装新版技能，再按第 3 节配置新的 RemoteRoot 和 BaseUrl。账号密码不变，无需初始化服务器。旧的无前缀原型链接已停用，请改发包含 `/_tmp/prototypes/` 的新链接。

## 1 准备条件

准备好 Codex、**PowerShell 7**、**Python 3.10+**、管理员提供的工具包，以及单独提供的发布密码。所有命令在 PowerShell 7（`pwsh`）中执行，不使用 Windows PowerShell 5.1。电脑需要连接内网或 VPN，安装 Python 依赖时还需要访问软件包源。

```powershell
$PSVersionTable.PSVersion
python --version
Test-NetConnection 10.94.164.176 -Port 22
Test-NetConnection 10.94.164.176 -Port 8081
```

两个端口的 `TcpTestSucceeded` 应为 `True`。22 用于 SSH 发布，8081 用于访问网页，8080 是其他服务。

## 2 安装三个技能

解压管理员提供的工具包，在包含 `scripts`、`skills` 和 `README.md` 的目录打开 PowerShell 7，执行：

```powershell
./scripts/install-skill.ps1 -SkillName prd
./scripts/install-skill.ps1 -SkillName prd-setup
./scripts/install-skill.ps1 -SkillName prototype-publish
```

默认安装到 `%USERPROFILE%/.codex/skills`；设置了 `CODEX_HOME` 时安装到其 `skills` 子目录。旧版会自动备份。安装后在 Codex 新开聊天。

解压包安装无需 Git。请使用管理员提供的包含 Linux 发布功能的版本，不用旧仓库版本替代；远程安装须等待管理员确认对应分支已更新。

## 3 配置发布账号

| 项目 | 值 |
| --- | --- |
| 服务器 | `10.94.164.176` |
| SSH 端口 | `22` |
| 用户名 | `prd-publisher` |
| 密码 | 向管理员单独获取 |
| 网页端口 | `8081` |
| 发布根目录 | `/var/www/_tmp/prototypes` |
| 基础地址 | `http://10.94.164.176:8081/_tmp/prototypes` |

在 PowerShell 7 依次执行；出现 `SSH 密码` 提示时输入密码，不要把密码写进命令行、文档或聊天。

```powershell
$skillHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$publisher = Join-Path $skillHome 'skills/prototype-publish/scripts/Invoke-PrototypePublish.ps1'
if (-not (Test-Path -LiteralPath $publisher)) { throw '请先安装管理员提供的prototype-publish 技能。' }

& $publisher -Action Configure `
  -ServerAddress '10.94.164.176' `
  -SshPort 22 `
  -Username 'prd-publisher' `
  -WebPort 8081 `
  -RemoteRoot '/var/www/_tmp/prototypes' `
  -BaseUrl 'http://10.94.164.176:8081/_tmp/prototypes'

& $publisher -Action InstallRuntime
& $publisher -Action Check
```

`InstallRuntime` 仅在本机安装独立 Python 发布环境，不修改服务器。首次 Check 显示待确认的主机指纹并停止，属于预期行为。管理员已核对的 ED25519 指纹为：

```text
SHA256:/lJj80ZMRVCc9KHy0U8ywEhowA4xDtb2NlrxBqgJ0KU
```

确认显示的指纹与管理员提供的值完全一致后，执行：

```powershell
& $publisher -Action Check -TrustFingerprint 'SHA256:/lJj80ZMRVCc9KHy0U8ywEhowA4xDtb2NlrxBqgJ0KU'
```

成功输出包含 `"status": "connected"` 和 `prd-publisher` 用户信息。后续检查直接使用 `-Action Check`。指纹不一致时联系管理员，不删除已有主机记录绕过检查。

**配置至此完成，不要执行 `-Action Initialize`，不要申请 sudo 权限。**

配置和当前 Windows 用户加密的密码保存在 `%LOCALAPPDATA%/Requirement-AI-Toolkit/`，技能更新不会覆盖。每人需在自己的电脑输入密码，不复制其他人的 `server.json`。修改密码时重新运行上面的完整 Configure 命令，保留 `-WebPort 8081`，避免恢复默认端口。

## 4 使用 Codex

新开聊天，复制下面的请求并替换业务需求：

```text
$prd 帮我制作一个订单查询的交互原型，先澄清需求，再按阶段生成和评审。
本机已配置发布服务器 10.94.164.176，网页端口 8081，账号 prd-publisher。
服务器已经初始化，不执行 Initialize，不使用 root 或 sudo，不修改 Nginx。
原型更新并通过静态检查后，使用本机保存的发布配置上传，返回可分享的链接。
```

检查本机环境时可用：

```text
$prd-setup 检查本机技能和发布连接，使用本机配置的 prd-publisher 账号。
服务器已由管理员准备好，只检查本机环境和 SSH，不初始化服务器，不使用 root 或 sudo，不修改 Nginx。
```

分享返回的完整链接 `http://10.94.164.176:8081/_tmp/prototypes/<发布ID>/`。查看者不需要账号，但需能访问内网；基础地址不提供所有项目的目录列表。

服务器只发布原型及其依赖资源，需求文档、评审记录和截图保留本机。同一输出目录更新沿用同一链接；复制到另一目录或电脑会生成新发布 ID，不能用于接管原链接。

## 5 手动发布已有产物

历史原型不必进入 PRD 流程，直接在 Codex 中使用：

```text
$prototype-publish 发布 D:\历史原型\订单，入口是 index.html。
使用本机已配置的 prd-publisher 账号和 /_tmp/prototypes 临时路径，不初始化服务器。
```

或在 PowerShell 7 中调用：

```powershell
& $publisher -Action Publish -Mode Html -OutputDirectory 'D:\历史原型\订单' -EntryPath 'index.html'
```

历史模式无需清单，只发布入口可达的页面和资源，不修改源文件。先核对入口是否链接了不应分享的其他文档。

通常由 `$prd` 自动执行。需要手动操作时，在已定义 `$publisher` 的 PowerShell 7 窗口运行：

```powershell
$outputDirectory = Read-Host '请输入本机交付目录的绝对路径'
& $publisher -Action Publish -OutputDirectory $outputDirectory
```

上述默认 Auto 命令在有 PRD 清单时发布清单产物；没有清单时按历史 HTML 处理，优先选择 index.html，否则仅在根目录有一个 HTML 时自动选取入口。发布成功后用浏览器检查中文、样式、按钮及更新内容。`published` 表示上传和 HTTP 内容检查通过，不代表交互或业务验收通过。

## 6 常见问题

| 情况 | 处理方式 |
| --- | --- |
| 找不到 Python | 安装 Python 3.10+，确认 `python --version` 可用，再 InstallRuntime。 |
| PowerShell 解析错误或乱码 | 使用 PowerShell 7，不是 Windows PowerShell 5.1。 |
| 22 或 8081 不通 | 检查内网/VPN，联系管理员核对网络，不要重新初始化服务器。 |
| 密码认证失败或无法解密配置 | 核对密码，在当前 Windows 用户下按第 3 节重新 Configure，不复制他人的配置。 |
| 要求 sudo 或初始化 | 停止该步骤，检查是否误执行 Initialize 或使用了旧技能。 |
| 发布脚本不存在 | 重新安装配套工具包中的三个技能。 |
| 依赖缺失或链接指向文档 | 让 `$prd` 修复具体引用后重试，不上传整个交付目录。 |
| 发布锁冲突 | 其他人可能正在发布，稍后重试；持续冲突请管理员处理，不自行删锁。 |
| 发布失败但旧链接能打开 | 可能仍是上次成功版本，不能当作本次更新成功。 |

共享账号可以修改同一发布目录内其他人的文件。只通过发布脚本维护自己的项目；需要权限隔离时由管理员分配独立账号和目录。
