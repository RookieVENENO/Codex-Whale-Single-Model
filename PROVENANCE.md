# 当前净化副本的来源范围

当前单模型增强分支构建 `single-model-port-20261023-r5`。文中 fixed 标签、旧发行标签与迁移数字是历史记录。

原始提交与附件只在基线项目历史中保留；当前单模型增强仓库和 Release **不再分发上游媒体**。公开仓库只包含本项目自行绘制的几何占位图和静音占位 MP3。需要原版角色、动图或音效的用户，必须自行从 MeteorNOX 原项目固定提交获取，并遵守其 as-is、不授予再许可等条款；下载内容不进入本项目 Git 历史或 Release。下文的原样迁移描述属于此前基线档案阶段，不代表当前公开仓库仍打包这些素材。

# 来源、改编范围与许可

## 单模型增强分支

- 维护者与派生仓库所有者：[RookieVENENO](https://github.com/RookieVENENO)。仓库：[Codex-Whale-Single-Model](https://github.com/RookieVENENO/Codex-Whale-Single-Model)。
- Codex 移植基线与直接来源：[Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)。
- 原始 DSH 项目：[MeteorNOX/DeepSeek-Balance-Whale-Widget](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget)，Copyright (c) 2026 MeteorNOX，MIT。
- 本分支增加：MCP 会话租约、DeepSeek 余额拆分、默认气泡峰谷徽标、随机图片、点按推进和余额校正。没有改变原项目、Codex 移植基线或素材的权利归属。
- 上述修改不是“官方逆向”或官方组件，而是基于公开 MIT 源码的派生与移植。
- 当前公开分支只发布 MIT 代码、文档和原创占位素材；`scripts/fetch-upstream-assets.mjs` 只由用户本地执行，目标 `assets/upstream/` 被 Git 忽略。

本项目将 MeteorNOX 的 dsh-whale-widget 0.3.0-beta 从 DSH Web 挂件适配为 Codex 桌面伴随挂件，插件名称为 api-balance-whale。

## 本次范围和协作关系

- 当前发行版本：**Codex-v0.4(fixixed)**，内部版本 `0.4.1`，构建 `surface-audio-fix-20261007`，历史上游标签 `codex-v0.4.0(fixed)`。安装包见 [fixixed Release](https://github.com/Yang-huai406/Codex-Whale-Public/releases/tag/codex-v0.4.0%28fixixed%29)；完整历史记录见[发行历史](https://github.com/Yang-huai406/Codex-Whale-Public/blob/main/docs/RELEASE-HISTORY.md)。Windows 已进行回归验证；macOS 保留兼容代码，仍需实机验证。没有独立网页，不修改或注入 Codex 安装文件。
- 原项目作者及上游仓库所有者：[@MeteorNOX](https://github.com/MeteorNOX)，原版权与来源声明继续保留。
- 当前独立仓库：[Yang-huai406/Codex-Whale-Public](https://github.com/Yang-huai406/Codex-Whale-Public)，已于 2026-10-05 经维护者授权公开，默认开发分支 `main`；仓库所有者及 Codex 适配维护者为 [@Yang-huai406](https://github.com/Yang-huai406)。这不改变原上游仓库的所有权。
- 历史 0.2.4/macOS 成果见 [原始提交](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/tree/8de181abf5593247f32d57995567dd9f4063e049)。历史归档名称 `archive/for-codex-0.2.4` 仅用于来源追溯，不是当前发布版的安装入口；v0.3 系列整合了 PR #128 的兼容路径。
- 感谢 [@1llysviel](https://github.com/1llysviel) 的 [macOS PR #128](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/pull/128)。本次不会把其工作改称为新原创。

## 保留与改造

保留原框架的角色、图片、动图、音效和主要交互。适配层提供 Electron 透明工具窗口、Windows 原生跟随、GUI 启动器、本地 IPC、当前 API 余额/用量、汇率、账本、恢复日志及安装回滚。

当前版本包含费用归属、设置保存、额度窗口合并、音频资源释放、气泡配置保真等修复。详情见 [README](README.md)、[变更记录](CHANGELOG.md) 和 [已知问题](docs/KNOWN-ISSUES-FIXIXED.md)。

## 许可边界

| 范围 | 许可与分发方式 |
| --- | --- |
| 代码和文档 | MIT，保留 [LICENSE](LICENSE) 中的上游版权 |
| `assets/placeholders/` 中的几何图片与静音音频 | 本项目自行生成，随 MIT 代码公开；不使用上游角色或音频字节 |
| 上游图片、动图、音频 | **当前公开仓库和 Release 不分发**；用户自行从原项目获取，原项目条款不因本项目而改变 |
| vendor/smol-toml | BSD-3-Clause，保留原包许可证 |
| Electron 与 Chromium | 安装时另外下载，保留其自带许可证和第三方声明 |

见 [第三方声明](THIRD_PARTY_NOTICES.md) 和 [素材说明](assets/README.md)。发布包不包含聊天截图、历史测试截图或上游媒体。

## 隐私和历史

公开打包规则排除个人密钥、账号、账本、运行日志、真实账户截图、缓存和本机备份。完整旧实现可通过 Git 历史追溯。历史 For-Codex 发行源于 MeteorNOX 所有的原仓库；迁移后由 Yang-huai406 在独立仓库维护。原档案阶段的7个Codex Release、38个原附件与9个标签保留开发过程；净化候选中5个原附件因图片清理和校验更新改变，另有14个核验文件。四个MP3没有删除或替换。GitHub 新建 Release 的账号与发布时间不能回填，须与这些原始记录区分。原始提交和作者信息保留，不改写原仓库历史、旧发布或主线 Latest。平台验证边界见已知问题文档。

如果认为某个素材侵犯权利，请通过[本仓库 Issues](https://github.com/Yang-huai406/Codex-Whale-Public/issues)说明文件名和依据；核实后由维护者处理。安全问题按 [SECURITY.md](SECURITY.md) 私下报告，不提交凭据或完整日志。
