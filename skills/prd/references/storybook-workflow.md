# Storybook 生成、校验与交付

## 生成

1. 核对平台服务目录、目标业务仓库/分支、project/workspace 身份及依赖锁。基于平台当前 `platform/templates/prototype` 初始化新工程，按需要替换示例业务；已有工程只补缺口，不覆盖用户源码。
2. 每个 App 一个 `.storybook/main.js` 与静态输出。根 `npm run build` 构建所有应用及播放器；当前 Runner 使用预装依赖和根 package-lock.json 摘要，依赖变化先更新受控 Runner。不要同时创建 pnpm 锁文件。
3. `prototype.yaml` 的 screens 映射业务 route 到稳定 story_id。CSF 显式 id + 稳定导出名；需求 YAML 仅使用 app + route + element_id/功能视图。所有标注与 walkthrough 必须引用现存页面、场景、语义目标。
4. 应用壳 Story 支持连续流程；不为每个输入/弹窗强制拆 Story。使用 SDK connect 并声明有效 initialRoute；Manager/直接画布使用独立模拟状态，平台上下文握手失败不能降级放行。跨应用数据通过 SDK patch 与 appStates，平台播放器持有状态。输入草稿如需跨重挂载保留，也必须进入会话状态。
5. 首次进入、场景选择、重置、外层刷新初始化；切页、换 Story、内层 iframe 刷新保持会话；新窗口独立。范围提示用于评审聚焦，不禁用未标注控件。

## 验证

读取平台 config/artifacts 校验约定，运行需求包和应用引用检查；全部 App 真实构建后检查 index.json 中 Story 存在。用平台 Artifacts.collect 收集完整输出，verify 检查摘要，不自行从单 HTML 扫描依赖。

浏览器检查实际播放器 + Storybook：新增/修改业务状态、跨 App 和 Story、返回、iframe 重载、Manager 与直接画布、定位/越界、重置/新窗口、固定子路径与刷新。current 切换后旧会话必须固定资源。历史恢复使用原包，不能重建冒充原批准产物。技术通过不等于人工业务批准。

## 平台交付

正常接入后由 Plane 工作项映射需求分支，相关源码提交自动生成成功开发预览。明确发起评审才创建冻结集成候选，实际人工在 Plane 按通知逐项通过/驳回；只有明确交付授权后才自动合并并发布同一完整包。技能不代签、不绕过 human 门禁。

平台未配置或自动化尚未启用时，报告具体缺项和实际进度，可继续本地生成/验证；不要宣称自动发布成功。不能使用旧 `prototype-publish -Mode Html/Prd` 的裁剪、链接改写通道交付平台包。

只发布各应用完整 storybook-static、播放器、配置与运行需求资料，不上传整个源码工作区。发布阶段不重建、不裁剪、不改写资源；固定 build_id + 摘要，前后核验一致。通过平台现有预览、归档、权限和恢复能力交付，禁止另建同名部署服务或覆盖其他项目 current。
