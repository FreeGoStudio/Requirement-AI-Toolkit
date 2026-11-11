# Linux 原型发布

用于独立发布静态原型、发布已有 PRD 产物或配置服务器。历史 HTML 不要求补做需求或设计评审；发布不意味着 browser-verified 或 accepted。

## 配置一次

历史原型中的本机地址会在发布副本中自动转换：例如资源根目录有 `pages/detail.html`，则 `http://192.168.1.10:3000/pages/detail.html?id=1#success` 从根入口转换为 `pages/detail.html?id=1#success`。不需要配置旧 IP；支持 localhost、回环和私网 IPv4/IPv6，以及省略协议的地址。URL 路径必须对应根目录内文件，目录地址查找 index.html/index.htm；不猜测多余路径前缀、不请求旧服务器。缺失、越界或引用未允许发布文档时停止发布。

转换范围为 HTML 属性、CSS 引用及 JavaScript 常见静态字面量引用；公网链接保留，本地源文件不变。动态拼接地址须人工检查。共用脚本中的页面相对 URL 若因使用页面目录不同而无法一致转换，会报错，不输出可能跳错页面的版本。

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
- 远程使用 `releases/<发布ID>/<版本ID>` 保存版本，`published/<发布ID>` 为固定访问入口。SFTP 上传后逐文件 SHA-256 核对，再原子切换链接；从本机 HTTP 逐文件核对内容，失败回退。新版本通过固定首页及全部文件 HTTP 校验后，在同一发布锁内清理该发布 ID 下其他规范版本目录；不删除其他需求、符号链接或非版本目录。清理失败返回 cleanupWarning，当前新版本保持可用。
- 每次全量打包并上传到 `.uploads/<发布ID>/<随机版本ID>`，不复用旧文件。逐文件校验后，持有该发布 ID 的锁移入 releases，再原子替换固定入口；上传不持锁。清理正式旧版本不会删除并行上传目录。相同发布 ID 的入口切换、HTTP 验证和失败回退使用独立的 `flock`，不同原型可并行发布。汇总页安装使用单独的 catalog 锁；发布流程不再修改汇总页。
- 服务器需要 `bash` 和 `flock`。锁等待上限 60 秒；锁由远程进程持有，正常结束、连接 EOF 或进程退出时释放。客户端每 10 秒发送心跳，心跳响应超时 15 秒即关闭发布连接；服务器连续 60 秒未收到心跳则退出释放锁。断连后无法确认的切换或回退仍须检查远程状态，不能声称已验收。
- `.locks/` 中的文件是内核锁的固定身份，文件存在不表示占用，不应删除这些文件。旧版 `.publish-lock` 目录不再参与新协议，因此遗留目录不阻塞新版发布，也不会被自动删除。升级前结束所有旧版发布/汇总刷新进程，并统一更新客户端；新旧协议不可混跑。

脚本返回 JSON 状态和 URL，并在输出目录记录 `.prototype-publication.json`。回复给出链接、当前发布结果、浏览器验证和用户验收状态。PRD 流程由 prd 同步本地交付入口；历史模式不改写源 HTML。上传成功但 HTTP 不通不算发布成功，提示检查访问地址、端口、防火墙与云安全组。回退失败时单独报告远程状态需人工核对，不声称旧版可用。

## 全局原型汇总页

基础访问地址加 / 为汇总页。浏览器打开或点击刷新时读取 catalog/ JSON 目录接口，只列出 32 位发布 ID 目录，再从各入口 index.html 读取标题和 Last-Modified（北京时间显示）。404 的失效入口不展示；接口失败和单项读取失败有明确提示，不伪装成空列表。请求禁用缓存，最多同时读取 4 个原型首页。发布、更新或移除入口后，无需改写汇总文件。

团队应统一升级发布技能，避免旧版客户端再次覆盖动态汇总页。

采用 Nginx autoindex_format json，不增加后台服务；目录接口只映射 published，精确匹配 catalog/，不开放 releases 或子目录遍历。接口返回 published 顶层目录信息，页面仅展示有效 ID 且具有首页的原型。发布目录仅应由受信任发布账号维护。

