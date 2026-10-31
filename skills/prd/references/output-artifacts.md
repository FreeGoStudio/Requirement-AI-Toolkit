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

原型按流程与保真度各保留一个正式入口，迭代更新原路径。旧任务续接时先读原文与确认记录，保留历史证据；建立当前 HTML 清单，不把旧格式产物当作已经生成的 HTML。

`02-reference-decision.html` 记录既有原型检查、可复用参考、用户无参考继续的决定，以及高模采用的视觉来源或方向选择。用户截图可复制到 references/；Knowledge 截图保留绝对路径、screenId 与实际检查记录。

浏览器或截图能力缺失时可保存已授权文件和静态校验结果，将实际渲染与交互列为待验证；不得将其标记为通过，也不推进依赖该验收的下一阶段。
