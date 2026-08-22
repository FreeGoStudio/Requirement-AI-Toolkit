# 输出产物

每个阶段产物必须写入磁盘，不得只存在于聊天中。

## 输出目录

用户未指定时使用：

```text
outputs/product-requirements/<yyyyMMdd-HHmm>-<short-requirement-slug>/
```

- 时间使用本地时间。
- slug 只使用 lowercase ASCII、数字和连字符；产品不明确时使用 `new-requirement`。
- 同一需求任务复用同一目录。
- 阶段回复提供绝对路径。

## 新版产物

按阶段创建，不得预建占位文件：

```text
00-raw-requirement.md
01-clarification-questions.md
02-business-model.md
02-reference-decision.md
03-figma-design-manifest.json
03-interface-baseline.json
04-low-fidelity-prototype-spec.json
05-low-fidelity-structure-review.md
06-prd.md
07-flowchart.mmd
08-bdd.feature
09-visual-direction-spec.json
10-visual-direction-review.md
11-design-system-review.md
12-high-fidelity-prototype-spec.json
13-high-fidelity-review.md
references/
index.md
```

- `03-figma-design-manifest.json` 从首次 Figma preflight 起持续更新。
- `09`、`10` 只在没有可靠高模视觉来源时创建。
- `11-design-system-review.md` 在首次批准或后续资产扩展确认时创建/更新。
- 高模只能使用 `12`、`13` 新编号。

## 旧任务续接

旧目录中的 `09-high-fidelity-prototype-spec.json` 和 `10-high-fidelity-review.md` 只作为 legacy 产物读取，不重命名、不覆盖。续接高模前必须：

1. 只读重建 `03-figma-design-manifest.json`。
2. 通过四 Page、Flow Page 和资产治理检查。
3. 创建新版 `12-high-fidelity-prototype-spec.json`，不得直接复用旧规格调用 Figma。

## References

- 用户提供且可本地访问的截图复制到 `references/`；不可复制时在 `index.md` 记录 URL/标识符。
- workspace `Knowledge` 截图不复制；在 `03-interface-baseline.json` 记录绝对路径、screen ID、选择理由和实际检查状态。

## Reference Decision

`02-reference-decision.md` 记录：

- 既有 Figma 原型和视觉来源检查结果。
- 用户提供的参考及允许复用的方面。
- 低模无参考继续的明确决定。
- 高模使用 Approved Design System、外部视觉来源或视觉方向候选的路径。
- 高模不存在“无视觉参考接受风险直接继续”的状态。

## Index

`index.md` 必须同步记录当前阶段、Figma 状态、Design File、manifest 状态、当前 gate 和全部已创建产物。

Figma 状态使用：

```text
not-started | unavailable | architecture-initialized | migration-pending |
low-fidelity-created | visual-direction-pending | design-system-pending |
design-system-approved | high-fidelity-created
```

## 回复要求

每次完成阶段时列出：

- 当前阶段和下一 gate。
- Design File 与 Figma 状态（如适用）。
- 绝对输出目录。
- 本阶段创建或更新的文件。

## Figma Failure

preflight 或调用失败时仍保存已经允许生成的规格和 manifest，在 `index.md` 记录：工具未暴露、Bridge/session 失败、截图能力缺失或治理校验失败。然后停止，不得模拟结果或回退到其他 Figma 工具。
