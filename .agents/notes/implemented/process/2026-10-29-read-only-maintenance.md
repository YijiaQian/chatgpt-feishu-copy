# Agent Note: 只读暂存检查与分层文档维护

Status: implemented

维护规则按需读取三个技能和共享参考，项目规则继续拥有版本、隐私、真实网站验收与发布约束。当前使用说明归 README，历史验证归独立页面，长期理由归 Notes。

提交 hook 导出 Git index 并只读检查文档、Notes 与 Python。完整 Markdown lint、JavaScript 语法、产品测试及打包由本地验证和现有 CI 承担。选择只读 hook，是为了保留部分暂存时的工作区和 index 原文。考虑过上游两阶段自动格式化，但当前项目没有统一的源码布局规范；首次接入就格式化旧代码会增加无关 diff 和冲突处理成本。

代价是提交 hook 不覆盖全部检查，需继续运行完整检查或等待 CI；lint 也不能检查文档事实或真实粘贴。归档基线保护用于日常误改，不能抵御同时改写校验器的恶意分支。行为验证与试点结果见 [比较记录](../../../../docs/maintenance-pilot.zh-CN.md)。
