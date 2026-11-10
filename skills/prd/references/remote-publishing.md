# 发布已拆为独立技能

原型生成和修改仍由 prd 负责；通过本技能原有 postwrite 与资源检查后，读取同级 `prototype-publish/SKILL.md`，调用其 `scripts/Invoke-PrototypePublish.ps1 -Action Publish -Mode Prd -OutputDirectory '<交付目录>'`。

本机未配置服务器时维持本地交付；已经配置但缺少 prototype-publish 时明确提示安装，不能将未发布报告为发布成功。历史 HTML 直接使用 prototype-publish，不补做需求或设计治理清单。

完整发布与服务器配置说明见同级 `prototype-publish/references/remote-publishing.md`。已就绪服务器不初始化，沿用原配置及临时路径。
