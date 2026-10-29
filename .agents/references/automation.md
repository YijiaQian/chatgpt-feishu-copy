# 检查与接线

本项目通过 [维护检查](../../docs/maintenance.zh-CN.md) 接入文档、Notes、Python lint、Markdown lint 和 JavaScript 语法检查，复用已有 GitHub Actions 产品测试与打包入口。命令见 [参与开发](../../CONTRIBUTING.md)。

hook 只读检查 Git index 快照，完整静态检查在本地和 CI 运行。没有暂存格式化器，不需要上游隐藏未暂存修改的两阶段顺序。检查不安装依赖、不发布、不合并，任何必要子检查失败都返回非零。

本地文件存在、锚点正确、格式合规和归档字节完整，只证明对应规则满足。文档事实需核对源码，产品行为需运行浏览器测试，真实粘贴需按手动清单验收；不把已配置 CI 当成远端执行证据。

归档历史基线在本地取 HEAD，在 CI 取 PR base 或 push before。当前校验器防止日常误改，待审分支仍可修改校验器本体；它不提供恶意变更隔离。远端 required checks 是否启用要另查托管平台。
