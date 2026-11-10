# 本地 HTML 环境检查

1. 检查 prd 安装目录：设置了 CODEX_HOME 时用其 skills 子目录，否则使用 `%USERPROFILE%/.codex/skills`。检查 SKILL.md、references、scripts 是否完整，不将当前聊天未加载误判为未安装。
2. 已有仓库时运行 `scripts/install-skill.ps1 -SkillName prd`；缺少仓库时使用 README 中的 Git 安装方式。需要 Git 的场景先检查 Get-Command git；本地安装不需要下载依赖。指定分支时将 Branch 传给 install-from-git.ps1，避免安装其他分支版本。
3. 安装或更新 prd 会先自动安装或更新同版本 prototype-publish，沿用 CodexHome 和 NoBackup；依赖失败时停止，不替换 prd。单独安装 prd-setup 不自动安装发布技能。修改技能后新开聊天加载；不要覆盖无关技能。安装器默认备份旧目录，不修改服务器配置或初始化服务器。
4. 检查可用浏览器与实际操作能力。普通静态包用 file:// 打开；可用浏览器工具若只接受 HTTP，可选使用已有运行时提供仅绑定 127.0.0.1 的静态服务，记录根目录、端口、启动/停止方法。不要为默认静态文件强制安装运行时。
5. 在独立临时目录创建验收 HTML 与本地 CSS，页面包含中文标题、按钮和点击后的状态文本。打开后检查样式与中文，点击并验证文本变化，再查看截图。无自动化能力时提供文件链接与手动操作步骤，结果记为待验收。
6. 记录已验证项和实际限制。业务 Knowledge 目录遵循 prd 的截图工作流，不生成假截图或空索引冒充就绪。

## Linux 发布环境

用户请求服务器发布时，定位上述安装目录中的 `prototype-publish/references/remote-publishing.md` 并读取，复用 `prototype-publish/scripts/Invoke-PrototypePublish.ps1`。prototype-publish 缺失时先安装它；仅发布历史 HTML 不要求安装 prd，也不补做需求或设计清单。

服务器已由管理员准备好时，按 Configure → InstallRuntime → Check 配置本机，直接使用发布账号，跳过 Initialize，不要求 root/sudo。只有用户授权准备新服务器时才接续 Initialize；连接失败不自动触发初始化。

初次 Check 返回主机指纹时请用户核对，确认后以 `-TrustFingerprint` 重试；已有指纹发生变化时停止并说明，不自动覆盖 known_hosts。服务器密码仅通过安全输入获得。需要发布验收时用独立的测试原型输出目录运行 Publish，访问远程 URL，检查中文、样式、按钮和固定链接更新；测试目录与正式项目隔离。服务器或浏览器不可用时分别列出待验收项。
