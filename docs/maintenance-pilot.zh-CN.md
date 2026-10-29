# 维护试点比较

试点对象为 chatgpt-feishu-copy，改造基线为 `9fcfe78ebaabc5ef7cc1d7fae4c2dbc1324b5ba3`，分支为 `trial/agent-maintenance`。维护资源来自固定上游提交，来源与适配见 [.agents/README](../.agents/README.md)。本次验证支持文档归位与错误检测能力，不构成对 Agent 生产率、模型 token 或长期返工率的对照实验。

## 项目选择

2026-10-29 查看账号近期更新仓库，重点比较了扩展、genai-deepwiki 和 diwa。扩展规模小，已有可离线运行的产品测试与可重复打包，适合独立分支验证。genai-deepwiki 有运行中的同步与定时任务，diwa 涉及部署和认证；首次试点选择影响面更小的扩展。备份与配置镜像未作为主动开发试点。

## 同一基线的比较

在 Windows、Python 3.11.7、Node 24.11.1 下测量；GitHub Actions 配置使用 Python 3.12、Node 22，远端运行结果应单独查看对应检查记录。

| 观察项 | 改造前 | 改造后及解释 |
| --- | --- | --- |
| README | 144 行、6596 非空白字符，混有历史验收与重复介绍 | 116 行、5165 非空白字符，字符减少约 21.7%；这是阅读入口大小，不是 token 或质量分数 |
| 历史证据 | 各版本样本与商店状态混在首页 | 迁入 [验证历史](validation-history.zh-CN.md)，原验证段落除相对链接外逐字核对保留 |
| Markdown 格式 | 同一配置检出 7 处问题，分布于 2 个文件 | 0 处；只补列表空行和移除多余空行，没有改变隐私条款 |
| 本地链接 | 原有 12 个 Markdown 文件、48 个链接均有效，但没有持续检查入口 | 增加本地文件、标题锚点、skill 元数据及篇幅检查；没有声称发现原有断链 |
| Python | 选用的 Ruff 规则对原脚本检查通过 | 持续检查未定义名字、未使用导入与语法；没有为制造结果修改已合规源码 |
| 部分暂存 | 原 CI 无文档/Notes/Python lint，未提供对应 hook | 真实临时 Git 仓库证明：工作区修好而 index 仍有断链或 F821 时拒绝，index 修好而工作区仍有 F821 时通过；两者原文保持不变 |
| 产品回归 | 51/51 | 51/51；本地浏览器夹具，未新增真实网站粘贴验收 |
| 维护工具验证 | 未提供 | 14/14；包括有效输入、坏锚点、预算、Notes 状态、归档篡改、失败传播与部分暂存 |
| 运行包 | 50 个文件 | 文件集合相同，仅 manifest 版本从 1.2.5 改为 1.2.6；逐文件确认其他运行内容相同，manifest 其他字段相同 |

README 的能力、操作、隐私、权限、资源限制及兼容边界保留。新增 docs 导航和分层 AGENTS，三个技能连同引用与模板按需读取。Notes 只记录此次只读检查选择的长期理由，没有导入上游项目历史。

## 成本与采用范围

一次本机完整静态检查测得 6.37 秒，包含 14 个 JavaScript 文件的既有语法检查，不含依赖安装、产品浏览器测试和维护工具行为测试；该耗时是一次观察，不是稳定性能保证。维护行为测试一次约 14.4 秒。第一次还需安装带哈希的 Python 开发依赖与 npm 锁定依赖。

仓库 Markdown 文件从 12 个增至 40 个，包含按需读取的技能、共享参考、模板与区域规则；常规文档检查扫描 39 个，排除冻结区域规则。新增文件和锁文件会增加维护成本，README 变短不能说明全仓更小。手动包因附带完整开发资源增加约 70 KB（约 3%）；没有打入依赖安装目录、工作记录或浏览器数据。商店运行包不增加维护工具。

只采用适用的 lint 和只读 hook，复用现有产品测试与 CI。未引入 MPE 预览、全仓源码重排、自动发布、pre-push 调度器或新的部署流程。Markdownlint 手动修复需要阅读 diff；提交检查不写暂存区，也不自动安装到共享 hooks。GitHub Releases 仍只公开 manual.zip 及其校验值，store.zip 只保留本地用途。

开发依赖安装时发现上游旧 Markdownlint 链中的已知问题，已升级 Markdownlint 并固定修复的 KaTeX/RE2JS 版本，`npm audit` 为 0 项，`pip check` 通过。这只描述此次新引入的开发依赖，没有审计或升级扩展 `vendor/` 中的运行依赖。

## 复核与边界

按 [CONTRIBUTING](../CONTRIBUTING.md) 安装开发依赖后执行：

```text
python -X utf8 scripts/check_maintenance.py
python -X utf8 -m unittest discover -s scripts/tests -v
python tests/run_tests.py --work-dir work/test-tmp
python scripts/package.py
git diff 9fcfe78ebaabc5ef7cc1d7fae4c2dbc1324b5ba3 -- README.md docs/validation-history.zh-CN.md
```

基线来自 `git archive` 导出的同一提交，格式比较使用当前同一 Markdownlint 配置。原始对比脚本、JSON、lint 输出及本机检查日志保留在试点工作区被忽略的 `work/maintenance-pilot/`，不进入公开包。ZIP 已核对清单与私有目录排除，并重复打包验证内容一致。

本次没有重做真实 ChatGPT → 飞书粘贴，也没有安装全局技能或改动主工作区的运行环境。以上数据来自 v1.2.6 发布准备之前的试点快照；后续发布说明的文字调整不追溯改变这些测量。该版通过 GitHub 手动包分发，未向应用商店提审。合并、Release 发布与合并保护需分别查看 GitHub 状态，不能由本地检查推出。建议在下一次真实维护任务中继续观察审阅成本、发现的有效问题和工具耗时，再决定推广范围。
