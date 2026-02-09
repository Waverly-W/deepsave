# DeepSave Pro 应用流程（APP_FLOW）

## 1. 初始化与登录
1. 首次启动：若 `users` 表为空，跳转 `/setup`。
2. 用户设置管理员账号密码。
3. 登录页输入密码，后端签发 JWT，前端存入 NextAuth Session。

## 2. 采集入口
- Web 输入：在首页输入 URL/文本，选择 Auto/Article/Image/Code。
- 浏览器扩展：Popup 点击保存；右键选中文本保存为 Note。
- 剪贴板脚本：监听剪贴板 URL，调用 `/items/ingest`。

## 3. 处理管线
1. URL 规范化与去重（`normalized_url`）。
2. 生成 `item_id` 与 `task_id`，返回 202。
3. Celery Worker 抓取：HTTP 优先，失败则 Playwright 兜底。
   - Note 类型：跳过抓取，直接使用 content_text。
4. Router 识别类型 → 调用相应 AI 处理。
5. 生成结构化字段、向量化、写入数据库。
6. 更新 `processing_status`。

## 4. 任务状态与回显
- 前端每 2s 轮询 `/items/tasks/{task_id}`。
- 成功：卡片变为可读状态；失败：展示失败原因与“重试”。

## 5. 浏览与搜索
- 顶部搜索框：自然语言或命令（`/tag`、`/type`、`/status`、`/date`）。
- Gallery：瀑布流（图片优先）。
- Chat：对话式检索（复用 `/search` 结果）。

## 6. 详情阅读
- 去噪阅读视图 + 侧栏摘要。
- 进入详情即标记 `is_read=true`。

## 7. 管理操作
- 归档：`is_archived=true`（列表隐藏、搜索可见）。
- 删除：
  - 软删除：`is_deleted=true`（进入回收站）。
  - 硬删除：删除记录、向量、资产文件。

## 8. Access Token 管理
- 设置页生成 Token，仅展示一次。
- 扩展/脚本使用 Token 访问 API。
