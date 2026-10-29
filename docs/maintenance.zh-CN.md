# 维护检查

开发验证分为文字与规则审阅、静态检查、产品测试三部分。接入方式见 [CONTRIBUTING](../CONTRIBUTING.md)，来源、适配与许可见 [维护资源说明](../.agents/README.md)。

lint 根据明确规则找问题：Ruff 在 Python 中检查未定义名字、未使用导入和语法错误；Markdownlint 检查标题层级、空行、缩进和代码块语言标记。它们不会证明文档与产品一致。formatter 用来自动排版，本试点没有在提交时运行 formatter；`npm run lint:md:fix` 是需审阅 diff 的手动修复入口。

`python -X utf8 scripts/check_maintenance.py` 按顺序执行本地文件与 Markdown 锚点检查、技能元数据和常驻规则篇幅检查、Notes 格式、Python lint、Markdown lint、现有 JavaScript 语法检查和归档历史检查。任何一步失败即返回非零。外部链接、自然语言正确性、JavaScript 变量与类型不在本次 lint 的覆盖范围。`vendor/`、`work/`、`dist/`、环境目录和冻结归档按检查器边界排除。

可选 Git hook 运行 `scripts/staged_checks.py`，将 Git index 导出到临时目录，验证真正将提交的文档、Notes 和 Python，随后比较 HEAD 中的归档基线。它读取暂存快照，不暂存、不隐藏未暂存修改，也不改文件。Markdown lint 和 JavaScript 语法在完整本地检查及 CI 执行；hook 不承诺覆盖它们。仓库脚本仍属于可信开发代码，不提供对恶意脚本的执行隔离。

三个技能分别负责 [文档归属与核验](../.agents/skills/maintain-docs/SKILL.md)、[完整语义与文字整理](../.agents/skills/maintain-prose/SKILL.md)、[长期决策记录](../.agents/skills/maintain-decision-notes/SKILL.md)。按任务读取引用，不能只靠关键词删除文字。常驻入口的硬预算由 `scripts/doc-policy.json` 定义；普通页面超软预算只提示，不能据此截断事实。

维护脚本不运行产品浏览器测试、不安装依赖或创建发布。原有 `python tests/run_tests.py` 与 `python scripts/package.py` 继续单独执行。自动测试、配置存在、CI 实际成功及远端合并保护是不同证据。真实网站粘贴仍按手动验收清单完成。
