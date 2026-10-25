# 英语 Anki

熟词锚点记忆与 FSRS 间隔复习一体化的英语学习桌面应用。每个词条由“熟词 + 场景插画 + 具体事件联想句”构成，配合 FSRS 安排复习。

> 本仓库源码由 4.0.0 安装包恢复整理后继续维护；当前版本为 4.0.3。

## 功能

- 河北专升本英语 3000 词全量词库，3000 张场景插画
- 熟词锚点联想、图像提示与逐步揭晓
- FSRS 间隔复习、每日新词/复习上限、负荷保护
- 自定义词库：CSV/TSV/TXT 导入、CSV 导出、编辑与内容纠错
- Anki 词库包（.apkg）导出：任意词库可导出，内置词库附带场景插画
- 学习统计、记忆星图、薄弱词复习、个性化 FSRS 校准
- SHA-256 备份、gzip 备份、旧备份兼容、跨设备文件夹同步
- 本地优先；无账号、无云端依赖

## 开发

要求 Node.js 22+。

```bash
npm install
npm start          # 构建 sandbox preload 并启动
npm test           # 单元测试
npm run test:e2e   # Electron 端到端测试
npm run test:all   # 单元 + E2E
npm run audit:content
npm run audit:images
npm run dist       # 构建 NSIS Setup 与 Portable
```

`npm start` 会先执行 `scripts/build-preload.js`，将 `preload.js` 和 `ts-fsrs` 打包为 sandbox preload。

## 数据位置

- 安装版：`%APPDATA%\english-anki`
- 便携版：exe 同目录的 `EnglishAnkiData`
- 备份：默认在用户数据目录的 `backups`，可在设置中更换；自动保留最近 20 份
- 同步：选择 OneDrive/坚果云等目录后生成 `english-anki-sync.json`

升级或覆盖安装前，建议先在设置中备份；应用自身也会在关窗前写入并备份。

## 构建与签名

```bash
npm run dist
```

当前构建默认未签名，Windows 首次运行会出现 SmartScreen 提示。拥有代码签名证书后，通过环境变量交给 electron-builder：

```powershell
$env:CSC_LINK = "C:\path\to\certificate.pfx"
$env:CSC_KEY_PASSWORD = "your-password"
npm run dist
```

没有证书时无法生成可信签名包；脚本不会用自签名证书伪装已签名版本。

## 目录

```
main.js                  Electron 主进程、数据/备份/同步/窗口
apkg-export.js           Anki .apkg 词库包生成
preload.js               sandbox preload（ts-fsrs 与安全 API）
renderer/                前端页面、样式、词库和故事数据
  assets/memory-scenes/  3000 张 800x600 WebP 插画
  data/                  词表、故事与版本元数据
content/                 故事句改写映射
scripts/                 构建 preload、数据压缩、图片优化、审计
tests/                   单元与 Electron E2E
```

## 说明

- 插画为 800×600 WebP；原始 960×720 版本另行备份，不在仓库中。
- 故事句经过批量重写与自动审计，仍建议对内容做人工抽查。
- `.apkg` 导出使用 Anki 兼容的 `anki-apkg-export` 生成；在“词库”页选择词库后点击“导出 Anki”。内置全量词库会附带 3000 张场景插画，全量包约 160MB。导入后的卡片是全新卡片，不继承应用内 FSRS 进度。

## License

[MIT](LICENSE)
