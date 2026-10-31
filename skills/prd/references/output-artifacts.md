# HTML 输出产物

默认目录为 `<workspace-root>/outputs/product-requirements/<yyyyMMdd-HHmm>-<short-requirement-slug>/`，使用用户当地时间；slug 使用小写 ASCII、数字与连字符。用户指定目录时优先使用。后续阶段复用目录，不预建空白文件。

| 阶段 | 产物 |
| --- | --- |
| 接收 | 00-raw-requirement.html、01-clarification-questions.html |
| 收敛 | 02-business-model.html、02-reference-decision.html |
| 低模 | 03-html-design-manifest.json、03-interface-baseline.json、04-low-fidelity-prototype-spec.json、prototypes/low/<flowId>.html |
| 反查 | 05-low-fidelity-structure-review.html、screenshots/ |
| 需求 | 06-prd.html、07-flowchart.html、07-flowchart.mmd、08-bdd.html、08-bdd.feature |
| 方向（需要时） | 09-visual-direction-spec.json、visual-directions/index.html、10-visual-direction-review.html |
| 设计系统 | design-system/index.html、design-system/tokens.css、design-system/components.css、design-system/components.js（需要交互组件时）、11-design-system-review.html |
| 高模 | 12-high-fidelity-prototype-spec.json、prototypes/high/<flowId>.html、13-high-fidelity-review.html |

所有面向评审者的正文均为 UTF-8 HTML，JSON 与源文件作为辅助产物。`index.html` 是交付入口，随阶段更新当前状态、已生成文件的相对链接、确认记录、实际错误及待验收条件。只链接已存在文件，明确区分 generated、validated、browser-verified、accepted。

探索不新增必交文件：`01-clarification-questions.html` 记录探索结论、事实来源、待验证假设及有必要的方案比较；`02-business-model.html` 记录采纳方案、范围、决策来源和确认状态。只记录有内容的部分，不预建空表。

低模前可以在上述文档中整理规则、流程及验收场景，明确标记“待确认草案”，与已确认内容分开。正式 `06-prd.html`、`07-flowchart.html`、`08-bdd.html` 及配套源文件仍在低模确认后生成，编号和正式产出时机不变。探索阶段使用简短内容即可，完整图文格式用于正式交付。

原型按流程与保真度各保留一个正式入口，迭代更新原路径。旧任务续接时先读原文与确认记录，保留历史证据；建立当前 HTML 清单，不把旧格式产物当作已经生成的 HTML。旧任务已确认内容直接沿用，不补做历史方案比较；只处理影响当前决策的新不确定性。

`02-reference-decision.html` 记录既有原型检查、可复用参考、用户无参考继续的决定，以及高模采用的视觉来源或方向选择。用户截图可复制到 references/；Knowledge 截图保留绝对路径、screenId 与实际检查记录。

浏览器或截图能力缺失时可保存已授权文件和静态校验结果，将实际渲染与交互列为待验证；不得将其标记为通过，也不推进依赖该验收的下一阶段。
