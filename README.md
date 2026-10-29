# 英语 Anki

熟词锚点记忆与 FSRS 间隔复习一体化的英语学习桌面应用。每个词条由“熟词 + 场景插画 + 具体事件联想句”构成，配合 FSRS 安排复习。

> 当前版本 **4.1.0**：通用专升本 3000 词、多词书结构、蓝色科技 UI 与蓝色图标。

## 功能

- 专升本英语 3000 词通用词库（高职英语课程标准附录），3000 张场景插画
- 多词书清单：内置词书由 `renderer/data/decks.json` 管理，可继续扩展四级、六级、雅思、考研等词书
- 熟词锚点联想、图像提示与逐步揭晓
- FSRS 间隔复习、每日新词/复习上限、负荷保护
- 自定义词库：CSV/TSV/TXT 导入、CSV 导出、编辑与内容纠错
- Anki 词库包（.apkg）导出：任意词库可导出，内置词库附带场景插画
- 学习统计、记忆星图、薄弱词复习、个性化 FSRS 校准
- SHA-256 备份、gzip 备份、旧备份兼容、跨设备文件夹同步
- 本地优先；无账号、无云端依赖

## 多词书

新增四级、六级、雅思、考研等词书不需要改代码：

1. 在 `renderer/data/` 放入词条数组 JSON，每条至少包含 `id`、`word`、`phonetic`、`pos`、`meaning`、`tier`、`tierName`、`deckId`；`id` 全局唯一。
2. 在 `decks.json` 的 `decks` 数组追加一项：`id`、`name`、`short`、`desc`、`color`、`icon`、`file`；需要分层时再加 `tiers` 数组（每层带 `id`、`name`、`tier`）。
3. 重启应用，首页和词库页会自动出现新词书；`defaultDeck` 决定默认进入哪一本。

## 开发

要求 Node.js 22+。

```bash
npm install
npm start              # 启动应用
npm test               # 单元测试
npm run test:integration   # Electron 备份恢复集成测试
npm run dist           # 构建 NSIS 安装程序与便携版
```

`npm run dist` 输出 `dist/英语-Anki-4.1.0-Setup.exe` 和 `dist/英语-Anki-4.1.0-Portable.exe`。

## 数据位置

- 安装版：`%APPDATA%\english-anki`
- 便携版：exe 同目录的 `EnglishAnkiData`
- 备份：默认在用户数据目录的 `backups`，自动保留最近 20 份
- 同步：选择 OneDrive/坚果云等目录后生成 `english-anki-sync.json`

升级或覆盖安装前，建议先在设置中备份；应用自身也会在关窗前写入并备份。

## 目录

```
main.js                  Electron 主进程、数据/备份/同步/窗口
apkg-export.js           Anki .apkg 词库包生成
preload.bundle.js        sandbox preload
renderer/                前端页面、样式、词库和故事数据
  assets/memory-scenes/  3000 张 800x600 WebP 插画
  data/decks.json        内置词书清单
  data/zhuanshengben-3000.json  通用专升本 3000 词
tests/                   单元测试与 Electron 集成测试
tools/                   词库审核工具
audit/                   词库审核报告
```

## 说明

- 插画为 800×600 WebP；原始 960×720 版本另行备份，不在仓库中。
- 故事句经过批量重写与自动审计，仍建议对内容做人工抽查。
- `.apkg` 导出使用 Anki 兼容的 `anki-apkg-export` 生成；导入后的卡片是全新卡片，不继承应用内 FSRS 进度。

## License

[MIT](LICENSE)
