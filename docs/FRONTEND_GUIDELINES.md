# DeepSave Pro 前端规范（FRONTEND_GUIDELINES）

## 1. 设计原则
- 本地优先、信息密度高、操作少。
- 视觉简洁，默认跟随系统主题（默认深色）。
- 交互明确：所有任务可观察、可重试。

## 2. 路由与页面
- `/setup`：首次初始化向导（仅首次可访问）。
- `/login`：管理员登录。
- `/?view=chat`：Chat 视图（默认）。
- `/?view=gallery`：Gallery 视图（图片优先）。
- `/items/[id]`：阅读详情页（Deep Reader）。
- `/settings`：API Key、Access Token、主题切换。

## 3. 组件规范
- 顶部搜索栏（常驻）：支持自然语言与命令输入。
- 视图切换：Tabs/Segmented 控件绑定 `view` query。
- 卡片：支持状态（processing/failed/completed）。
- 空态：明确提示“还没有内容”与引导采集。

## 4. 主题与字体
- Tailwind `darkMode: 'class'`，默认读取 `prefers-color-scheme`。
- UI 字体：系统无衬线；阅读模式可切换衬线字体。

## 5. 数据加载与状态
- 列表：无限滚动（cursor=created_at，limit=20）。
- 任务状态：前端每 2s 轮询任务完成情况。
- 错误提示：卡片展示失败原因并提供“重试”。

## 6. 搜索与命令
- `/tag <name>`：按标签。
- `/type <article|image|code|note>`：按类型。
- `/status <read|unread>`：按状态。
- `/date <YYYY-MM-DD>`：按日期。

## 7. 图片封面回退链
Snapshot Screenshot → OpenGraph Image → Favicon → Placeholder。

## 9. 交互细节
- 状态展示：processing 显示加载；completed 可点击；failed/partial_fail 显示原因与重试按钮。
- 阅读状态：进入详情页即写入 `is_read=true`。
- 排序偏好：用户切换排序后记录在 localStorage。

## 8. 权限与安全
- 所有 API 请求必须携带 JWT 或 Access Token。
- 本地存储仅用于 UI 偏好（主题、排序）。
