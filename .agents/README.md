# 维护资源来源

三个技能、共享 references/templates、Notes 规则与五个检查脚本采用自 [WncFht/agent-maintenance](https://github.com/WncFht/agent-maintenance/tree/527af880f6feb0e352cae42b2c7601dc443b2b70)，固定提交 `527af880f6feb0e352cae42b2c7601dc443b2b70`，于 2026-10-29 引入。检查脚本为 `check_docs.py`、`doc_checks.py`、`notes_guard.py`、`check_archive.py`、`staged_checks.py`，均位于 `scripts/`。保留 [上游 MIT 许可](../scripts/agent-maintenance.LICENSE) 中的版权声明。

同时复用了上游 `test_doc_checks.py` 与 `test_pipeline.py`，并适配本项目的暂存检查依赖。原许可同样覆盖这些测试。

本项目适配了文档忽略目录、Windows UTF-8 读取、暂存快照检查命令与 Notes 命令拼写，并以现有 CI 加上 `check_maintenance.py` 调度。Python 开发依赖及带哈希的锁文件沿用该提交；Markdownlint 另由 npm 锁文件固定。Markdownlint 升级到 0.24.0，并固定修复开发依赖 KaTeX 与 RE2JS 的已知问题；这些 npm 依赖不会进入扩展运行包，也不替换 `vendor/` 中的运行依赖。没有复制上游项目的历史决策、发布流程或 MPE 预览载荷。

本项目的 [开发规则](../AGENTS.md)、[文档分工](../docs/AGENTS.md)、[工具检查边界](../docs/maintenance.zh-CN.md) 优先于共享参考里的通用示例。Notes 规范见 [入口](notes/README.md)。
