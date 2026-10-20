# Chrome / Edge 商店发布材料

准备日期：2026-10-20；扩展版本：1.2.1。以下是提交草稿，尚未向商店提交审核或通过审核。

## 名称与用途

名称：ChatGPT → 飞书 · 公式图片复制

分类建议：生产力 / Productivity。

简短描述：增强 ChatGPT 复制并导出当前会话为离线 HTML，保留飞书兼容的公式、表格、图片和图表。

单一用途：将用户主动选择的 ChatGPT 回复、当前会话或 Markdown 转换为适合飞书文档粘贴的富文本或离线 HTML，包含该转换所需的公式、图片、表格与图表处理。

## 详细介绍

把 ChatGPT 生成的内容带到飞书文档时，常会遇到公式变成源码、表格错乱、图片和曲线图丢失的问题。本扩展增强 ChatGPT 网页原有的复制按钮，在本机把所选回复转换为适合飞书文档粘贴的富文本。

使用方法：在 chatgpt.com 打开已经生成完成的回复，点击原复制按钮，或旁边的文档导出图标。等“已复制飞书格式”提示后，切到可编辑的飞书文档按 Ctrl+V。按住 Alt 点击原复制按钮可使用原始复制。也可以打开独立转换工具，粘贴 Markdown，预览、插入本地图片，并复制或导出 HTML。

点击扩展弹窗中的“导出当前会话到本地”，可自动滚动收集当前分支的用户消息和 ChatGPT 回复，生成包含图片、公式字体和查看脚本的单文件 HTML。离线打开后可复制全部或分条复制到飞书。导出支持进度与取消；原始附件、未选择分支和隐藏思考过程不打包。资源失败会列出提示。

支持标题、列表、引用、链接、代码块和原生文档表格。正文 LaTeX 公式转为飞书可编辑公式；表格内公式以 3 倍分辨率 PNG 保留显示，不能直接作为公式编辑。可读取的图片与 SVG 图标嵌入为 PNG，SVG / Recharts 及可读取的 Canvas 图表保留为带有坐标和图例的静态图片。图表不会保留交互功能；跨域 iframe 图表、过期图片或不可读取的画布会提示需要补入原图。

无需 API Key 或飞书 App Secret。解析、公式渲染及图片转换在本机完成，没有开发者收集服务器或遥测。下载远程图片时会请求原图片地址；粘贴到飞书后由飞书自身接收内容并上传图片。

流程、并排数字卡片及进度条组件会按完整布局转换为静态 PNG，卡片内文字不能单独编辑。识别结合网页组件标记与 Grid / Flex 卡片样式。引用来源中的装饰图标会去除，可读取的来源链接或标签保留。仅有纯文本或 Markdown 时，无法恢复已经丢失的卡片排版。

支持 Chrome 和 Edge 浏览器中的 ChatGPT 网页；不支持 ChatGPT 桌面客户端、手机端。本工具独立开发，与 OpenAI、飞书、Google 或 Microsoft 没有隶属或官方合作关系。飞书和 ChatGPT 的网页变化可能影响兼容性，不承诺所有网站版本和内容都能完全保留。

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
| *.oaiusercontent.com、*.oaistatic.com | 下载回复引用的 OpenAI 图片素材；不是执行远程代码。 |
| 可选 https://*/* | 仅为用户手动输入并授权的单个外部图片域名下载图片。不会默认申请访问所有 HTTPS 网站，不会向其他网站注入内容脚本。 |

远程代码：不使用。Markdown、净化、公式和截图依赖均随扩展本地打包。远程请求只用于用户引用的图片，不下载或执行脚本。

## 数据披露提示

不能仅因没有开发者服务器就声称“不处理任何数据”。本扩展处理网站内容、用户输入的文本、图片和图表；商店数据表单应如实披露这些本地处理行为，并与隐私页面保持一致。最近一次警告也可能包含图片说明、域名或出错公式片段。无广告、无出售数据、无分析追踪、无训练用途。

## 上传文件与图片

1. 运行 `python scripts/package.py`。
2. 上传 `dist/chatgpt-feishu-copy-v1.2.1-store.zip`，其根目录包含 manifest.json。
3. 128×128 图标：`icons/128.png`。
4. 1280×800 真实转换工具截图：`docs/assets/converter-1280x800.png`，仅含公开示例。
5. Chrome 440×280 小型宣传图：`docs/assets/promo-440x280.png`。

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
- 目前未替用户注册商店账号、付款、接受开发者协议或提交审核。商店会独立审核代码、权限、数据声明和素材，准备完成不等于审核通过。

官方参考：[Chrome 注册](https://developer.chrome.com/docs/webstore/register/)、[Chrome 打包要求](https://developer.chrome.com/docs/webstore/prepare/)、[Chrome 图片要求](https://developer.chrome.com/docs/webstore/images/)、[Chrome 本地数据披露](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq/)、[Edge 注册](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/publish/create-dev-account)、[Edge 发布流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。
