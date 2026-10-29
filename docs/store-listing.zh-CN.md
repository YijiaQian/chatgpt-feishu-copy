# Chrome / Edge 商店发布材料

更新日期：2026-10-29；本次更新版本：1.2.5。已核实原 v1.2.2 公开上架，后续更新沿用商品 ID：`lioeeehlohnekghgohhagbammgbbcbfn`。上传、提审与审核通过分别记录，不把上传表述为已上线。Edge 尚未提交。

## 名称与用途

名称：ChatGPT 飞书复制助手

主要语言：简体中文。保留 ChatGPT 英文产品名作为自然关键词；当前不添加缺少完整本地化素材的英文商品页。

分类：工具（沿用现有商店条目）。

简短描述：一键将 ChatGPT 内容复制到飞书文档，保留公式、表格、图片与代码块，支持整段会话离线导出。

单一用途：将用户主动选择的 ChatGPT 回复、当前会话或 Markdown 转换为适合飞书文档粘贴的富文本或离线 HTML，包含该转换所需的公式、图片、表格与图表处理。

## 详细介绍

从 ChatGPT 到飞书，少做一次排版。

写方案、整理学习笔记、记录技术讨论时，把 ChatGPT 内容复制到飞书，经常要重新调整公式、表格和代码块。ChatGPT 飞书复制助手增强网页原有复制按钮，让内容复制后就能继续整理和编辑。

【复制到飞书，接着编辑】
• 正文 LaTeX 公式转换为飞书可编辑公式。
• 保留标题、粗体、列表、引用、链接和代码块，表格保留为原生文档表格。
• 按源比例保留表格列宽，独立列表从正确的编号开始。
• 读取图片、SVG 和可访问图表，保留流程卡片、坐标轴、图例及计算卡片的当前状态。

【整段会话，离线保存】
自动滚动收集当前分支的用户消息与 ChatGPT 回复，导出一个包含可读取图片和公式字体的 HTML 文件。离线打开可阅读，也可复制全部或只复制其中一条。支持进度提示与取消。

【已有 Markdown，也能直接用】
打开独立转换工具，粘贴 Markdown、预览公式、插入本地图片，再复制到飞书或导出兼容 HTML。适合学习笔记、项目周报、技术方案和研究记录。

【三步开始】
1. 在 ChatGPT 网页打开已生成完成的回复，点击原复制按钮或旁边的文档图标。
2. 等待“已复制飞书格式”提示。
3. 切到可编辑的飞书文档，按 Ctrl+V 普通粘贴。
按住 Alt 点击原复制按钮，可使用 ChatGPT 原始复制。增强功能可在扩展弹窗关闭。

【本机转换，无需额外密钥】
不需要 API Key、飞书 App Secret 或扩展账号。解析、公式渲染和图片转换在本机完成；无广告、无分析追踪，不向开发者服务器上传正文。远程图片会从原地址下载，粘贴后由飞书自身接收内容并上传图片。ChatGPT 和飞书本身仍需各自的网站账号。

【使用边界】
图表与交互卡片保存为静态图片，表格内公式以高清图片保留；卡片内文字和表格公式图片不能作为原生公式编辑。无法读取的跨域画布、iframe 图表或过期图片可能需要手动补图。附件原文件、其他分支和隐藏思考过程不打包。字体和间距由目标文档控制，不承诺像素级一致。

适用于 Chrome / Edge 中的 ChatGPT 网页，不适用于桌面客户端或手机端。截图使用公开测试内容，虚构演示会话已标注。本工具独立开发，与 OpenAI、飞书、Google 或 Microsoft 没有隶属或官方合作关系。

## 公开网址

- 主页：https://github.com/YijiaQian/chatgpt-feishu-copy
- 支持：https://github.com/YijiaQian/chatgpt-feishu-copy/issues
- 隐私政策：https://github.com/YijiaQian/chatgpt-feishu-copy/blob/main/PRIVACY.md

以上 GitHub 隐私页面提供可读的 Markdown 版本；扩展安装包内提供相同内容的 privacy.html。提交时请确认所填网址可匿名访问。

## 权限用途

