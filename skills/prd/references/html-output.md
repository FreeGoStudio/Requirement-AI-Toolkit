# HTML 原型生成与验证

只有原型使用 HTML。需求、流程图、BDD、设计系统说明、评审和交付入口全部使用 Markdown，链接按 `gitlab-delivery.md` 维护。

## 本地原型

直接编写 HTML/CSS/JavaScript 文件；默认静态多页，无需构建或远程服务。每份 HTML 包含 doctype、lang="zh-CN"、UTF-8 charset、viewport、明确 title 与正文标题。使用相对路径引用资源，复制原型及依赖后仍能打开。默认支持 file://；不使用需要服务器的 fetch 本地 JSON、ES module 或远程 CDN。确需服务器或项目已有技术栈时说明启动命令与依赖，并验证实际启动。

需求文本须转义，不能直接作为脚本或 HTML 执行。长表格允许横向滚动，窄屏正文不截断。不为返回需求文档而生成 HTML 文档副本。

## 可操作原型

每个流程一个入口；使用锚点或本地状态切换表示步骤。主按钮、导航、表单、弹窗和返回操作必须产生可观察反馈，避免仅画静态按钮。按已确认规则展示成功、空、错误、权限等状态；提供可重置的模拟数据或场景选择。明确标识演示数据，默认不调用真实接口、不收集真实凭据、不提交生产数据。

低模用灰阶线框；高模引用设计系统 CSS 自定义属性与共享组件。以稳定 `id` 和 `data-screen-id` 标记页面区域，以 `data-component-id` 标记组件使用点。组件代码与文档登记同步，不用仅填写清单代替真实复用。

## 验证

1. 生成前运行 `Test-DesignGovernance.ps1 -ManifestPath ... -PrototypeSpecPath ... -Phase preflight`；写入后更新清单并运行同一命令的 postwrite 模式。
2. 检查 HTML 资源与内部链接实际存在、正文完整、中文无乱码、页面能离线打开；检查 PRD 与 BDD 的规则对应关系。
3. 在可用浏览器中打开入口及流程页，记录视口，检查桌面与窄屏布局、并实际执行成功、异常、恢复和重置路径。检查键盘焦点、表单标签、弹窗关闭与控制台错误。
4. 捕获完整页面与关键状态截图，实际查看，再写评审结果。每项记录 pass/fail/not-applicable、证据路径和限制；无法操作浏览器时标记待验证。

静态清单验证不证明 DOM、样式或交互正确。只有真实操作与截图检查后才记录 browser-verified；用户明确验收后才记录 accepted。

## Markdown 文档与发布

流程图在 `07-flowchart.md` 使用 Mermaid 围栏；检查目标渲染器支持，不支持时附本地 SVG/图像。BDD 在 `08-bdd.md` 使用 Gherkin 围栏，首行包含 `# language: zh-CN`。PRD、BDD、原型保持规则 ID、screenId 与状态名一致。

每次原型更新通过静态检查后按 `remote-publishing.md` 发布；远程访问与浏览器交互分别检查。原型资源使用可静态识别的相对路径，不依赖本机绝对路径。远程导航只列原型；不能上传需求文档来消除断链。

所有文档用普通 Markdown 链接；本次发布成功且 HTTP 校验通过后才引用当前服务器 URL。变更开始或发布失败时将受影响文档链接标为待发布；本地文档可保留相对原型链接，提交 GitLab 的文档不得留下本机链接。按 `gitlab-delivery.md` 更新所有关联文档，不能只更新 PRD。

旧版 HTML 文档的 SyncLinks 兼容能力仍可用于历史产物，但不处理 Markdown；新任务不要求生成 HTML 文档或 prototype-links.js。发布器内部辅助文件不作为文档交付。
