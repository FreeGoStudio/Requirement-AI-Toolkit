# 输出产物

全部 Markdown 的仓库同步、附件路径和原型链接见 `gitlab-delivery.md`。本地输出目录保持下表结构；交付 GitLab 时，只有 `06-prd.md` 进入 VitePress 实际源目录，其余 Markdown（包括各级 index.md）全部放入源目录外的 working/<slug>/。两类文档都提交，不将整个输出目录原样复制到站点。

默认目录为 `<workspace-root>/outputs/product-requirements/<yyyyMMdd-HHmm>-<short-requirement-slug>/`，使用用户当地时间；slug 使用小写 ASCII、数字与连字符。用户指定目录时优先使用。后续阶段复用目录，不预建空白文件。

| 阶段 | 产物 |
| --- | --- |
| 接收 | 00-raw-requirement.md、01-clarification-questions.md |
| 收敛 | 02-business-model.md |
| 需求 | 06-prd.md、07-flowchart.md（Mermaid 围栏）、08-bdd.md（Gherkin 围栏） |
| 原型准备 | 02-reference-decision.md、03-html-design-manifest.json、03-interface-baseline.json |
| 方向（需要时） | 09-visual-direction-spec.json、visual-directions/index.md、prototypes/visual-directions/<directionId>.html、10-visual-direction-review.md |
| 设计系统 | design-system/index.md、design-system/tokens.css、design-system/components.css、design-system/components.js（需要交互组件时）、11-design-system-review.md |
| 高模 | 12-high-fidelity-prototype-spec.json、prototypes/high/<flowId>.html、13-high-fidelity-review.md、screenshots/ |

所有非原型文档均为 UTF-8 Markdown，包括需求、探索、业务模型、流程图、BDD、设计系统说明、评审及交付入口。JSON 清单/规格/发布状态仅供现有工具读取，CSS/JavaScript 与图像仅作为原型依赖或证据，不作为文档交付。`index.md` 是交付入口，随阶段更新当前状态、已生成文件的相对链接、确认记录、实际错误及待验收条件。只链接已存在文件，明确区分 generated、validated、browser-verified、accepted。

探索不新增必交文件：`01-clarification-questions.md` 记录探索结论、事实来源、待验证假设及有必要的方案比较；`02-business-model.md` 记录采纳方案、范围、决策来源和确认状态。只记录有内容的部分，不预建空表。

业务模型确认前可以在上述文档中整理规则、流程及验收场景，明确标记“待确认草案”，与已确认内容分开。正式 `06-prd.md`、`07-flowchart.md`、`08-bdd.md` 及配套源文件仍在业务模型确认后生成，保留既有文件编号以兼容链接，不再生成 04/05 低模产物。探索阶段使用简短内容即可，完整图文格式用于正式交付。

原型按流程与保真度各保留一个正式入口，迭代更新原路径。旧任务续接时先读原文与确认记录，保留历史证据；建立当前 HTML 清单，不把旧格式产物当作已经生成的 HTML。旧任务已确认内容直接沿用，不补做历史方案比较；只处理影响当前决策的新不确定性。

`02-reference-decision.md` 记录既有原型检查、可复用参考、用户无参考继续的决定，以及高模采用的视觉来源或方向选择。用户截图可复制到 references/；Knowledge 截图保留绝对路径、screenId 与实际检查记录。

浏览器或截图能力缺失时可保存已授权文件和静态校验结果，将实际渲染与交互列为待验证；不得将其标记为通过，也不推进依赖该验收的下一阶段。

文档使用普通 Markdown 原型链接，按 `gitlab-delivery.md` 维护发布状态；不依赖 `prototype-links.js`，不生成 HTML 文档副本。

启用 Linux 发布时另保存 `.prototype-publication.json`，包含稳定发布 ID、本目录身份、最近成功版本和最近尝试结果，不包含凭据，也不上传。复用输出目录即复用 URL；复制到另一目录生成新的发布 ID。上一成功 URL 保留在历史记录中，不能作为本次失败后的文档主链接。远程入口仅列出原型，不发布本地交付入口、需求文档、评审记录或截图。