| 权限 | 必要性 |
| --- | --- |
| clipboardWrite | 用户主动点击复制时，同时写入 text/html 和 text/plain，供飞书粘贴。没有 clipboardRead 权限。 |
| storage | 本机保存功能开关及最近一次转换的时间、数量和警告。 |
| offscreen | 在本机后台 DOM 中渲染表格公式、解码图片并生成 PNG。 |
| scripting | 用户在弹窗主动点击“检查并启用当前页面”后，向已授权的 ChatGPT 页面重新注入扩展文件。 |
| chatgpt.com、chat.openai.com | 读取待复制回复、连接当前页面并在必要时下载该页面的同源图片。 |
| *.oaiusercontent.com、*.oaistatic.com、images.openai.com | 下载回复引用的 OpenAI 图片素材，包括搜索结果卡片缩略图；不是执行远程代码。 |
| 可选 https://*/* | 仅为用户手动输入并授权的单个外部图片域名下载图片。不会默认申请访问所有 HTTPS 网站，不会向其他网站注入内容脚本。 |

远程代码：不使用。Markdown、净化、公式和截图依赖均随扩展本地打包。远程请求只用于用户引用的图片，不下载或执行脚本。

## 数据披露提示

不能仅因没有开发者服务器就声称“不处理任何数据”。本扩展处理网站内容、用户输入的文本、图片和图表；商店数据表单应如实披露这些本地处理行为，并与隐私页面保持一致。最近一次警告也可能包含图片说明、域名或出错公式片段。无广告、无出售数据、无分析追踪、无训练用途。

## 上传文件与图片

1. 运行 `python scripts/package.py`。
2. 在已有商品上传 `dist/chatgpt-feishu-copy-v1.2.5-store.zip`，其根目录包含 manifest.json，不新建条目。
3. 128×128 图标：`icons/128.png`。
4. 五张 1280×800 功能截图：`docs/assets/store/01-formulas.png` 至 `05-markdown.png`；只含公开测试内容。
5. Chrome 440×280 小型宣传图：`docs/assets/store/promo-440x280.png`。
6. Chrome 1400×560 顶部宣传图：`docs/assets/store/marquee-1400x560.png`。

## 审核复现步骤

无需扩展账号、付费、API Key 或飞书开发者凭据。ChatGPT / 飞书网站功能本身需要审核员自己的正常网站账号。

1. 可先不登录网站，打开扩展的独立转换工具，点击“填入测试示例”。
2. 检查公式预览；点击“转换并复制到飞书”，观察数量统计和警告。
3. 在个人空白飞书文档 Ctrl+V，检查正文公式可编辑、表格公式为图片、表格和代码块结构可用。
4. 登录 ChatGPT 网页，在含数学公式的回复旁点击原复制按钮或文档导出图标，重复粘贴。
5. 网页中有 Recharts/SVG 图表时，确认复制提示包含图表截图，并在目标文档看到静态图像。
6. 按住 Alt 点击原复制按钮，应继续使用原网站复制。可在扩展弹窗关闭增强复制。

## 商店账号与正式提交

- Chrome：需要开发者账号、账号验证和一次性注册费；具体金额及验证以官方后台显示为准。
- Edge：需要 Microsoft 个人账号作为主要所有者注册 Partner Center 的 Edge 开发者项目；该项目没有注册费，仍需账号验证。
- 2026-10-20：在已有 Chrome 开发者条目中撤回旧版 1.1.2 的审核，上传已验证的 1.2.2 商店包，更新介绍、权限理由及测试步骤，重新提交审核，并启用审核通过后自动发布。分发为免费、公开。商店会独立审核代码、权限、数据声明和素材，提交完成不等于审核通过。
- 2026-10-29：确认 v1.2.2 已公开上架。在同一条目上传 v1.2.5，更名为“ChatGPT 飞书复制助手”，保存简体中文介绍、五张功能截图及两张宣传图，补充 `images.openai.com` 权限理由并更新审核复现说明。已正式提交，后台显示“待审核”；已勾选审核通过后自动发布。当前公开版本仍为 v1.2.2，不把新包提审表述为已上线。

官方参考：[Chrome 注册](https://developer.chrome.com/docs/webstore/register/)、[Chrome 打包要求](https://developer.chrome.com/docs/webstore/prepare/)、[Chrome 图片要求](https://developer.chrome.com/docs/webstore/images/)、[Chrome 本地数据披露](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/)、[Edge 注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account)、[Edge 发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。
