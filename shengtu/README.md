# 考研英语锚点插图（shengtu）

这是“英语 Anki”应用的熟词锚点插图生成管线（A 路线），当前包含 20 张考研英语试点卡。每张卡由“熟词锚点 + 记忆句 + 3 件道具 + 3 拍动作”组成，图内不出现任何文字；单词、释义由 Anki 或应用叠加。

生成规则以 [AGENTS.md](AGENTS.md) 为准，尤其是第 0 节“锚点零容忍”：锚点不合格的卡不允许生成，也不允许发布。

## 目录

```text
shengtu/
├─ AGENTS.md                       锚点、scene 卡与画风规范
├─ ag_kaoyan_gen.py                SenseNova U1.5 Lite 生图脚本
├─ kaoyan_cards.json               20 张卡：word / anchor / 记忆句 / 3 道具 / 3 拍
├─ ag_stable_config.example.py     API Key 模板
├─ requirements.txt                Python 依赖
├─ .gitignore                      排除本地 Key 与 PNG 原图
└─ Photos/
   ├─ anki_cards/hb-0040-address.png   固定风格参考
   └─ kaoyan_cards/ky-*.webp           20 张 800×600 预览
```

试点词：acute、butterfly、connection、donkey、education、feeling、global、historical、increasingly、infrastructure、librarian、movement、natural、photograph、pressure、production、scientist、service、solution、worker。

## 运行

要求 Python 3.10+。

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
copy ag_stable_config.example.py ag_stable_config.py   # macOS/Linux: cp
```

编辑 `ag_stable_config.py`，填入自己的 SenseNova API Key，然后：

```bash
python ag_kaoyan_gen.py --dry-run
python ag_kaoyan_gen.py --only acute --force
python ag_kaoyan_gen.py --workers 3
```

## 输出

- 脚本生成 1448×1086 PNG，保存在 `Photos/kaoyan_cards/`；这些原图已被 `.gitignore` 排除。
- 仓库内提交的是 800×600 WebP（q84）预览，与应用的 `renderer/assets/memory-scenes/` 插画规格一致。
- 风格参考固定为 `Photos/anki_cards/hb-0040-address.png`；应用仓库中的 `renderer/assets/memory-scenes/hb-0040.webp` 是同一张图的 800×600 版本。
- 接口：SenseNova U1.5 Lite，`/v1/images/edits`，`1536x1152`，生成后自动去白边并裁成 1448×1086。

## 说明

- `ag_stable_config.py` 含明文 API Key，已被 `.gitignore` 排除；不要提交、不要分享。
- 本仓库只包含 20 张试点卡和当前 A 路线脚本；完整 2712 词词表、165 张画风库和旧管线脚本不在此目录。
- `AGENTS.md` 是本地工作规范，路径按本地目录书写，锚点与 QC 规则可直接复用。
- 图片为模型生成，发布前仍需按 `AGENTS.md` 第 7 节逐项 QC。
