# 密钥泄露处理与服务器更新

本次处理两个远端分支的 Git 历史，删除生产配置和 TLS 私钥，并替换已经确认的历史 API/JWT 密钥。自动检查不能证明所有敏感信息都已发现；历史清理也不能让别人保存的密钥失效。

## 先停用旧凭据

1. 在百度智能云核对并停用历史 OCR 应用凭据；在火山引擎核对并删除历史豆包 API Key。检查调用、费用和异常使用记录，再为仍需要使用的服务生成新凭据。不要把新值发到聊天或提交到 Git。
2. 若服务器仍使用曾提交到 Git 的 `JWT_SECRET`，在维护窗口更换为新的随机值，所有用户需要重新登录。
3. **先确定教师 AI Key 的加密方式。** 没有设置 `AI_KEY_ENCRYPTION_SECRET` 的旧部署使用 JWT 密钥加密教师 Key。更换 JWT 会使这些旧密文无法读取。教师数量少时，可安排教师登录后在 AI 设置中重新填写并保存自己的新 Key；暂停 AI 批阅，等重新配置并验证后再恢复。教师较多时，应先准备和演练数据库密文迁移，再更换密钥。不要把泄露的旧 JWT 当作新的加密密钥继续使用。
4. 如果已有独立且未泄露的 `AI_KEY_ENCRYPTION_SECRET`，更换 JWT 时保持它不变即可。新安装脚本现在会分别生成这两个密钥；它拒绝覆盖现有配置，不能拿来直接更新生产配置。
5. 若服务器使用过仓库中的 TLS 私钥，请生成新的私钥并换证书。历史证书为自签名证书；只修改证书日期、继续使用原私钥不能解决泄露。

仓库操作不会自动完成以上控制台和服务器操作。

## 历史重写后的第一次服务器更新

**这一次不要直接 `git pull`，也不要用合并旧历史的方式解决分叉。** 建议保留旧目录，在旁边重新克隆。以下操作前先备份数据库、上传文件、生产配置、HTTPS 配置，并确认备份可用。备份存放在仓库外，限制访问权限。

1. 在旧目录通过 `docker compose ls` 确认正在运行的项目，记录准确的 Compose 项目名。必要时用容器的 `com.docker.compose.project` 标签核对。后面始终使用这个项目名，否则新目录可能创建一组空数据卷。
2. 安排维护窗口，暂停提交和批阅。在旧目录停止后端写入，按 [部署文档](operational-hardening-2026-09-09.md#备份操作) 备份数据库和上传。若旧部署还没挂载上传卷，在替换容器前先用 `docker cp` 保存 `/app/uploads`，按部署文档完成旧环境迁移。不要执行 `down -v`。
3. 在旧项目的父目录执行以下命令。新目录必须不存在；任何一步失败都先停止，不要继续。

   ```bash
   git clone https://github.com/yosemdawn/all-in-one-AI_edu_system.git all-in-one-AI_edu_system-clean
   cd all-in-one-AI_edu_system-clean
   ```

4. 将仓库外备份的服务器 `backend/.env.production` 复制到新目录同一路径，设置 `chmod 600 backend/.env.production`。保留数据库密码、域名和其他实际配置；按上节处理 JWT 和教师 Key。不要用示例配置覆盖已有配置或重新初始化数据库。恢复仓库外维护的 HTTPS 配置/证书，并检查自定义绑定目录、代理、服务和定时备份是否引用旧目录。
5. 在新目录运行以下命令，将 `原项目名` 替换为步骤 1 记录的真实名称。旧环境尚未完成数据库认证及上传卷迁移的，应先完成部署文档中的迁移。

   ```bash
   export COMPOSE_PROJECT_NAME='原项目名'
   docker compose --env-file backend/.env.production config -q
   docker compose --env-file backend/.env.production up -d --build --wait
   docker compose --env-file backend/.env.production ps
   curl -fsS http://127.0.0.1:8080/api/readyz
   ```

6. 验证登录、旧作业和成绩、旧上传图片、新上传、教师 AI 设置，以及判分/作文批阅。确认使用原数据卷、业务正常后再恢复流量。之后从新目录维护；将原项目名记入运维配置，后续命令及备份任务都使用相同的 `COMPOSE_PROJECT_NAME`。

旧目录先作为受限的临时备份保留，不再从它提交或推送。清理历史后旧提交哈希会失效，其他开发电脑也应重新克隆，避免把旧历史推回来。此电脑的工具快照和本地备份没有公开推送，也未擅自删除；它们仍可能保留旧密钥，不要上传或共享。

完成这次切换后，日常更新仍可在新目录使用 `git pull --ff-only`，再执行上述 Compose 更新命令，无需先 `down`。

## GitHub 上仍可能存在的副本

分支历史清理不保证 GitHub 的旧提交链接、Pull Request 引用、缓存、别人的 fork 或克隆也已消失。停用凭据后，根据 [GitHub 官方说明](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository) 联系 GitHub Support 申请处理残留引用/缓存；不要把密钥原文附在公开 issue 中。私有的本地清理报告会保留所需提交映射和受影响引用，供申请时使用。

## 后续防误提交

- `.gitignore` 排除实际环境配置、私钥和 Git 备份包，保留 `.env.example` / `.env.*.example` 模板。
- 本地提交前可执行 `node scripts/check-secret-files.mjs` 检查暂存区文件名；它不读取本地未跟踪的生产配置。
- GitHub Actions 使用 Gitleaks 扫描可达历史，日志对命中内容脱敏。检查是在推送后运行，不能阻止密钥第一次到达远端；提交前仍应检查暂存内容。扫描误报仅放行了两个已确认的历史占位值。
