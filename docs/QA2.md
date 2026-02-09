DeepSave Pro - 规格决策与架构细节 (Q&A Specs Part 2)

文档信息

内容

关联项目

DeepSave Pro (SecondBrain-Hybrid)

版本

v1.0 (Final Execution Specs)

决策人

Product Manager & System Architect

状态

已锁定 (Locked) - 覆盖旧文档冲突项

一、冲突与锁定决策 (Conflicts & Locks)

1. 认证方案冲突

决策：NextAuth.js (Frontend) + JWT (Backend)。

逻辑：

前端使用 NextAuth 的 CredentialsProvider 处理登录 UI 和 Session 保持。

后端 FastAPI 不维护 Session，仅验证 Header 中的 Authorization: Bearer <token>。

统一方案：登录时，NextAuth 调用后端 /api/v1/auth/login 获取 JWT，并将其存入 NextAuth 的 Session Object 中。前端后续请求由 Next.js Middleware 或 Axios Interceptor 自动透传此 JWT。

2. 剪贴板监听 MVP 交付物

决策：MVP 必须交付一个 Python 脚本 (clipboard_monitor.py)。

实现：该脚本放入 GitHub 仓库的 /tools 目录。用户需在本地电脑手动运行（依赖 pyperclip 和 requests）。不开发打包好的 .exe/.app，降低维护成本。

3. 移动端策略

决策：暂不做任何适配，仅提供标准化接口，通过 API 口令访问。

理由：标准化接口可以为未来的具体实现方式留下空间。

4. 主题规范

决策：跟随系统 (System Preference)。

修正：废弃 UX 文档中的“强制深色”。Tailwind 配置 darkMode: 'class'，默认读取 prefers-color-scheme，并在设置页提供手动切换开关。

5. 数据库锁定

决策：PostgreSQL Only。

动作：PRD Phase 1 的 SQLite 方案作废。无论数据量大小，统一使用 PG 容器，以确保向量插件 (pgvector) 和全文检索 (pg_trgm) 的环境一致性。

二、账号与安全 (Account & Security)

6. 管理员初始化

决策：首次启动向导 (Setup Wizard)。

流程：系统检测到 users 表为空时，前端重定向至 /setup 页面，强制用户设置 Admin 账号密码。

重置：忘记密码需通过 CLI 命令重置：docker exec -it deepsave-api python manage.py reset-password <new_password>。

7. API Key 加密

决策：AES-GCM 对称加密。

密钥：使用环境变量 APP_SECRET_KEY (在 docker-compose 中定义) 作为加密盐。存入数据库的值是密文，取出后在内存解密使用。不允许明文入库。

8. 浏览器扩展鉴权

决策：专门的 "Access Token"。

流程：用户在 Web 端「设置 -> API」页面点击“生成访问令牌”，手动复制该 Token 填入浏览器扩展或 Python 脚本的配置中。不使用复杂的 OAuth 流程。

三、采集与去重 (Ingestion & Deduplication)

9. URL 去重策略

决策：覆盖更新 (Upsert)。

逻辑：若 URL 已存在，视为“用户希望刷新内容”。重新爬取、重新生成摘要和标签，但保留用户的“收藏状态 (Is Favorite)”和“创建时间”。

10. URL 规范化

决策：必须 (Mandatory)。

