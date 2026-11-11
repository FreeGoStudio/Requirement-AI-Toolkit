# 平台操作手册

## 本机环境

管理端 http://127.0.0.1:3077；原型源站 3078；Nginx 3079。GitLab 8929、Plane 8088。原有独立 Storybook 6006 未改动。当前只绑定回环，未修改远程环境或公网限制。

本机账号保存在忽略提交的 `.local/reviewer-login.json`。GitLab 资料项目 5、原型项目 6；工作台“新建项目”已经实际创建第二个隔离项目双仓库。Plane 标题和业务状态以服务端为准；平台不自动把工作项改为 Done。

## 启动与验证

要求 Node 24、Git、Docker Desktop Linux 容器、Chrome。根目录和模板分别使用固定 npm 锁文件。

```powershell
npm ci
npm run doctor
npm test
npm run build
docker build -f platform/runner/Dockerfile -t prototype-platform-runner:10.6.7 .
npm start
docker compose -f platform/deploy/compose.yaml up -d
npm run verify:template
```

配置读取 `platform/config.local.json` 或 `PLATFORM_CONFIG`，参考 `config.example.json`，不要覆盖既有配置。数据在 `.local`。管理 API 和原型不同源；每个静态资源请求都验证项目授权。

仅运行一个平台实例；项目内 Git、合并、发布由进程串行化，SQLite 保存持久事实。普通 GitLab Maintainer 只授予平台合并身份，业务成员使用 Developer 或更低权限。命名空间 Owner/系统管理员是可信门禁维护者，不应绕过平台并发合并。未实现多实例分布式部署。

新环境先提供受控连接与用户角色配置。`scripts/init-local.mjs` 仅用于本机 bootstrap，输入 `.local/gitlab-bootstrap.json`（`token` 与 `projects:[{id,name,url}]`），不是生产自动建账号流程。“新建项目”创建新双仓库，不接管未知已有仓库。

## 需求到交付

1. 创建或从 Plane 同步需求。同名分支如 `reqsms001` 记录创建时 main SHA，空分支不构建。Plane 每 60 秒幂等同步，也可手动触发。
2. 在需求分支开发。维护 `prototype.yaml` 与 `requirements/<id>/` 的 manifest、annotations、scenarios、walkthrough 四类 YAML；PRD 绑定资料仓库的精确提交及路径。
3. “构建开发预览”立即独立发布，不要求最终验收或 main 合并，也不改变持续原型。
4. 创建候选冻结需求 HEAD 和最新 main。冲突只在独立工作区处理；业务规则变化会停止当前尝试。构建验证后固定候选和完整包。
5. 人工逐项确认，可选择旧确认及沿用理由，也可确认保留其他已合并需求并随本次交付。确认记录写入资料仓库成功后才允许 MR 合并。
6. 采用 fast-forward，禁止 squash；main 变化时旧候选失效。合并后发布同一个包，三项齐全才结束 Change。发布失败保留旧 current，重试不重建批准包。
7. 交付后新候选开启下一 Change，原需求分支保留。主动同步主线才更新原分支；冲突同步需要预览确认，分支有新提交时拒绝覆盖。
8. 纯文档需求标记原型不适用，人工确认精确文档来源后结束，不制造原型验收。

持续原型固定入口：`http://127.0.0.1:3079/projects/prototype-lab/current`。需求最近成功预览入口：`http://127.0.0.1:3079/projects/prototype-lab/requirements/reqsms001`。进入后固定到 build ID，其他发布不会切换已打开会话。

## Codex 配置

平台调用本机 `codex exec`。脚本兼容 Windows PowerShell 5.1 和 PowerShell 7：

```powershell
powershell -ExecutionPolicy Bypass -File .\platform\scripts\configure-codex.ps1 -CheckOnly
powershell -ExecutionPolicy Bypass -File .\platform\scripts\configure-codex.ps1
```