新服务器 Initialize 配置目录接口并安装页面。已有服务器由管理员一次性执行：

```sh
sh upgrade-catalog-server.sh /var/www/_tmp/prototypes /_tmp/prototypes
```

脚本只修改本工具管理的专用 Nginx 站点，先备份、nginx -t，再重载，失败恢复；不重新初始化服务器、不更改发布账号权限。然后发布账号在 Windows 执行：

```powershell
& $publisher -Action RefreshCatalog
```

RefreshCatalog 现在表示安装/升级动态汇总界面，不是重建列表。先验证目录接口，再原子替换页面并 HTTP 校验；失败恢复旧页面。未就绪接口不会覆盖仍可用的旧汇总页。用户自建首页不覆盖。日常 Publish 完全不依赖汇总安装操作。

## PRD 文档中的原型链接

Prd 发布会自动绑定交付根目录 HTML 中指向清单原型的链接，保留页面路径、查询参数和锚点。基础 URL 集中写入 `prototype-links.js` 中的 `window.PRD_PROTOTYPE_BASE_URL`，各文档不重复保存服务器地址。发布成功后运行时拼接远程链接；发布开始、失败或未配置时清空基础 URL，保留本地 href 并显示待发布。历史 Html 发布不执行该同步。

新增文档后同步链接（不需要连接服务器）；修改原型前先显式标记待发布：

```powershell
& $publisher -Action SyncLinks -OutputDirectory '<绝对交付目录>'
& $publisher -Action SyncLinks -OutputDirectory '<绝对交付目录>' -LinksPending
```

这两个命令使用已安装的发布运行时，或本机已有的 Python。生成文档在根目录，引用 `<script src="prototype-links.js" data-prototype-link-runtime defer></script>`；链接使用 `data-prototype-path="prototypes/low/login.html#login-error"`，静态 href 同时保留本地路径。默认同步读取发布记录，显式 LinksPending 会更新记录为待发布，避免后续新增文档误用旧的成功状态。

## 验收

自动测试命令：

```powershell
python -m unittest discover -s skills/prototype-publish/tests -p 'test_*.py' -v
node skills/prototype-publish/tests/test-document-link-runtime.cjs
node --test skills/prototype-publish/tests/test-catalog.cjs
./skills/prototype-publish/tests/Test-PublishCredentials.ps1
# 有 Git Bash / Linux shell 时，执行隔离的服务初始化故障测试：
bash skills/prototype-publish/tests/Test-ServerInitialization.sh skills/prototype-publish/scripts/initialize-prototype-server.sh skills/prototype-publish/scripts/upgrade-catalog-server.sh
```

实机必须另验：SSH 指纹与认证、apt/dnf 环境初始化、Nginx 配置不破坏已有站点、其他设备访问、中文/样式/按钮、更新固定 URL、失败回退。没有服务器时标记这些项目待验收，不用 mock 结果代替。

SSH 实现依据 [Paramiko SSHClient 文档](https://docs.paramiko.org/en/stable/api/client.html)；不使用 AutoAddPolicy 自动信任服务器。

## 同一需求重新发布

继续使用原输出目录及其 `.prototype-publication.json`，以保持发布 ID 和固定链接不变。每次重新构建入口及可达依赖的完整包，不按“曾上传”跳过文件；未被入口引用的文件不属于发布内容。新增、修改和删除通过全新版本目录生效，不合并线上旧文件。固定首页 `/发布ID/` 和每个文件的实际 URL 均核对 HTTP 内容，失败明确记录 lastAttempt=failed 并尝试回退，不能将旧地址仍可打开作为本次成功证据。

上传失败可能留下隐藏的 .uploads 临时目录，不对外发布；不自动扫描删除这些目录，以免影响其他正在上传的进程。新版必须统一使用独立上传目录，不与旧版直接向 releases 上传的客户端混跑。