规则：移除标准追踪参数 (utm_*, fbclid, gclid) 和 Hash (#)。保留 ?id= 等必要参数。

11. 多行 URL 粘贴策略

决策：部分成功 (Partial Success)。

并发：全局并发上限为 3（在 Celery Worker 层面配置）。每个域名无单独限制（依靠全局限制保护 NAS）。

12. 图片 vs 正文判定

决策：优先检测 OpenGraph og:type。

逻辑：

若 URL 后缀是图片格式 -> Vision Agent。

若 og:type == article -> Editorial Agent。

若 og:type 缺失，且 HTML 中 <p> 标签文本总长度 > 500 字 -> Editorial Agent。

强制选择：前端输入框提供下拉菜单（Auto/Article/Image/Code），允许用户覆写。

13. Cookie 存储

决策：按域名存储 (Per Domain)。

实现：DB 表 site_configs 存储 { domain: "wechat.com", cookies: "..." } (加密)。爬虫根据 URL 域名自动加载对应 Cookie。

14. Playwright 产物

决策：HTML Snapshot 必须，截图可选。

实现：

content.html (DOM Snapshot): 必须，用于重新提取文本和作为“永久副本”。

screenshot.png: 可选 (默认开启，但允许在低配模式下关闭以省空间)，主要用于 Gallery 视图的封面。

四、AI 处理与输出 (AI Processing)

15. Schema 验证失败

决策：重试 2 次 -> 降级。

逻辑：若 LLM 输出的 JSON 无法解析，重试最多 2 次。若仍失败，将原始非结构化输（Raw Output）出存入 summary 字段，并标记 tag #parse_error，不丢弃数据。

16. 图片类 MVP 输出

决策：描述 + OCR + 标签 + 色板。

字段：

description: 画面内容的详细描述。

ocr_text: 图中包含的文字。

tags: ["cyberpunk", "neon", "rain"]。

palette: ["#FF0000", "#00FF00"] (MiniCPM-V 等模型支持提取，若使用云端 Vision API 则视 API 能力而定，若不支持则由后端 Python colorgram.py 库提取)。

17. Router 白名单

决策：YAML 配置文件。

维护：/config/router_rules.yaml。默认内置 GitHub/Twitter 等规则。用户可挂载此文件进行自定义，无需改代码。

18. Embedding 模型

决策：

云端：Aliyun text-embedding-v4 (Key=ALIYUN_API_KEY)。

本地：bge-m3。

库：本地使用 sentence-transformers (Python) 运行，不依赖 Ollama 的 embedding 接口（因为 Ollama 某些版本 embedding 并发处理有问题）。

五、检索与排序 (Retrieval & Ranking)

19. PG FTS 中文分词

决策：pg_trgm (Trigram, 三元组)。

理由：zhparser 配置复杂且依赖特定的 Postgres 镜像。pg_trgm 是官方标准插件，对中文支持良好（将中文切分为双字/三字片段匹配），足以满足 MVP 需求。

20. RRF k 值

决策：k = 60 (默认值)。

配置：写入 .env 文件 RRF_K_CONSTANT=60，可调。

21. 默认检索字段权重

决策：Title (A) > Tags (B) > Summary (C) > Content (D)。

实现：使用 Postgres setweight 函数，Title 设为 'A', Summary/Tags 设为 'B', 正文设为 'C' 或 'D'。

六、数据模型与生命周期 (Data Lifecycle)

22. 数据模型权威源

决策：以数据库表结构 (SQL Schema) 为主。

映射：LLM 输出的 JSON 仅作为传输对象 (DTO)，后端负责将 JSON 字段映射并写入 DB 表。

23. 删除策略

决策：硬删除 (Hard Delete)。

范围：删除 Item 时，级联删除 (Cascade) 关联的 Tags、Entities、Artifacts 文件以及 Vector 索引。不留垃圾。

24. 日志清理

决策：Celery Beat 定时任务。

频率：每天凌晨 3:00 执行，删除 created_at < 7 days 的 task_logs 记录。

七、 UI/UX 细节

25. Chat/Gallery 路由

决策：同页切换 (Tabs/Segmented Control)。

路由：/?view=chat 和 /?view=gallery。状态保存在 URL Query Param 中，刷新不丢失。

26. 搜索命令模式

语法：

/tag <tag_name>: 按标签搜。

/type <article|image|code>: 按类型搜.

/status <unread|read>: 按状态搜。

/date <YYYY-MM-DD>: 按日期搜。

直接输入文本：自然语言混合搜索。

27. Recall 卡片刷新

决策：每次刷新页面都变 (Random Seed)。

理由：为了增加“偶遇”的几率，固定一天不变会减少用户发现旧内容的乐趣。

八、部署与运维 (Deployment)

28. Docker Compose Profiles

决策：必须使用 Profiles。

配置：

docker-compose --profile cpu up (默认，不含本地 LLM)。

docker-compose --profile gpu up (包含 Ollama + GPU 穿透配置)。

端口：Web: 3000, API: 8000 (仅内部通信, 可不暴露), DB: 5432.

29. Alembic Migrations

决策：必选 (Mandatory)。

流程：Docker 启动脚本 (entrypoint.sh) 中必须包含 alembic upgrade head，确保数据库结构自动初始化和升级。

30. 失败重试与幂等

幂等键：MD5(Normalized_URL)。

逻辑：Redis 锁。当 URL 开始处理时，写入 Redis Key processing:{md5_url}。若 Key 存在，拒绝重复提交。任务完成后（无论成功失败）释放 Key。
