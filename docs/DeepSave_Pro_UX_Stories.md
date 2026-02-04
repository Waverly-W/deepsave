DeepSave Pro: 产品形态愿景与用户故事集文档类型UX 概念与用户故事关联项目DeepSave Pro (SecondBrain-Hybrid)版本v1.0适用对象UI 设计师, 前端工程师, 产品经理1. 理想产品形态 (The Ideal Form)DeepSave Pro 的核心设计哲学是 "Invisible Input, Tangible Output"（隐形输入，具象输出）。它不应该是一个需要你刻意去“维护”的管理后台，而是一个帮你思考的优雅界面。1.1 视觉风格 (Visual Language)架构：基于 Next.js 构建的响应式 SPA。UI 库：shadcn/ui (Zinc 或 Slate 配色)，追求“极简主义”与“信息密度”的平衡。主题：强制深色模式 (Dark Mode) 作为默认（致敬 IDE 和沉浸式阅读），同时也支持跟随系统。字体：系统默认无衬线字体 (San Francisco/Inter) 用于 UI，Noto Serif / 宋体 用于正文阅读模式，营造“杂志感”。1.2 核心界面概念A. 零干扰采集 (The Invisible Collector)桌面端：不是一个常驻的大窗口，而是一个 Menu Bar / System Tray 小图标。状态：当剪贴板监听到链接时，图标轻微闪烁或出现一个小蓝点。交互：点击图标 -> 弹出极简浮窗 -> 显示“已识别 URL” -> AI 自动生成的“一句话摘要”预览 -> 按钮 [归档] 或 [忽略]。移动端：原生系统的“分享”菜单。点击“分享到 DeepSave”，没有任何多余跳转，顶部出现一个 Toast 提示“已发送至 NAS，AI 处理中...”。B. 第二大脑仪表盘 (The Brain Dashboard)这是 Web 端的主页，不是枯燥的列表，而是动态的知识流。顶部 (The Recall Widget)："On this day"（那年今日）：一张老照片或一篇旧笔记。"Serendipity"（偶遇）：三个看似无关但语义相近的卡片（例如：一张赛博朋克图片 + 一篇关于 AI 伦理的文章）。主体 (The Stream)：混合排版：类似于 Pinterest 的瀑布流。智能卡片：文章：显示 AI 总结的 Title + 3个关键 Bullet Points + 阅读时长。图片：大图展示 + AI 提取的色板 (Color Palette) + 氛围标签（#忧郁 #雨天）。商品：显示缩略图 + 价格曲线趋势箭头。C. 沉浸阅读室 (The Deep Reader)当用户点击某篇文章时，进入此模式。去噪：移除原网页所有广告、侧边栏、弹窗。AI 侧边栏 (Copilot Sidebar)：摘要：固定在顶部的 TL;DR。Chat：针对当前文章的对话框（“这篇文章的核心论点是什么？”）。关联：“你仓库里的这篇《设计心理学》也提到了类似的观点...”。2. 多视角用户故事 (User Stories)通过四个典型角色的视角，展示 Hybrid 架构（本地+云端）如何解决实际问题。2.1 故事一：视觉设计师 Leo (The Visual Search)痛点：存了上万张参考图，甚至不记得文件名，只记得“感觉”。场景：Leo 正在做一个“赛博朋克风格”的火锅店海报。他依稀记得两年前存过一张关于“霓虹灯雨夜”的照片，但文件名肯定是乱码。他打开 DeepSave Pro，在搜索框直接输入：“下雨的夜晚，霓虹灯倒影，有点悲伤的感觉”。系统后台：Embedding 模型将这段自然语言转化为向量。在 ChromaDB 中检索向量距离最近的图片。Vision Agent (MiniCPM-V) 之前已经给那张图打上了 #Rainy #Neon #Melancholy 的标签。结果：系统毫秒级展示了 5 张符合意境的图片，目标图片赫然在列。Leo 点击图片，不仅看到了原图，AI 还自动提取了图中的主要配色方案 (Hex Codes)，他直接复制颜色到了 Photoshop 中。2.2 故事二：技术极客 Ken (The Privacy & Code)痛点：需要保存敏感的代码片段和服务器配置，绝对不能上传到 Notion 或任何公有云。场景：Ken 在公司内网发现了一段绝妙的 Python 脚本，用于自动化运维。他想保存下来，但担心泄密。他将代码复制，通过 DeepSave 归档。系统后台：Router 识别内容为代码。Privacy Check：Ken 设置了“代码类内容强制本地处理”。系统自动切断 OpenAI API，调用 NAS 上运行的 Ollama (DeepSeek-Coder-V2-Lite)。Tech Agent 分析代码，自动添加注释，提取技术栈标签 #Python #Automation，并生成一段“如何使用”的说明。结果：代码被安全加密存储在 NAS 本地数据库中。Ken 无论在家里还是公司，通过 VPN 连回 NAS 就能查找，且 AI 还能帮他写基于这段代码的单元测试——全过程没有任何数据流出外网。2.3 故事三：效率达人 Sarah (The Hybrid Efficiency)痛点：NAS 性能一般 (J4125 CPU)，但每天要处理几百条行业新闻，不想等本地模型慢慢跑。场景：Sarah 早上起床，将 50 篇 RSS 订阅的科技新闻一键推送到 DeepSave。系统配置：她开启了“Hybrid Mode”，并将文本摘要任务指定给 DeepSeek-V3 API (便宜且极速)。系统后台：Smart Scraper 并发抓取 50 个网页正文。直接调用云端 API，在 30 秒内完成了 50 篇文章的摘要和分类。结果：Sarah 刷牙洗脸回来，打开 Dashboard，一份生成的“早报”已经准备好了。系统自动过滤了 30 篇“软文广告”，将剩下的 20 篇按重要性排序。她只花了 5 分钟就看完了别人 1 小时的阅读量。2.4 故事四：博士生 Emma (The Knowledge Connector)痛点：写论文需要引用大量文献，经常忘记某观点出自哪篇 PDF。场景：Emma 正在写关于“AI 偏见”的论文。她上传了一篇新的 PDF 论文。系统后台：Knowledge Graph：在处理新论文时，AI 发现文中提到了 "Algorithmic Fairness" 这个实体。系统检索数据库，发现 Emma 半年前存的一篇 News Article 也提到了这个词。结果：在阅读新论文时，右侧 Copilot 弹出提示：“关联阅读：你半年前收藏的《算法的黑箱》也讨论了此话题，且观点相反。”Emma 惊喜地点击链接，瞬间建立了两个孤立知识点之间的联系，不仅找回了记忆，还为论文增加了一个精彩的辩证讨论点。3. 核心交互流程图 (The "Magic" Loop)graph TD
    A[用户行为: 复制链接/图片] --> B{剪贴板监听器};
    B -- 忽略 --> C[无操作];
    B -- 捕获 --> D[弹窗: 检测到新内容];
    D --> E[用户点击: 一键归档];
    E --> F{Router 智能路由};
    
    subgraph "Hybrid Processing Engine"
    F -- 文本/新闻 --> G[云端 API (速度优先)];
    F -- 敏感/代码 --> H[本地 Ollama (隐私优先)];
    F -- 图片素材 --> I[Vision Agent (视觉分析)];
    end
    
    G & H & I --> J[结构化数据生成];
    J --> K[存入 NAS 数据库 & 向量化];
    K --> L[前端 Dashboard 更新];
    L --> M[用户收到 Toast: 处理完成];
