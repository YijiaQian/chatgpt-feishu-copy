# 参与开发

这是一个无构建步骤的 Manifest V3 浏览器扩展，顶层目录可以直接「加载已解压的扩展程序」。修改后在扩展管理页重新加载，再刷新 ChatGPT。

## 本地验证

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/run_tests.py --work-dir work/test-tmp
python scripts/package.py
```

内核测试只使用本地 HTTP 测试页，不需要 ChatGPT、飞书账号或任何 API 密钥。浏览器可用 `--browser` 参数指定。CI 对 JavaScript 做语法检查并运行内核测试。

涉及 ChatGPT 页面适配或剪贴板兼容时，请额外手动检查：普通回复、Markdown 代码块、普通代码块、Alt + 原始复制、表格公式、图表截图，以及在专用飞书空白文档的 Ctrl+V。请如实区分模拟测试与真实网站验收。

## 报告问题与提交修改

Issue 请提供浏览器版本、扩展版本、操作步骤、去除个人信息的最小 Markdown 示例。不要上传登录配置、凭据、完整私密对话、浏览器用户目录或含签名参数的图片地址。

PR 请说明改变的行为、验证结果及已知限制。依赖代码必须本地打包并保留许可证；不要加入远程执行代码、统计追踪、密钥或后台上传。提交贡献表示同意按项目 MIT 许可分发你的贡献，第三方依赖仍按各自许可分发。
