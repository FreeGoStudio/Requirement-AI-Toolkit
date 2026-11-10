# Linux 原型发布

仅在需要配置服务器或原型生成/更新后读取。业务与设计评审节点不变；发布不意味着 browser-verified 或 accepted。

## 配置一次

Windows 上需要 Python 3.10+。配置和独立虚拟环境默认位于 `%LOCALAPPDATA%/Requirement-AI-Toolkit/`，不位于仓库、技能目录或输出包。`server.json` 保存地址、用户名、端口、目录、访问地址及当前 Windows 用户 DPAPI 加密密码；`known_hosts` 保存已确认主机公钥。换电脑/Windows 账号需重新输入密码。不要展示或提交配置文件内容。

以下命令中的 `$publisher` 为已安装 prd 技能内脚本的绝对路径（若设置 CODEX_HOME，使用其 skills 目录）：

```powershell
$skillHome = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$publisher = Join-Path $skillHome 'skills/prd/scripts/Invoke-PrototypePublish.ps1'
& $publisher -Action Configure -ServerAddress '192.168.1.20' -Username 'prototype'
& $publisher -Action InstallRuntime
& $publisher -Action Check
```

Configure 通过安全提示输入密码，也支持已取得的 `SecureString` 类型 `-Password`；不提供明文密码参数。可选 `-SshPort 22 -WebPort 8080 -RemoteRoot '/var/www/prd-prototypes' -BaseUrl 'http://192.168.1.20:8080'`；访问地址默认由服务器地址和网站端口生成。重新 Configure 更新配置，默认参数会重新应用，需要保留非默认设置时显式传入。配置后每次原型更新自动发布。

首次 Check 会显示 `SHA256:...` 指纹并停止。用户通过可信渠道核对并明确确认后：

```powershell
& $publisher -Action Check -TrustFingerprint 'SHA256:用户已核对的指纹'
& $publisher -Action Initialize
```

不自动接受首次指纹，不将“探测到”当作“用户确认”。已保存公钥不匹配时报错，不自动清除。SSH 采用密码认证；初始化需要 root 或 sudo，sudo 默认使用同一密码。独立 sudo 密码、交互 MFA 或 requiretty 环境不自动适配，报告实际错误。

Initialize 探测 systemd、apt/dnf、权限和端口，安装 Nginx，维护 `/etc/nginx/conf.d/prd-prototypes.conf` 和专用根目录。已有非本工具管理的同名配置/目录、端口冲突或缺少 conf.d include 时停止。先 `nginx -t` 后启动/重载，站点修改失败恢复原配置；已安装的软件包和创建的专用目录保留便于诊断，不卸载其他服务。若 SELinux 策略阻止端口绑定或读取，报告 Nginx/systemd 错误，由管理员配置对应策略后重试；不关闭 SELinux。防火墙和云安全组不自动修改。

## 每次原型更新

先按现有规则完成 postwrite、资源与链接静态检查；再调用：

```powershell
& $publisher -Action Publish -OutputDirectory '<绝对交付目录>'
```

脚本再次执行清单 postwrite。未配置返回本地模式；配置存在但运行时、解密、连接、打包或发布失败时返回失败，不能静默退回本地成功。

- 以清单的 low/high 入口打包，仅复制被引用的 CSS、JS、图片、字体、音视频及传递依赖；模拟数据 JSON 仅允许位于 assets、data 或 prototypes 目录。不上传整个目录，参考与评审截图目录禁止上传。
- HTML `src/href/poster/srcset`、内联样式、CSS `url/@import` 和 JS 字面量 `import/from/fetch/new URL`、资源属性赋值可检查；动态加载路径无法可靠推断时应改成明确资源引用后再发布。模块引用及 `new URL(..., import.meta.url)` 按 JS 路径解析，fetch 和属性赋值按调用页面解析。未经静态识别的运行时资源必须在发布前实际检查，不能因打包通过就声称交互通过。
- 本地交付首页由独立原型导航替代，返回它的链接去除原文档锚点。其他文档链接、缺失文件和越界路径阻止发布，报告具体位置。
- 远程使用 `releases/<发布ID>/<版本ID>` 保存版本，`published/<发布ID>` 为固定访问入口。SFTP 上传后逐文件 SHA-256 核对，再原子切换链接；从本机 HTTP 逐文件核对内容，失败回退。历史版本暂保留，不自动删除。
- 使用服务器根目录发布锁避免并发切换。若进程异常中断遗留 `.publish-lock`，先检查是否有正在进行的发布及固定链接指向，确认无活动发布后由管理员移除锁；不自动抢锁或删除远程目录。

脚本返回 JSON 状态和 URL，并在输出目录记录 `.prototype-publication.json`。回复给出链接、当前发布结果、浏览器验证和用户验收状态；同步本地 `index.html`。上传成功但 HTTP 不通不算发布成功，提示检查访问地址、端口、防火墙与云安全组。回退失败时单独报告远程状态需人工核对，不声称旧版可用。

## 验收

自动测试命令：

```powershell
python -m unittest discover -s skills/prd/tests -p test_prototype_publish.py -v
./skills/prd/tests/Test-PublishCredentials.ps1
./skills/prd/tests/Test-DesignGovernance.ps1
# 有 Git Bash / Linux shell 时，执行隔离的服务初始化故障测试：
bash skills/prd/tests/Test-ServerInitialization.sh skills/prd/scripts/initialize-prototype-server.sh
```

实机必须另验：SSH 指纹与认证、apt/dnf 环境初始化、Nginx 配置不破坏已有站点、其他设备访问、中文/样式/按钮、更新固定 URL、失败回退。没有服务器时标记这些项目待验收，不用 mock 结果代替。

SSH 实现依据 [Paramiko SSHClient 文档](https://docs.paramiko.org/en/stable/api/client.html)；不使用 AutoAddPolicy 自动信任服务器。
