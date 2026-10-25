# 项目开发约定

## 目录与验证

- 主仓库位于 `G:\project\chatgpt-feishu-copy`；在仓库根目录执行开发命令。
- 运行测试：`python tests/run_tests.py`。
- 打包：`python scripts/package.py`，产物位于 `dist/`。提交前完成测试和打包，并检查变更的 JavaScript 语法。
- 首次运行测试需安装 Playwright 和 Chromium，具体步骤及手动验收清单见 `CONTRIBUTING.md`。

## 飞书格式参考

- 需要核对飞书粘贴、公式、表格、代码块或图片格式细节时，先查阅 `G:\project\chatgpt-feishu-copy-reference` 中的参考代码与验收材料。
- 参考目录只作本地查阅，不要把其中的私有会话、文档地址、登录配置、浏览器数据或验收产物提交到仓库或打包。
- 自动测试与真实 ChatGPT → 飞书粘贴验收应分别说明；不要把模拟测试表述为真实网站验收。

## 版本与发布

- 2026-10-25 的开发基线为 `manifest.json` 中的 **v1.2.2**，该版本已提交 Chrome 应用商店审核。
- 后续二次开发涉及扩展代码或安装包内容时，**先提升 `manifest.json` 版本号**，再修改实现或生成新包，避免复用审核中版本的版本号。
- 新版本须高于已提交审核的版本；以实际 `manifest.json` 为准，同步维护 `CHANGELOG.md` 和 README 中的当前开发版本。保留 v1.2.2 的历史审核记录。
- PR 说明行为变化、测试结果及已知限制；提交 PR 不等于发布，不自动上传商店或替换审核中的包。
