# 本地 HTML 环境检查

1. 检查 prd 安装目录：设置了 CODEX_HOME 时用其 skills 子目录，否则使用 `%USERPROFILE%/.codex/skills`。检查 SKILL.md、references、scripts 是否完整，不将当前聊天未加载误判为未安装。
2. 已有仓库时运行 `scripts/install-skill.ps1 -SkillName prd`；缺少仓库时使用 README 中的 Git 安装方式。需要 Git 的场景先检查 Get-Command git；本地安装不需要下载依赖。指定分支时将 Branch 传给 install-from-git.ps1，避免安装其他分支版本。
3. 创建、更新和回滚均使用源码仓库的 `scripts/install-skill.ps1`，先验证并提交源码；不要直接在加载目录制作新旧副本。安装器合并无冲突的本地改动，有冲突则列出文件并保留正式版本。历史 ZIP 保存在 CODEX_HOME 的 `skill-history`（加载范围外），版本写入正式目录 `.skill-install.json`；回滚使用同一脚本的 `-Revision <提交>`。首次接管不同版本时先核实 `-BaselineRevision`，不得猜测或强制覆盖。修改后新开聊天验证发现结果。维护约定和只读盘点命令见源码仓库 `docs/skill-maintenance/README.md`。
4. 检查可用浏览器与实际操作能力。普通静态包用 file:// 打开；可用浏览器工具若只接受 HTTP，可选使用已有运行时提供仅绑定 127.0.0.1 的静态服务，记录根目录、端口、启动/停止方法。不要为默认静态文件强制安装运行时。
5. 在独立临时目录创建验收 HTML 与本地 CSS，页面包含中文标题、按钮和点击后的状态文本。打开后检查样式与中文，点击并验证文本变化，再查看截图。无自动化能力时提供文件链接与手动操作步骤，结果记为待验收。
6. 记录已验证项和实际限制。业务 Knowledge 目录遵循 prd 的截图工作流，不生成假截图或空索引冒充就绪。
