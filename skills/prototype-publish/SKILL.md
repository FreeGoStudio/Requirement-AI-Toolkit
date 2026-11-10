---
name: prototype-publish
description: "发布静态 HTML 原型到已配置的 Linux 临时服务器，支持历史 HTML 文件或目录，以及 prd 清单产物。收集依赖、校验上传、更新固定链接并在失败时回退；不负责需求澄清、原型设计或正式应用部署。"
---

# 静态原型发布

使用中文。先读取 `references/remote-publishing.md`，复用本机服务器配置和目标目录的 `.prototype-publication.json`，日常发布使用配置中的普通账号。已就绪服务器不执行 Initialize、不索取 root 或 sudo、不修改 Nginx；环境配置交给 prd-setup，或按用户授权调用本技能 Configure、InstallRuntime、Check。

## 发布前检查配置

先检查本机配置是否存在，且服务器地址、SSH 端口、用户名、加密密码、网页端口、远程目录和访问地址完整；不要向聊天输出密码或配置全文。已有完整配置直接复用，不重复询问。

未配置或缺少字段时，明确告知“尚未配置服务器，本次未发布”，保留本次要发布的目录、入口和模式，仅询问缺失的服务器地址、发布用户名及必要的端口、远程目录和访问地址。没有用户指定的服务器时不能从文档示例自动选择一台。密码通过本机安全输入提示获得，不要求粘贴到聊天。

说明并引导完成 Configure → InstallRuntime（仅缺少运行时时）→ Check；首次主机指纹按参考说明核对。配置和连接检查成功后继续原来的 Publish，不要求重新提交发布需求。等待配置期间可检查本地 HTML 和资源，但不连接未确认的目标、不上传、不报告成功。已就绪服务器不执行 Initialize。

## 选择输入

- PRD 产物：使用 `-Mode Prd -OutputDirectory '<交付目录>'`，仅发布清单登记的原型和依赖。需求与设计治理由 prd 在调用前完成，本技能不重做业务评审。
- 历史 HTML：使用 `-Mode Html -OutputDirectory '<资源根目录>' -EntryPath '<入口相对路径>'`，无需 PRD 清单、规格或历史评审。只有单个 HTML 时也可把文件绝对路径直接传给 OutputDirectory，父目录作为资源根目录。
- Auto 优先使用已有 PRD 清单；显式 EntryPath 则按历史 HTML 处理。无清单时选 index.html，否则只在根目录恰有一个 HTML 时自动选入口；存在歧义才询问。

资源根目录是允许发布的边界。先检查入口及其引用，只收集可达 HTML 和资源，不整体上传目录；历史模式会跟随入口中的包内页面链接，若链接通往不应分享的文档，先说明并处理发布范围。越界、缺失和无法识别的动态引用报告具体位置，不扩大根目录来静默绕过。历史文件保持不变，只构建发布副本；根目录无被引用的 index.html 时生成导航入口。

## 执行与验收

打包时自动处理静态引用中的 localhost、回环地址和私网 IP（含 IPv6）：按 URL 路径在资源根目录内寻找文件，转换为发布包内的相对链接，保留查询参数和状态锚点，并收集依赖。目录 URL 使用 index.html 或 index.htm。只改发布副本，不访问旧地址，不修改源文件，公网链接保留。找不到对应文件或路径越界时汇总报错并停止发布；不要猜测路径前缀或扩大资源根目录。

支持 HTML 资源/页面属性、内联样式与事件、CSS url/import，以及 JavaScript 字面量 import/from/fetch/new URL 和 src/href/poster 赋值。变量或字符串动态拼接的 URL 不保证自动处理，发布前检查这些位置；共用脚本若在不同目录页面下需要不同相对地址，会明确阻止发布，需调整脚本引用方式。

调用 `scripts/Invoke-PrototypePublish.ps1 -Action Publish`。服务器配置、运行时和凭据沿用 `%LOCALAPPDATA%/Requirement-AI-Toolkit/`，技能拆分或升级不重新初始化服务器。

Prd 模式同步交付根目录文档的原型链接：共享 prototype-links.js 保存基础 URL，页面只保存 data-prototype-path（含查询参数和锚点）。开始发布先置为 pending，成功且 HTTP 校验通过后置为 published；失败或未配置时保留本地 href 并显示待发布。最近成功 URL 留在历史记录，不作为失败后的主链接。Html 模式不改写历史源 HTML。

仅新增或更新文档时可用 `-Action SyncLinks -OutputDirectory '<交付目录>'` 复用最近发布结果，不上传；原型内容变更时先加 `-LinksPending` 标记待发布。SyncLinks 仅需本机 Python，无需服务器配置。如果上传成功但本地文档同步出现 documentLinkWarning，单独报告该问题，不把成功上传误报为回退。

上传成功且 HTTP 内容核对通过才返回新 URL。同一目录复用发布 ID；失败保留错误和上一成功记录，回退失败单独报告。发布锁冲突先等待其他发布结束，不自行删锁。无配置时明确说明需要配置，不把未发布当作完成。

每次发布成功后自动更新基础访问地址下的汇总首页，列出当前已发布原型的标题、更新时间与访问链接，已有原型自动纳入。可用 `-Action RefreshCatalog` 单独刷新，无需重新发布或 root。若返回 catalogWarning，说明原型发布成功但汇总页更新失败；明确报告并可重试 RefreshCatalog，不把它当作原型回退。

回复发布目录、访问链接、版本结果和未验证项。HTTP 校验不能替代浏览器中文、样式和交互检查；没有浏览器能力时明确待验收。仅发布原型，不修改业务内容，不接真实后端，不部署正式应用。
