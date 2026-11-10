# HTML 生成与验证

## 本地交付

直接编写 HTML/CSS/JavaScript 文件；默认静态多页，无需构建或远程服务。每份 HTML 包含 doctype、lang="zh-CN"、UTF-8 charset、viewport、明确 title 与正文标题。使用相对路径引用本包资源，复制整个目录到其他位置后仍能打开。默认支持 file://；不使用需要服务器的 fetch 本地 JSON、ES module 或远程 CDN。确需服务器或项目已有技术栈时说明启动命令与依赖，并验证实际启动。

文档采用语义化标题、目录锚点、表格和可打印样式。需求文本须转义，不能把用户文本直接作为脚本或 HTML 执行。HTML 页面保留回到 index.html 的链接。长表格允许横向滚动，窄屏正文不截断。需求文档不是原型截图集合，应完整包含规则、状态、异常、权限、验收标准与开放问题。

流程图提供本地内联 SVG 或本地渲染后的图像，并附 Mermaid 源文件链接；不用 CDN 渲染作为唯一可见内容。BDD 页面显示中文场景，源文件第一行使用 `# language: zh-CN`。PRD、BDD、原型使用一致的规则 ID、screenId 和状态名，链接到实际存在的锚点。

## 可操作原型

每个流程一个入口；使用锚点或本地状态切换表示步骤。主按钮、导航、表单、弹窗和返回操作必须产生可观察反馈，避免仅画静态按钮。按已确认规则展示成功、空、错误、权限等状态；提供可重置的模拟数据或场景选择。明确标识演示数据，默认不调用真实接口、不收集真实凭据、不提交生产数据。

低模用灰阶线框；高模引用设计系统 CSS 自定义属性与共享组件。以稳定 `id` 和 `data-screen-id` 标记页面区域，以 `data-component-id` 标记组件使用点。组件代码与文档登记同步，不用仅填写清单代替真实复用。

## 验证

1. 生成前运行 `Test-DesignGovernance.ps1 -ManifestPath ... -PrototypeSpecPath ... -Phase preflight`；写入后更新清单并运行同一命令的 postwrite 模式。
2. 检查 HTML 资源与内部链接实际存在、正文完整、中文无乱码、页面能离线打开；检查 PRD 与 BDD 的规则对应关系。
3. 在可用浏览器中打开入口及流程页，记录视口，检查桌面与窄屏布局、文档打印预览，并实际执行成功、异常、恢复和重置路径。检查键盘焦点、表单标签、弹窗关闭与控制台错误。
4. 捕获完整页面与关键状态截图，实际查看，再写评审结果。每项记录 pass/fail/not-applicable、证据路径和限制；无法操作浏览器时标记待验证。

静态清单验证不证明 DOM、样式或交互正确。只有真实操作与截图检查后才记录 browser-verified；用户明确验收后才记录 accepted。

## 已配置 Linux 发布时

### 文档原型链接

所有交付根目录的 HTML 文档（含 index、PRD、流程图和 BDD）共用 `prototype-links.js`。基础地址只保存在 `window.PRD_PROTOTYPE_BASE_URL`，内容是服务器地址、临时前缀与发布 ID，例如 `http://服务器:端口/_tmp/prototypes/<发布ID>`；页面不能各自写死服务器地址。状态由 `window.PRD_PROTOTYPE_PUBLISH_STATUS` 表示 published 或 pending。

文档仅保存相对原型路径及原有页面/状态锚点，初始 href 始终为本地回退：

```html
<a href="prototypes/low/login.html#login-error"
   data-prototype-path="prototypes/low/login.html#login-error">登录失败状态</a>
<script src="prototype-links.js" data-prototype-link-runtime defer></script>
<p data-prototype-publication-status>原型待发布，当前链接使用本地文件。</p>
```

同级 prototype-publish 的 `Invoke-PrototypePublish.ps1 -Action SyncLinks -OutputDirectory '<交付目录>'` 会根据发布记录生成共享脚本，绑定根目录文档中指向清单原型的现有链接。查询参数与锚点保留，其他文档间链接不变。新增 PRD/BDD 等文档后再次 SyncLinks 即可复用已有发布结果，无需重新上传原型。修改原型前用 `-LinksPending` 将状态置为待发布；未配置服务器也可仅用本机 Python 执行 SyncLinks，不连接服务器。

只有本次发布成功且 HTTP 校验通过时才使用服务器 URL；开始发布、未配置、上传失败或回退后均清空当前基础地址，页面链接回到本地并显示“待发布”。历史成功 URL 仅作为发布记录保留，不能冒充本次内容已发布。无 JavaScript 时静态 href 仍可打开本地文件。共享脚本与文档一起交付，不用 fetch JSON，兼容 file://。

本地文件仍是生成与评审依据。每次原型更新通过静态检查后按 `remote-publishing.md` 发布；远程访问检查与浏览器交互检查分别记录。原型引用包内资源使用相对路径，运行时资源使用可静态识别的字面量路径；不要依赖本机绝对路径。原型返回本地 `index.html` 的链接会在发布副本中指向仅原型导航，其他未发布文档链接必须明确处理，不能把文档一并上传来消除断链。
