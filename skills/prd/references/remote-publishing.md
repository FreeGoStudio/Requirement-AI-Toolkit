# 发布已拆为独立技能

原型源码、依赖与必要治理元数据同时按 `gitlab-delivery.md` 纳入 GitLab，位于 VitePress 源目录之外。GitLab 版本管理与本技能的服务器发布相互独立；同轮使用同一份已验证内容，分别记录提交/推送和发布结果。不将 GitLab 提交成功当成发布成功，也不因发布成功省略入库。

原型生成和修改仍由 prd 负责；通过本技能原有 postwrite 与资源检查后，读取同级 `prototype-publish/SKILL.md`，调用其 `scripts/Invoke-PrototypePublish.ps1 -Action Publish -Mode Prd -OutputDirectory '<交付目录>'`。

本机未配置服务器时维持本地交付；已经配置但缺少 prototype-publish 时明确提示安装，不能将未发布报告为发布成功。历史 HTML 直接使用 prototype-publish，不补做需求或设计治理清单。

完整发布与服务器配置说明见同级 `prototype-publish/references/remote-publishing.md`。已就绪服务器不初始化，沿用原配置及临时路径。
