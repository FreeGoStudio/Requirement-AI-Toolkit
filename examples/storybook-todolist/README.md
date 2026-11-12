# Storybook TodoList 技术验收样例

技能来源：本仓库 storybook 分支的 skills/prd。requirements 保存样例 PRD，prototype 保存应用、Stories 与平台运行包源码；不是平台服务副本。平台构建、评审、发布由 ai-native-platform/services/prototype-platform 提供。

本地使用根 npm 锁文件和受控 Runner 构建。正式资料仓库、Plane 工作项与原型源码分支的精确关联以平台记录为准；此样例不是人工批准或生产交付证明。

## 2026-11-12 技术验证

平台 `platform/scripts/verify-todolist.mjs <本目录/prototype>` 使用真实受控 Docker Storybook 构建及 Chrome。新增、完成、删除和筛选、空白输入、跨应用设置、跨 Story 重挂载、草稿、内外层刷新、标注与越界、新窗口、场景重置、Manager/直接画布及桌面/390px 检查通过。固定指针测试使用同源码的两个不同 build_id，不宣称模拟了不同业务版本。

本地证据在平台忽略目录 `platform/.local/todolist-validation/verification.json`，完整静态包在该目录 artifacts。样例 manifest 的 UNBOUND_LOCAL_EXAMPLE 明确表示本地样例不绑定正式验收；导入隔离 GitLab 项目时已替换为资料仓库的真实 PRD 提交。真实 Plane 人工评审与授权交付仍须本人完成。
