---
name: prototype-publish
description: "发布静态 HTML 原型到已配置的 Linux 临时服务器，支持历史 HTML 文件或目录，以及 prd 清单产物。收集依赖、校验上传、更新固定链接并在失败时回退；不负责需求澄清、原型设计或正式应用部署。"
---

# 静态原型发布

使用中文。先读取 `references/remote-publishing.md`，复用本机服务器配置和目标目录的 `.prototype-publication.json`，日常发布使用配置中的普通账号。已就绪服务器不执行 Initialize、不索取 root 或 sudo、不修改 Nginx；环境配置交给 prd-setup，或按用户授权调用本技能 Configure、InstallRuntime、Check。

## 选择输入

- PRD 产物：使用 `-Mode Prd -OutputDirectory '<交付目录>'`，仅发布清单登记的原型和依赖。需求与设计治理由 prd 在调用前完成，本技能不重做业务评审。
- 历史 HTML：使用 `-Mode Html -OutputDirectory '<资源根目录>' -EntryPath '<入口相对路径>'`，无需 PRD 清单、规格或历史评审。只有单个 HTML 时也可把文件绝对路径直接传给 OutputDirectory，父目录作为资源根目录。
- Auto 优先使用已有 PRD 清单；显式 EntryPath 则按历史 HTML 处理。无清单时选 index.html，否则只在根目录恰有一个 HTML 时自动选入口；存在歧义才询问。

资源根目录是允许发布的边界。先检查入口及其引用，只收集可达 HTML 和资源，不整体上传目录；历史模式会跟随入口中的包内页面链接，若链接通往不应分享的文档，先说明并处理发布范围。越界、缺失和无法识别的动态引用报告具体位置，不扩大根目录来静默绕过。历史文件保持不变，只构建发布副本；根目录无被引用的 index.html 时生成导航入口。

## 执行与验收

调用 `scripts/Invoke-PrototypePublish.ps1 -Action Publish`。服务器配置、运行时和凭据沿用 `%LOCALAPPDATA%/Requirement-AI-Toolkit/`，技能拆分或升级不重新初始化服务器。

上传成功且 HTTP 内容核对通过才返回新 URL。同一目录复用发布 ID；失败保留错误和上一成功记录，回退失败单独报告。发布锁冲突先等待其他发布结束，不自行删锁。无配置时明确说明需要配置，不把未发布当作完成。

回复发布目录、访问链接、版本结果和未验证项。HTTP 校验不能替代浏览器中文、样式和交互检查；没有浏览器能力时明确待验收。仅发布原型，不修改业务内容，不接真实后端，不部署正式应用。
