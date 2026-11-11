# Storybook 原型管理平台

**维护位置已调整（2026-11-11）**：后续平台实现请在 `D:/workspace/ai-native-platform/services/prototype-platform` 继续。本目录保留迁移前源码与提交记录；当前仓库继续负责需求和原型技能。运行数据暂保留原位，不要删除 `platform/.local`。平台服务的新维护入口和迁移边界见目标仓库的 README.md、IMPORT.md。

已新增本机可运行平台，完整启动、操作、Codex 配置与恢复说明见 [操作手册](OPERATIONS.md)。管理入口 http://127.0.0.1:3077，Nginx 持续原型入口 http://127.0.0.1:3079/projects/prototype-lab/current 。先登录工作台再访问原型。

2026-11-11 首次真实闭环：用户确认短信测试候选后，GitLab MR !1 已 fast-forward 合并，原候选完整包发布成功。源提交 `8ac495c56286d6da182e294ef14ed681d3cea0b2`，包 `build-7d01c504-88b0-4f97-87fd-7663c5088550`。第二个项目的双仓库已实际创建。其他完整业务剧本仍须逐项签收；Codex key 已配置，但实际调用被组织赠送额度规则拒绝，详情见操作手册。

实施依据：[原型平台方案](../docs/requirements-html-publishing-plan.md)。平台源码与业务双仓库分离，业务原型不放在工具仓库中。使用本机 GitLab/Plane 测试；不修改已有平台项目或公网配置。

## 初始环境核验（2026-11-11，实施前记录）

- Node 24.15.0、npm 11.16.0、Git 2.54.0.windows.1 可用。依赖版本由根目录 package-lock.json 固定。
- GitLab `http://127.0.0.1:8929` 登录入口 200，已有只读身份调用版本 API 成功，版本 19.5.1。健康探针路径在当前部署返回 404，因此使用登录入口做连通性检查，不冒充健康检查。
- Plane `http://127.0.0.1:8088` 实例接口 200，既有测试身份成功登录并读取 `local-workflow-lab`。实际项目能力需后续验证。
- `http://127.0.0.1:6006` 是已运行的独立 Storybook 10.6.7 示例，索引可读取；不等于本平台的跨应用演示已实现。
- `D:/workspace/ai-native-platform` 保存已有部署、Go plane-sync 和架构资料；未发现本方案需求原型编排实现。其未提交改动不属于本次提交。
- 现有 GitLab 测试仓库不满足本方案 fast-forward 约束，其中旧 TodoList 仓库标记待删除；本次使用独立测试仓库，不改旧业务记录。
- 认证材料只从本机受控配置读取，不写入仓库。后续 Runner、权限门禁、发布及验收结果见上方实施结果及操作手册；本节保留最初核验时的环境事实。

```powershell
npm ci
npm run doctor
npm test
```

doctor 仅报告工具和 HTTP 入口，不授予权限，也不把服务连通报告为交付完成。
