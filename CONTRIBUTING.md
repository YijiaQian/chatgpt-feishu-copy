# 参与开发

这是一个无构建步骤的 Manifest V3 浏览器扩展，顶层目录可以直接「加载已解压的扩展程序」。修改后在扩展管理页重新加载，再刷新 ChatGPT。

## 本地验证

```bash
python -m pip install playwright
python -m playwright install chromium
python tests/run_tests.py --work-dir work/test-tmp
python scripts/package.py
```

内核测试只使用本地 HTTP 测试页，不需要 ChatGPT、飞书账号或任何 API 密钥。浏览器可用 `--browser` 参数指定。CI 运行维护静态检查、维护工具行为测试、JavaScript 语法检查、内核测试与打包。

涉及 ChatGPT 页面适配或剪贴板兼容时，请额外手动检查：普通回复、Markdown 代码块、普通代码块、Alt + 原始复制、表格公式、图表截图，以及在专用飞书空白文档的 Ctrl+V。请如实区分模拟测试与真实网站验收。

## 报告问题与提交修改

Issue 请提供浏览器版本、扩展版本、操作步骤、去除个人信息的最小 Markdown 示例。不要上传登录配置、凭据、完整私密对话、浏览器用户目录或含签名参数的图片地址。

PR 请说明改变的行为、验证结果及已知限制。依赖代码必须本地打包并保留许可证；不要加入远程执行代码、统计追踪、密钥或后台上传。提交贡献表示同意按项目 MIT 许可分发你的贡献，第三方依赖仍按各自许可分发。

## 维护工具准备

维护工具需要 Python 3.10+、Node 22.12+ 和 Git。完整维护检查需要带历史的 Git checkout；只有手动安装 ZIP 时，请先 clone 源仓库再开发。扩展运行不需要 Node；npm 依赖只用于开发检查。在仓库根目录建立 Python 环境，Windows PowerShell 使用：

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --require-hashes -r requirements-dev.lock
npm ci
python -X utf8 scripts/check_maintenance.py
python -X utf8 -m unittest discover -s scripts/tests -v
```

macOS/Linux 激活环境改用 `source .venv/bin/activate`，其余命令相同。产品测试另在同一环境安装前文的 Playwright 和 Chromium，再运行 `python tests/run_tests.py --work-dir work/test-tmp` 与 `python scripts/package.py`。

可选提交检查先运行 `git config --get core.hooksPath` 并查看 `git rev-parse --git-path hooks` 所指目录。只有未配置自定义 hooksPath 且没有已有 pre-commit hook 时，才运行 `python -m pre_commit install`；有现成 hook 时把 `python -X utf8 scripts/staged_checks.py` 合并到原入口，不覆盖。worktree 可能共享 hooks，试点不自动安装。也可以只手动执行该脚本。

检查会读取真正暂存的文档、Notes 和 Python，不修改工作区或暂存区。Markdown lint 和 JavaScript 语法由完整检查及 CI 执行。规则和已知边界见 [维护检查](docs/maintenance.zh-CN.md)。需要手动修复 Markdown 格式时可执行 `npm run lint:md:fix`，随后阅读 diff 再暂存。
