# 原型结构与布局快照规范

低模、高模生成与迭代均适用。HTML 是可运行原型，结构导出表达业务语义，布局快照记录特定环境中的实际渲染结果；三者通过稳定 ID 关联。

## 语义与标识

- 保留语义化 HTML：按内容使用 main、nav、section、form、label、button、table 等元素。不得为了获得坐标，把整页转换为大量无意义的绝对定位元素。
- 每个页面/屏幕根节点同时使用 `id="<screenId>"` 和 `data-screen-id="<screenId>"`；screenId 在同一流程内唯一，低高模和迭代保持一致。
- 重要交互元素（按钮、链接、输入、选择、弹窗操作等）使用 `data-element-id`，在 screenId 内唯一；完整定位键为 flowId + screenId + elementId。元素的 DOM id 在文档内唯一，用于 label、锚点和 ARIA 引用。
- elementId 来自业务用途，不用坐标、显示文案、数组序号或随机值生成。重复行使用稳定模拟业务键；相同业务操作在低高模沿用 ID。新增或删除操作同步更新导出。
- `data-component-id` 标记复用的组件定义；组件实例另用稳定 instanceId 标识，不能把共用的 componentId 当作实例唯一键。

## 终端与布局配置

PrototypeSpec 的 `terminalProfiles` 记录 profileId、终端类型、viewport（width/height，CSS px）、deviceScaleFactor 和 layoutMode。layoutMode 为 fixed、fluid 或 hybrid，可按 screenId/区域配置覆盖；同一原型允许三种布局共存。

fixed 表示固定尺寸的布局约束，不意味着所有后代绝对定位；fluid 使用正常文档流、Flex/Grid 等适应空间；hybrid 可组合固定侧栏与流式内容等。根据终端配置实现并验证，不统一强制某一种布局。未指定终端时记录采用的默认配置，不把假设写成已确认业务要求。

## 结构导出

每个流程/保真度生成与 HTML 同目录的 `<flowId>.structure.json`，包含 schemaVersion、flowId、fidelity、sourceRevision、screens、componentTree、elements、interactions。sourceRevision 为本次 HTML 与相关本地 CSS/JS 内容的摘要标识，快照使用同一标识，源文件变化后重新导出。

- screens：screenId、名称、根实例、已确认状态和入口锚点。
- componentTree：实例的 instanceId、componentId（无复用定义时可为空）、parentInstanceId、screenId、语义类型和关联 elementId；保留业务容器层级，不把每个无语义包装节点当组件。
- elements：screenId、elementId、所属实例、HTML 标签、角色、可访问名称、业务含义和规则 ID。角色与名称需对应真实 HTML/ARIA，不编造语义。
- interactions：interactionId、触发元素的 screenId/elementId、事件、前置条件、来源状态、目标 screenId/状态、效果及 ruleId。关闭、返回、提交错误等分支按已确认规则导出；未决规则保留为开放问题。

结构从实际 HTML 标记和原型使用的交互定义导出，并与 PrototypeSpec 核对；不能仅复制计划中的树或交互而不检查实际实现。

## 自动布局快照

构建流程在写入/更新原型后自动安排一次浏览器采集，并落盘到 `snapshots/<fidelity>/<flowId>/<profileId>/<screenId>--<stateId>.json`。采集由生成流程触发，不要求评审者逐个手工测量。按 terminalProfiles 指定视口和已确认关键状态采集，记录失败与待采集项；浏览器不可用时不得用 CSS 声明值或模型推测冒充实测快照。

1. 设置视口与缩放参数，打开目标入口、切换 screen/state，等待字体、图片和布局稳定；记录滚动位置。动画按明确的稳定时刻采集，动画过程另行浏览器验证。
2. 对屏幕、组件实例和重要交互元素调用 `getBoundingClientRect()`，保存 x、y、width、height、top、right、bottom、left（CSS px，相对当前视口）。同时记录 window 滚动量及嵌套滚动容器的滚动量；不可把视口坐标直接当整页坐标。
3. 使用 `getComputedStyle()` 提取 display、position、zIndex、visibility、opacity、overflow、transform、boxSizing、margin、padding、gap、字体、行高、颜色、背景、边框和圆角等关键最终样式；保留 auto、none 等实际值。
4. 记录 DOM 父子关系/顺序、组件实例层级及形成堆叠上下文的相关样式。z-index 只在所属堆叠上下文中有意义，不能当成整个页面的全局遮挡排序。
5. 保存 schemaVersion、sourceRevision、flowId、fidelity、profileId、screenId、stateId、采集时间、浏览器版本、viewport、deviceScaleFactor、滚动信息和元素记录。元素记录通过 screenId/elementId 或 instanceId 关联结构树。隐藏或未渲染节点显式标记，不把零矩形当成可见元素；矩形也不等同于实际未遮挡的可见区域。

这些 API 读取布局结果，不要求改写布局方式。快照是指定视口和状态的测量值，不是响应式布局的替代品；HTML、样式、资源、终端配置或状态变化后重新采集相应快照。

## 读取与验证

AI 默认先读取 PrototypeSpec、structure.json 和匹配 sourceRevision/profile/state 的快照，定位业务元素、关系和几何样式。读取已有设计无需反复打开浏览器；快照缺失或过期时安排生成阶段的采集，并标明当前证据不足。

浏览器用于自动采集和必要的视觉、动画、交互验证。若环境提供 Playwright MCP 的可访问性快照能力，优先用角色与名称检查可操作元素及内容；它不能替代组件业务树、实际几何样式或视觉校验。简单交互也可通过结构化浏览器操作结果核对，不必每一步都截图。

验收核对六项：语义化 HTML；稳定且唯一的 ID；配置视口下真实生成的布局快照；与实际原型一致的组件树及交互关系；默认结构化读取；按终端配置支持固定、流式和混合布局。结构与引用检查通过、浏览器实测通过、用户最终验收分别记录。现有治理脚本只覆盖其已实现的检查，不将上述契约写入文档等同于自动校验已实现。
