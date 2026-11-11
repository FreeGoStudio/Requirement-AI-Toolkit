# 原型独立发布

需求工作目录为 GitLab worktree 中的 `working/<slug>`，固定身份及路径见 repository-contract.md。先完成治理 postwrite、依赖检查和可用的浏览器验证，将源码提交并推送需求分支，再调用同级 prototype-publish 的 `Invoke-PrototypePublish.ps1 -Action Publish -Mode Prd -OutputDirectory '<需求工作目录>'`。

发布器确认当前源码已在 origin 同名分支，核对固定 publicationId 与目标，不从未推送的本地修改发布。HTTP 校验成功后自动回写 publication-record.json 和 Markdown 指定区；AI 检查后提交推送记录。记录提交不再触发上传。失败分别报告，源码已入库不代表服务器已发布。

开始修改原型前用 `-Action SyncLinks -LinksPending` 标记待发布；此变更随源码提交。缺少服务器配置时按 prototype-publish 引导配置，凭据留本机；不要把缺配置当成成功。已就绪服务器不初始化，沿用配置与目标。正式 PRD 的 main 发布独立进行。
