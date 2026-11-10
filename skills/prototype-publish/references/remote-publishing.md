# Linux 原型发布

用于独立发布静态原型、发布已有 PRD 产物或配置服务器。历史 HTML 不要求补做需求或设计评审；发布不意味着 browser-verified 或 accepted。

## 配置一次

未配置或配置不完整时，技能先提示“尚未配置服务器，本次未发布”，询问缺失信息并引导 Configure → InstallRuntime（按需）→ Check，成功后继续原来的发布。脚本在启动运行时、打包和连接之前检查配置文件及必需字段，并返回具体缺项和操作提示；不自动选择示例服务器。密码只在本机安全提示中输入。已配置的用户不重复配置。

在 Windows 上使用 PowerShell 7 执行以下命令。若服务器已经由管理员准备好，只运行 Configure、InstallRuntime 和 Check，直接使用发布账号，跳过下方 Initialize。日常 Publish 不需要 root 或 sudo，不因发布失败自动初始化服务器。

Windows 上需要 Python 3.10+。配置和独立虚拟环境默认位于 `%LOCALAPPDATA%/Requirement-AI-Toolkit/`，不位于仓库、技能目录或输出包。`server.json` 保存地址、用户名、端口、目录、访问地址及当前 Windows 用户 DPAPI 加密密码；`known_hosts` 保存已确认主机公钥。换电脑/Windows 账号需重新输入密码。不要展示或提交配置文件内容。

以下命令中的 `$publisher` 为已安装 prototype-publish 技能内脚本的绝对路径（若设置 CODEX_HOME，使用其 skills 目录）：

```powershell
$skillHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$publisher = Join-Path $skillHome 'skills/prototype-publish/scripts/Invoke-PrototypePublish.ps1'
& $publisher -Action Configure -ServerAddress '192.168.1.20' -Username 'prototype'
& $publisher -Action InstallRuntime
& $publisher -Action Check
```

Configure 通过安全提示输入密码，也支持已取得的 `SecureString` 类型 `-Password`；不提供明文密码参数。可选 `-SshPort 22 -WebPort 8080 -RemoteRoot '/var/www/_tmp/prototypes' -BaseUrl 'http://192.168.1.20:8080/_tmp/prototypes'`；访问地址默认由服务器地址、网站端口及 `/_tmp/prototypes` 前缀生成。BaseUrl 可含由字母、数字、下划线和连字符组成的路径段，初始化时 Nginx 只在该前缀下提供原型，其他路径返回 404；显式配置无前缀地址仍兼容原有站点。重新 Configure 更新配置，默认参数会重新应用，需要保留非默认设置时显式传入。配置后每次原型更新自动发布。

首次 Check 会显示 `SHA256:...` 指纹并停止。用户通过可信渠道核对并明确确认后：

```powershell
& $publisher -Action Check -TrustFingerprint 'SHA256:用户已核对的指纹'
```

仅管理员在首次准备新服务器且已获授权时执行；使用已有服务器的团队成员跳过：

```powershell
& $publisher -Action Initialize
```

不自动接受首次指纹，不将“探测到”当作“用户确认”。已保存公钥不匹配时报错，不自动清除。SSH 采用密码认证；初始化需要 root 或 sudo，sudo 默认使用同一密码。独立 sudo 密码、交互 MFA 或 requiretty 环境不自动适配，报告实际错误。

Initialize 探测 systemd、apt/dnf、权限和端口，安装 Nginx，维护 `/etc/nginx/conf.d/prd-prototypes.conf` 和专用根目录。已有非本工具管理的同名配置/目录、端口冲突或缺少 conf.d include 时停止。先 `nginx -t` 后启动/重载，站点修改失败恢复原配置；已安装的软件包和创建的专用目录保留便于诊断，不卸载其他服务。若 SELinux 策略阻止端口绑定或读取，报告 Nginx/systemd 错误，由管理员配置对应策略后重试；不关闭 SELinux。防火墙和云安全组不自动修改。

## 每次原型更新

PRD 流程先由 prd 完成 postwrite 和静态检查，再调用：

