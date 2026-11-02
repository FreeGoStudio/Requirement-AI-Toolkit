# 自维护技能维护约定

适用本仓库的自维护技能；不接管插件缓存，不修改 prd 业务分析流程或需求产物目录。唯一正式 prd 为 `C:\Users\Administrator\.codex\skills\prd\SKILL.md`。源码源头为本 Git 仓库 `skills/prd`，配套为 `skills/prd-setup`。历史与实验不得放进任何已配置技能加载根目录。

## 创建、更新、安装

1. 在源码仓库 `skills/<name>` 创建或修改技能。加载目录只保存已验证版本，不在其下建立 backup、old 或实验副本。系统 skill-creator/skill-installer 和插件缓存不修改；使用这些工具为本仓库维护技能时，明确把候选写入源码目录，然后走本发布入口。
2. 核对当前安装记录 `.skill-install.json` 和本地差异。运行技能自己的适用测试；本次只改维护入口时运行下面的维护测试。验证后提交本次源码，不混入其他工作。
3. 执行 `scripts/install-skill.ps1`。它只发布已提交内容，拒绝技能源码中的未提交修改；从指定 Git 提交提取候选到加载范围外，校验 YAML、名称、Python 编译及 PowerShell 语法。业务行为仍由技能对应测试验证，语法校验不能替代业务验收。
4. 安装器比较旧来源、本地安装与新来源，打印变化文件。无冲突变化三方合并，冲突时不替换正式入口。首次接管没有记录的安装，只自动接管与来源一致的版本；存在差异时须查明原始提交，通过 `-BaselineRevision` 传入，再合并。不能用猜测的基线绕过冲突。
5. 当前文件按原字节保存为外部 ZIP 并校验后，替换同一个正式目录。失败尝试恢复原字节，报告恢复结果、正式路径和恢复包位置。不要并发安装或在安装期间编辑正式目录；进程强制结束或断电不保证自动恢复，此时先检查实际状态，按恢复说明处理。
6. 运行只读盘点，重开应用并在新聊天核对发现结果。旧聊天注入列表不代表刷新后结果。

依赖：Git、Python 3.10+、PyYAML、Windows PowerShell。不会自动安装依赖。本机已具备这些依赖；换机先核对。历史 ZIP 为 `CODEX_HOME/skill-history/<技能>-<UTC时间>-<随机标识>.zip`，正式目录内记录来源仓库、完整提交、来源文件哈希、安装文件哈希、本地合并差异及恢复包路径。版本不参与加载器选择。安装器对修改目标及其祖先拒绝链接/重解析点，历史目录与传入加载根目录交叉时拒绝安装。

```powershell
python -m unittest discover -s scripts/tests -v
./scripts/install-skill.ps1 -SkillName prd -InventoryConfig docs/skill-maintenance/local-sources.json
./scripts/install-skill.ps1 -SkillName prd-setup -InventoryConfig docs/skill-maintenance/local-sources.json
./scripts/Test-SkillInventory.ps1 -ConfigPath docs/skill-maintenance/local-sources.json
```

需要查看变更内容时，使用 `git diff --no-index -- <源码技能目录> <正式技能目录>`，区分安装记录与业务文件。合并成功的用户修改继续保留在正式入口并记录；随后应在源码仓库审查整合、测试和提交，避免长期双向编辑。回滚也保留用户未合并修改，无法安全合并时停在冲突清单，不静默丢弃修改。

## 回滚及故障恢复

正常回滚指定可访问的历史提交，仍发布到相同目录：

```powershell
./scripts/install-skill.ps1 -SkillName prd -Revision '<完整提交哈希>' -InventoryConfig docs/skill-maintenance/local-sources.json
```

目标提交须包含 `skills/prd`。记录的源码仓库需保留；迁移仓库时同时保留 Git 历史并核对安装记录，不把唯一来源留在系统临时目录。

若安装中断：先读取实际正式目录及其 `.skill-install.json`，查找 `skill-history` 的恢复 ZIP。将选定 ZIP 解到加载范围外的临时目录，核对文件和哈希，先外部保存现存正式目录（包括未合并修改），确认目标绝对路径、父目录和重解析点，再恢复到原来的 `skills/prd`；不得解压成加载目录下的 prd-old/prd-backup。恢复后运行只读盘点及新聊天验证。首次补录前的 ZIP 没有版本记录，恢复后需按已核实的基线提交重新接管。

## 只读检查与范围

`Test-SkillInventory.ps1` 只读，stdout 为 JSON，stderr 为简短中文结论，失败返回非零。传入 `-LoadingRoots <目录数组>` 可仅检查指定文件来源；或使用 JSON 配置的 `roots`（path/source/namespace/scope/required）、`formal`、`sessionPaths`、`aliases`、`resolvedLinks`。`local-sources.json` 是 2026-11-02 本机快照，换机、启停插件或改变路径后应重新枚举，不能直接当作通用配置。

同名判断限同 namespace 和 scope；插件命名空间、不同可见范围单独列出。不存在的可选项目根记录 exists=false。发现未核对的链接报错；明确检查过的只读链接目标可写入 resolvedLinks，目标改变再次报错。别名检查仅验证声明的 expectedReference 和目标 SKILL.md 存在，不能证明模型实际转接行为。用途重叠人工审查，不据关键词删除。

检查覆盖显式提供来源，不宣称枚举所有项目、所有缓存版本或应用内部来源。正式入口验证 Git 提交及逐文件哈希；无法访问来源时报告失败，不伪造追溯成功。没有真实应用验证时最终验收保持待完成。

机制依据：[OpenAI 技能说明](https://developers.openai.com/plugins/concepts/skills)、[Build skills](https://learn.chatgpt.com/docs/build-skills)。本地创建者及历史升级过程无日志证据，不作归因。
