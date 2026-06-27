# 输出产物

每个阶段产物都必须持久化到磁盘，不得只依赖聊天输出。

## 输出目录

如果用户提供了输出目录，使用该目录。

如果用户没有提供输出目录，在当前 workspace 下创建目录：

```text
outputs/product-requirements/<yyyyMMdd-HHmm>-<short-requirement-slug>/
```

规则：

- `<yyyyMMdd-HHmm>` 使用本地时间。
- `<short-requirement-slug>` 从产品或功能名称派生。
- slug 只能使用小写 ASCII 字母、数字和连字符。
- 如果产品名称不清楚，使用 `new-requirement`。
- 同一需求线程的后续阶段复用同一个输出目录。
- 阶段回复中必须包含输出目录的绝对路径。

## 必要文件

随着阶段推进创建文件：

```text
00-raw-requirement.md
01-clarification-questions.md
02-business-model.md
02-reference-decision.md
03-low-fidelity-prototype-spec.json
04-low-fidelity-review.md
05-prd.md
06-flowchart.mmd
07-bdd.feature
08-high-fidelity-prototype-spec.json
09-high-fidelity-review.md
references/
index.md
```

不得为未来阶段创建占位文件。只有到达对应阶段时，才创建或更新对应文件。

如果用户提供截图或图片参考，且文件可在本地访问，将副本保存到 `references/`；如果不可本地访问，在 `index.md` 中记录其 URL 或标识符。

在任何原型生成前，创建或更新 `02-reference-decision.md`，内容包括：

- 是否已检查既有 Figma 页面/原型。
- 是否找到相关既有原型。
- 是否已请求截图/参考图。
- 用户决策：使用既有原型、已提供参考、无参考继续、为高保真使用视觉来源，或接受风险并在无视觉参考下继续高保真。
- 已接受视觉参考的路径、URL 或标识符。
- 对于高保真，说明低保真是否仅作为流程/结构参考，以及将由什么视觉来源指导 UI。

## 索引文件

维护 `index.md` 作为阶段清单。每当创建或更新阶段文件时，同步更新它。

使用以下结构：

```markdown
# <需求名称>

- 输出目录: `<absolute path>`
- 当前阶段: <stage name>
- Figma: <not-started | unavailable | low-fidelity-created | high-fidelity-created>

## Artifacts

| Stage | File | Status |
| --- | --- | --- |
| Raw requirement | `00-raw-requirement.md` | done |
```

## 回复要求

每次阶段回复结尾都必须包含：

- 当前阶段。
- 下一个 gate 是否因等待确认而阻塞。
- 输出目录的绝对路径。
- 本阶段创建或更新的文件。

## Figma 失败处理

如果 `figma-console-mcp` 不可用，仍然保存：

- 对应的 `PrototypeSpec` JSON 文件。
- 在 `index.md` 中写入简短说明，将 Figma 标记为 `unavailable`。

然后停止，并用中文要求用户连接 Figma 桥接插件。
