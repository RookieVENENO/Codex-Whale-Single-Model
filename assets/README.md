# 素材说明

本目录公开提交只包含：

- `placeholders/`：本项目自行绘制的几何占位图与静音 MP3。
- `whale-widget.js`：MIT 代码，不是美术素材。

原项目的角色图、动图和音效不随本仓库或 Release 分发。需要原版素材时，请先阅读 [MeteorNOX/DeepSeek-Balance-Whale-Widget PROVENANCE](https://github.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/blob/main/PROVENANCE.md)，然后在项目根目录运行：

```powershell
node scripts/fetch-upstream-assets.mjs --accept-upstream-terms
```

脚本从固定提交获取素材，校验 SHA-256，并写入 `assets/upstream/`。该目录已被 `.gitignore` 排除，不应提交到 Git 或重新上传到 Release。

复制或使用原项目素材的权利与风险由使用者自行核对和承担。本项目不授予这些素材的再许可。
