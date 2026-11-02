# 技能版本治理执行记录

日期：2026-11-02（Asia/Shanghai）。需求依据为本聊天用户提供的六节执行方案及后续“现在按方案开始执行”的授权；旧 product-requirement-prototyping 仅核对并建议，不直接删除。D:\ChatGPT 为用户从现场拷贝的资料。本次不治理需求产物、不改 prd 业务流程、不修改插件缓存、不推送或发布。

## 现场盘点及范围

复用现有源码仓库 `D:\workspace\Requirement-AI-Toolkit`，远程为 `https://github.com/FreeGoStudio/Requirement-AI-Toolkit.git`。开始时工作树干净，HEAD 为 `403ea80`。正式 prd 与 prd-setup 文件内容均与该版本一致（逐目录差异核对）；未建立第二个源码仓库。

四个指定路径逐个检查如下，均没有执行删除或移动：

|绝对路径|现场状态|
|---|---|
|C:\Users\Administrator\.codex\skills\prd.backup-20260626-180720|已不存在|
|C:\Users\Administrator\.codex\skills\prd.backup-20260706-110850|已不存在|
|C:\Users\Administrator\.codex\skills\prd.backup-20260711-150318|已不存在|
|C:\Users\Administrator\.codex\skills\prd.backup-20261031-160215|已不存在|

`local-sources.json` 逐项保存加载来源、命名空间、可见范围及本会话技能路径；`inventory-before.json` 保存每个候选的绝对路径、实际名称、description、SHA-256 和当前会话是否列出。覆盖用户 `.codex/skills`、`.agents/skills`、当前项目及祖先的候选技能目录，以及会话明确暴露的 12 个插件技能根。当前项目和祖先候选目录均不存在；不是把普通仓库 `skills/` 自动认定为加载目录。

CODEX_HOME 未设置；本机 config.toml 未发现额外技能路径设置。插件配置及会话目录有交叉核对，未扫描或改动所有缓存历史版本；未宣称覆盖其他项目、未暴露的组织配置或内部来源。`D:\ChatGPT` 的隐藏文件扫描未发现 SKILL.md，包含需求文档、原型、图片及项目资料，保持原样。无法凭此确认另一台用户机器的实时技能状态。

两个现有 Junction 单独核对：英语学习入口指向 `D:\workspace\english-learning-skill`，SQL Server 入口指向 `D:\workspace\JQB\DatabaseSkill`；它们不是重复备份。只读清单记录逻辑及解析路径，维护安装不改这些链接。

初始检查未发现同 namespace/scope 的同名冲突或加载范围内备份。初始失败两项为 prd/prd-setup 缺少安装来源记录，保留在 before JSON 中，不掩盖初始结果。

## 原始验收点与实际修改依据

|原始要求|已有缺口证据|本次修改|
|---|---|---|
|连续更新不新增可发现备份|install-skill.ps1 原来把目标移动到 skills/<name>.backup-时间|保留原入口，候选外部验证，历史改为 skill-history 中 ZIP|
|当前来源可追溯、同入口回滚|原安装没有提交与文件版本记录|从 Git 提交安装，写来源/安装哈希，Revision 回滚|
|保留用户未合并修改|原本地安装直接复制替换；远程安装 reset --hard|本地三方合并并输出变化，冲突保留；远程拒绝脏树/非快进，不强制重置|
|候选失败不替换、失败可恢复|原脚本替换后只检查少量文件存在|先验 YAML/脚本语法，先校验外部归档，事后比对哈希并尝试恢复|
|只读检查、机器结果和非零退出|仓库无技能版本清单检查器|新增 Test-SkillInventory.ps1 及共享实现、行为测试|
|规则落在实际维护入口|prd-setup 仍称默认备份旧目录；setup 安装脚本总取远程 main|更新配套说明、仓库维护约定，本地 setup 入口复用本地安装器|

不将已有 prd 业务正确性升级成此次新增开发；业务脚本仅做候选语法检查。源码的 prd 目录没有修改。

## 旧入口核对与停用建议（未执行）

旧 `C:\Users\Administrator\.codex\skills\product-requirement-prototyping\SKILL.md` 仍存在且被本会话发现。其 name 与 prd 不同，是用途重叠而非同名版本。description 包含“产品需求工具”“需求澄清”“PRD”“低/高保真原型”等通用触发；agents/openai.yaml 的展示名为“产品需求工具”，allow_implicit_invocation=true。其内部独立用途是通过 figma-console-mcp/Desktop Bridge 制作 Figma 原型，默认 Markdown 文档；当前 prd 为 HTML 产出，两者并非完全等价。内部引用包括 output-artifacts.md、prototype-spec.md、figma-console-mcp.md 等，不能作为无用备份删除。

建议另行确认后，将旧入口收窄为明确的“旧版 Figma 需求原型”，移除通用需求别名和展示名竞争；或确认不再需要专用 Figma 流程后外部归档停用。此次未修改其名称、描述、调用策略、引用或目录。未声明它已转接 prd，aliases 配置为空。

prd-setup 继续承担安装和环境检查，保留。其他技能仅盘点。因旧技能仍保持通用触发，“同一通用需求入口不再竞争”的最终验收未关闭。

## 验证与交付状态

维护约定、安装/更新/回滚说明见同目录 README.md。自动行为测试覆盖原方案场景，并包含替换失败恢复、远程脏树保护、链接识别。链接测试发现 Windows 短路径/长路径字符串差异，已将测试按解析路径比较；没有修改需求或绕过链接检查。

应用内最终验收待完成：本聊天的注入列表不能代替重启后的新聊天。未重启正在工作的应用、未创建未经请求的新聊天，也未声称已实际调用刷新后的 prd。用户重开应用并新建聊天后，应确认唯一 prd 指向正式路径；如仍出现旧备份，应重新枚举来源而不是盲删。

## 本次完成结果

- 实现完成：维护机制及说明已提交 `512c7f797b27c369df11bbd45c2dcb8cc8d9354a`。本机 prd、prd-setup 已通过统一安装器安装该来源，均无本地合并冲突。
- 自动验证通过：11 项行为测试全部通过；prd-setup 技能格式校验通过；当前 prd 候选脚本语法校验通过；Git 差异检查通过。系统技能校验器最初因 Windows 默认 GBK 解码失败，使用 Python `-X utf8` 重跑通过，未修改或绕过校验器。
- 最终文件检查：`inventory-after.json` 返回 0，记录 36 个技能候选，零同名冲突、零加载范围内备份、零检查错误；正式入口均能对应提交及文件哈希。检查包括链接目标的显式核对，不表示应用已重新加载。
- prd 保护：安装前的 21 个原有文件逐文件 SHA-256 与安装后完全一致，仅新增 `.skill-install.json` 来源记录；prd 业务源码未改动。
- 恢复路径：`C:\Users\Administrator\.codex\skill-history\prd-20261102T033406Z-c1f9fdee.zip`；`C:\Users\Administrator\.codex\skill-history\prd-setup-20261102T033407Z-c805f0db.zip`。两包已校验可读且包含原 SKILL.md。历史是 ZIP，不会产生新的 SKILL.md 候选。
- 应用内验收未完成：需用户重启应用并在新聊天验证正式 prd 路径与发现列表；旧通用入口的用途竞争仍待用户决定后续收窄或停用。

没有推送远程，远程 main 的安装器尚未获得本次本地修改。D:\ChatGPT、旧技能及插件缓存未修改。报告与 before/after 清单作为独立验证记录提交；正式技能版本仍对应上面的机制提交，后续报告提交无需重新安装。
