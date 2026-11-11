# 原型管理平台

实施依据：[原型平台方案](../docs/requirements-html-publishing-plan.md)。平台源码与业务双仓库分离，业务原型不放在工具仓库中。使用本机 GitLab/Plane 测试；不修改已有平台项目或公网配置。

## 环境核验（2026-11-11）

- Node 24.15.0、npm 11.16.0、Git 2.54.0.windows.1 可用。依赖版本由根目录 package-lock.json 固定。
- GitLab `http://127.0.0.1:8929` 登录入口 200，已有只读身份调用版本 API 成功，版本 19.5.1。健康探针路径在当前部署返回 404，因此使用登录入口做连通性检查，不冒充健康检查。
- Plane `http://127.0.0.1:8088` 实例接口 200，既有测试身份成功登录并读取 `local-workflow-lab`。实际项目能力需后续验证。
- `http://127.0.0.1:6006` 是已运行的独立 Storybook 10.6.7 示例，索引可读取；不等于本平台的跨应用演示已实现。
- `D:/workspace/ai-native-platform` 保存已有部署、Go plane-sync 和架构资料；未发现本方案需求原型编排实现。其未提交改动不属于本次提交。
- 现有 GitLab 测试仓库不满足本方案 fast-forward 约束，其中旧 TodoList 仓库标记待删除；本次使用独立测试仓库，不改旧业务记录。
- 认证材料只从本机受控配置读取，不写入仓库。真实 Runner 隔离、权限门禁、原型发布与业务验收仍待实现和验证。

```powershell
npm ci
npm run doctor
npm test
```

doctor 仅报告工具和 HTTP 入口，不授予权限，也不把服务连通报告为交付完成。