```powershell
& $publisher -Action Publish -Mode Prd -OutputDirectory '<绝对交付目录>'
```

发布技能不依赖 prd 治理脚本，不重做业务评审。未配置或运行时、解密、连接、打包、发布失败均明确报错；prd 在未配置服务器时自行维持本地流程。

历史 HTML 可单独发布，不需要清单。指定资源根目录与入口，或者直接传单个 HTML 文件（父目录作为资源根目录）：

```powershell
& $publisher -Action Publish -Mode Html -OutputDirectory 'D:\历史原型\订单' -EntryPath 'pages/start.html'
& $publisher -Action Publish -Mode Html -OutputDirectory 'D:\历史原型\index.html'
```

历史模式跟随包内 HTML 页面链接和资源依赖，保留 index.html 原页面；没有可达 index.html 时生成导航入口。源文件不改写，不上传未引用文件或隐藏配置。目录中有多个 HTML 且无 index.html 时必须指定 EntryPath。Auto 模式优先读取已有 PRD 清单，显式 EntryPath 则采用历史模式。历史目录中的其他文档若被入口链接到，也属于可达页面，发布前核对分享范围。

- PRD 模式以清单的 low/high 入口打包，仅复制被引用的资源；模拟数据 JSON 仅允许位于 assets、data 或 prototypes 目录，禁止上传参考与评审截图目录。历史模式允许根目录内可达的 HTML、JSON 和资源，不受 PRD 目录约定限制。两种模式均不上传整个目录。
- HTML `src/href/poster/srcset`、内联样式、CSS `url/@import` 和 JS 字面量 `import/from/fetch/new URL`、资源属性赋值可检查；动态加载路径无法可靠推断时应改成明确资源引用后再发布。模块引用及 `new URL(..., import.meta.url)` 按 JS 路径解析，fetch 和属性赋值按调用页面解析。未经静态识别的运行时资源必须在发布前实际检查，不能因打包通过就声称交互通过。
- PRD 模式的交付首页在发布副本中由独立原型导航替代，其他文档链接阻止发布；历史模式保留可达 HTML。两种模式均在依赖缺失或越界时报告具体位置并停止。
- 远程使用 `releases/<发布ID>/<版本ID>` 保存版本，`published/<发布ID>` 为固定访问入口。SFTP 上传后逐文件 SHA-256 核对，再原子切换链接；从本机 HTTP 逐文件核对内容，失败回退。历史版本暂保留，不自动删除。
- 使用服务器根目录发布锁避免并发切换。若进程异常中断遗留 `.publish-lock`，先检查是否有正在进行的发布及固定链接指向，确认无活动发布后由管理员移除锁；不自动抢锁或删除远程目录。

脚本返回 JSON 状态和 URL，并在输出目录记录 `.prototype-publication.json`。回复给出链接、当前发布结果、浏览器验证和用户验收状态。PRD 流程由 prd 同步本地交付入口；历史模式不改写源 HTML。上传成功但 HTTP 不通不算发布成功，提示检查访问地址、端口、防火墙与云安全组。回退失败时单独报告远程状态需人工核对，不声称旧版可用。

## 验收

自动测试命令：

```powershell
python -m unittest discover -s skills/prototype-publish/tests -p test_prototype_publish.py -v
./skills/prototype-publish/tests/Test-PublishCredentials.ps1
# 有 Git Bash / Linux shell 时，执行隔离的服务初始化故障测试：
bash skills/prototype-publish/tests/Test-ServerInitialization.sh skills/prototype-publish/scripts/initialize-prototype-server.sh
```

实机必须另验：SSH 指纹与认证、apt/dnf 环境初始化、Nginx 配置不破坏已有站点、其他设备访问、中文/样式/按钮、更新固定 URL、失败回退。没有服务器时标记这些项目待验收，不用 mock 结果代替。

SSH 实现依据 [Paramiko SSHClient 文档](https://docs.paramiko.org/en/stable/api/client.html)；不使用 AutoAddPolicy 自动信任服务器。
