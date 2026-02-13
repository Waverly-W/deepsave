# DeepSave Pro 前端规范（FRONTEND_GUIDELINES）

## 1. 设计原则
- 本地优先、信息密度高、操作少。
- 视觉简洁，默认跟随系统主题（默认深色）。
- 交互明确：所有任务可观察、可重试。

## 2. 路由与页面
- `/setup`：首次初始化向导（仅首次可访问）。
- `/login`：管理员登录。
- `/`：主页（搜索框居中，结果下拉展示）。
- `/timeline`：时间线（按创建时间浏览卡片列表）。
- `/items/[id]`：阅读详情页（标题可编辑、正文优先展示，移动端二级信息折叠）。
- `/settings`：API Key、Access Token、主题切换、笔记区域宽度与编辑器文字大小。

## 3. 组件规范
- 左侧侧栏：固定在左侧、仅图标入口（主页/时间线/设置），仅 `md+` 显示。
- 移动端底部 Tab：`< md` 显示图标+文字入口，固定底部并预留安全区。
- 主页搜索栏：居中输入，支持自然语言与命令输入；结果下拉展示。
- 卡片：支持状态（processing/failed/completed）。
- 空态：明确提示“还没有内容”与引导采集。
- 详情页元信息卡片：包含笔记类型、任务状态、阅读状态、保存时间与打开原文。

## 4. 主题与字体
- Tailwind `darkMode: 'class'`，默认读取 `prefers-color-scheme`。
- UI 字体：系统无衬线；阅读模式可切换衬线字体。
- UI 偏好：笔记区域宽度（紧凑/标准/宽屏）与编辑器文字大小（小/中/大）通过 localStorage 持久化并以 CSS 变量控制。

## 5. 数据加载与状态
- 列表：无限滚动（cursor=created_at，limit=20）。
- 任务状态：前端每 2s 轮询任务完成情况。
- 错误提示：卡片展示失败原因并提供“重试”。
- 主页统计：调用 `/items/overview` 获取概览数据。
- 最近卡片：调用 `/items?limit=5` 获取最新保存。

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
- 保存/重算：详情页工具栏内以图标按钮展示；分析过期提示使用 toast。

## 10. 移动端适配
- `< md`：侧栏隐藏、底部 Tab 显示，正文留出底部安全区间距。
- 详情页：标题与正文优先展示，元信息/摘要/标签/色板为折叠卡片。

## 8. 权限与安全
- 所有 API 请求必须携带 JWT 或 Access Token。
- 本地存储仅用于 UI 偏好（主题、排序）。
