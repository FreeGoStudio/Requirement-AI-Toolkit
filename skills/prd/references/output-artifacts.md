# Storybook 输出与项目契约

平台项目采用双仓库：资料仓库 `requirements/<requirement_id>/prd.md` 保存业务正文及验收记录；原型仓库保存 `prototype.yaml`、`package.json`、`package-lock.json`、`apps/<app>/.storybook`、页面/组件/Stories、`packages/prototype-sdk`、`packages/prototype-player` 和每需求四类 YAML。

需求包固定为 `requirements/<requirement_id>/{manifest,annotations,scenarios,walkthrough}.yaml`。不按 App 拆需求目录，不复制 PRD 正文。manifest 引用资料仓库精确 SHA；技术离线样例可明确标记未绑定，但不能进入正式验收。

业务工作目录必须是对应项目的 Git 工作区/需求分支，不使用 outputs 副本。技能维护目录不是业务项目默认目录。技术验收样例仅在用户授权范围内使用 `examples/<name>/requirements`（资料）与 `examples/<name>/prototype`（源码），后续导入平台双仓库时保持身份与来源，不谎称本地样例已正式合并发布。

按需保存 Markdown 原始需求、业务模型、PRD、BDD（Gherkin 围栏）、流程（Mermaid 围栏）和验证记录；沿已有命名，不强制编号或无内容的文档。原型由 Stories 组织，不生成 `prototypes/high/<flowId>.html`、低模目录或 HTML 清单。build 输出 HTML/CSS/JS 是合法静态产物，不能作为源码唯一来源。

当前 SDK、播放器和项目模板从用户指定的平台服务路径读取；不得复制整个平台到技能仓库。模板更新只影响新项目，历史产物不覆盖。密钥、缓存、node_modules、构建输出和浏览器证据按项目规则忽略，验收结论注明实际证据与提交。