脚本隐藏 key 输入，写入忽略提交的文件并设置当前用户/SYSTEM 权限，配置只保存路径。配置后重启平台。可指定 `conflict_service.model`，否则使用 CLI 默认。不要将 key 发到聊天或提交到 Git。

调用使用独立 `CODEX_HOME`、只读沙箱和 JSON schema，关闭 shell、插件、Apps、子代理及 Web 搜索。模型只接收本次冲突和冻结来源，返回文件提案与影响说明；平台只应用列出的冲突文件。GitLab/Plane 凭据不传入 Codex，模型 key 不传入 Runner。最多两次，每次最多 60 秒；失败转人工，不伪报修复成功，也不能签发人工验收。

已验证 CLI 参数、缺 key 失败分支、次数上限及提案应用。2026-11-11 用户已配置 key；真实调用先因未继承本机代理超时，修复代理环境传递后收到 HTTP 400、`codex_byok_restricted_by_api_credit_promo`。该组织启用了订阅赠送 API Credits，服务端不允许其用于 Codex API-key 调用；真实模型修复尚未通过，等待用户选择其他认证方式。未改动组织计费或取消福利。[官方非交互调用说明](https://learn.chatgpt.com/docs/non-interactive-mode)、[额度适用范围](https://developers.openai.com/api/docs/guides/chatgpt-api-credits)。

## 模板和验证边界

`templates/prototype/apps/` 提供两个 HTML/Vite Storybook 应用。新增应用通过源码和配置注册，平台核心无业务端名判断。SDK 管理分应用会话和显式跨应用更新；播放器包含固定包会话、范围、标注、场景、演示及越界提示。没有按钮白名单或操作遮罩；新窗口及外层刷新独立初始化。

Runner 源码只读、无网络、无宿主 Docker socket/认证挂载，限制 CPU、内存及时间；锁文件变化先更新受控镜像。构建保存镜像摘要与工具链。浏览器验证使用无登录凭据的临时源站，检查场景、范围、子路径、刷新和窄屏，不冒充业务签收。

本机短信测试候选已由用户明确确认，并完成真实 MR/同包发布。并行需求冲突、失败重试、授权、恢复和 Change 生命周期有自动测试；其他完整业务剧本仍按方案人工验收，不宣称全部签收。

## 历史与恢复

原包在 `artifacts/archives/<build-id>`，在线副本在 `artifacts/online`。每个包保留所有应用、当时播放器/SDK、配置、需求资料及摘要，不覆盖、不自动清理。

“校验并恢复”只修复在线副本，不改变 current；损坏副本隔离后从原包复制，原包损坏明确失败。源码历史重建标记“重现构建”，不替代验收包。“恢复为当前展示”追加展示决定，不改 main/验收/交付事实；旧失败任务不能覆盖恢复决定。

`node platform/scripts/backup.mjs <备份目录>` 创建 SQLite 一致快照与原始包副本。配置、GitLab 仓库和凭据采用组织自己的备份策略。恢复数据库前停止服务，将数据库及 archives 放回同一数据根，再启动；在线副本按需恢复。整机灾难恢复仍需独立环境演练。

## 主要接口

接口需要登录；写入还需 CSRF 和 `Idempotency-Key`，同一请求重试使用原标识。

- `/api/projects`：创建双仓库；`/api/projects/:project/requirements`：创建需求。
- 项目需求路径下 `/integrations`、`/base-syncs`、`/builds`、`/preview-publications`。
- `/api/conflicts/{attempts|syncs}/:id`：读取冲突或提交提案。
- `/api/integrations/:id/{acceptance|rejection|merge}`：确认、驳回、合并。
- `/api/snapshots/:id/{releases|restore}`、`/api/releases/:id/recovery`：发布、副本恢复、恢复展示。

中断构建重启后可重试；确认记录和 GitLab 实际合并可对账恢复。审计保存在 SQLite events，日志/API 不返回 key。
