# HTML 设计治理

以当前需求输出目录作为交付边界；同一产品的已批准设计系统可复用，记录实际来源与版本。设计资产先在 design-system/ 实现并评审，再供高模使用。

- Foundations：tokens.css 中的语义 CSS 变量，涵盖颜色、字体、间距、圆角、阴影。
- Components：components.css 与按需 components.js 中的可复用组件及状态。
- Patterns / View Templates：稳定的业务组合与页面壳层，用共享类、模板或渲染函数实现，记录文件和 selector；无需为分类创建空文件。
- design-system/index.html 展示已实现的资产及其状态，不能只在清单中声明批准。

每个流程有独立目标、入口和终态。主流程及服务于同一目标的异常、空错状态在同一入口演示。低高模共享 flowId，每种保真度只有一个正式路径；修复与迭代原位更新。用户明确要求保留旧版时才归档，归档不列为第二个正式入口。

## 清单

`03-html-design-manifest.json` 示例：

```json
{
  "schemaVersion": 1,
  "productDomain": "demo",
  "designSystem": {
    "status": "approved",
    "assets": [
      {"id": "tokens", "type": "tokens", "path": "design-system/tokens.css", "selector": ":root", "status": "approved"},
      {"id": "button", "type": "component", "path": "design-system/components.css", "selector": ".button", "status": "approved"}
    ]
  },
  "flows": [
    {"flowId": "login", "flowName": "登录", "entries": {"low": "prototypes/low/login.html", "high": "prototypes/high/login.html"}}
  ]
}
```

未生成的入口使用空字符串；首次 preflight 不得预填待创建路径为已有入口。status 为 absent、candidate 或 approved；低模不要求批准视觉资产。资产 ID 唯一，type 为 tokens、component、pattern、view-template；同一共享文件允许多个不同 selector。

## 校验与审计

脚本校验产品身份、流程唯一性、入口相对路径、创建/更新策略与高模资产准入；postwrite 还验证登记的文件存在。它不解析浏览器 DOM，也不能自行证明用户批准或资产使用时间。

高模评审必须另查实际源代码、CSS 引用、DOM 与截图：依赖已登记且批准；关键样式来自语义 token；无未说明的样式覆盖或未登记组件；新增资产先完成确认再使用；低高模 screenId 与业务状态对应。将实际证据和修复结果保存到评审 HTML。不能用手填零计数冒充审计。
