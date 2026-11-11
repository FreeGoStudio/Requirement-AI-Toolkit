# 当前仓库契约（v2）

在 `working/<slug>/requirement.json` 保存身份和非敏感发布目标。由 AI 初次建立；产品经理不需要编辑 JSON。字段示例中的地址只是占位，必须使用项目实际配置。publicationId 用随机 32 位小写十六进制标识，普通克隆保持，创建新需求时重建。发布前所有文件已提交并推送。

```json
{
  "schemaVersion": 2,
  "requirementId": "order-approval",
  "publicationId": "0123456789abcdef0123456789abcdef",
  "repository": "ssh://git@example.internal:2222/team/requirements.git",
  "siteSource": "docs",
  "prdPath": "docs/requirements/order-approval/index.md",
  "publicationTarget": {
    "host": "prototype.internal",
    "remoteRoot": "/var/www/_tmp/prototypes",
    "baseUrl": "http://prototype.internal:8080/_tmp/prototypes"
  },
  "documents": [
    {
      "path": "docs/requirements/order-approval/index.md",
      "links": [{"flowId": "approve", "label": "审批异常状态", "fragment": "approve-error", "query": {"mode": "demo"}}]
    },
    {"path": "working/order-approval/index.md"}
  ]
}
```

仅登记已存在且有唯一 prototype-links:begin/end 标记区的 Markdown。省略 links 时列出当前清单全部高模入口。未生成原型前可暂不登记链接区域；不虚构流程入口。

仓库根目录通过 Git 获取，适用于普通 checkout 与 worktree。所有 JSON 文件引用均为仓库根目录相对路径：

- 清单 `schemaVersion: 2`；资产 path、flows.entries.high，例如 `working/order-approval/prototypes/high/approve.html`。
- 规格 sourceArtifacts 包含 `docs/requirements/order-approval/index.md` 和相关过程文档；interfaceBaseline.artifactPath、参考 evidence 等同样按仓库根解析。
- 不兼容旧版清单、低模入口、绝对路径和本地 outputs 副本。遇到旧格式提示用户要求 AI 迁移，不自动补低模或重建业务确认。

原型内部 HTML/CSS/JavaScript 仍使用文件相对资源链接。`-OutputDirectory` 指向本需求 `working/<slug>`，不是仓库根或 docs。发布器只收集高模入口及实际依赖。

`.prototype-publication.json` 是忽略提交的本机运行状态。`publication-record.json` 是脚本生成的可提交记录，含 publicationId、sourceCommit、packageDigest、url、version、status；不含服务器凭据。源码提交与记录提交分开，避免循环。换机首次发布仍使用 requirement.json 的 publicationId；目标不匹配时先核对配置。
