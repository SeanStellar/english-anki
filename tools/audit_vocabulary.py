"""Audit built-in word data and decode image assets without changing them."""
from __future__ import annotations
import argparse
import json
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
try:
    from PIL import Image
except ImportError:
    raise SystemExit('缺少 Pillow；请先安装 tools/requirements-audit.txt 中的依赖。')
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'renderer' / 'data'
SCENES = ROOT / 'renderer' / 'assets' / 'memory-scenes'
REPORT = ROOT / 'audit' / '词库审核报告.md'

def read_json(name):
    return json.loads((DATA / name).read_text(encoding='utf-8-sig'))

def inspect_image(pair):
    word_id, file = pair
    try:
        with Image.open(file) as img:
            if img.format != 'WEBP':
                return word_id, f'格式为 {img.format}，预期 WEBP'
            img.load()
            if img.width < 100 or img.height < 100:
                return word_id, f'尺寸过小：{img.width}×{img.height}'
    except Exception as exc:
        return word_id, f'图片不可读取：{type(exc).__name__}'
    return word_id, None

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--report', type=Path, default=REPORT)
    args = parser.parse_args()
    manifest = read_json('decks.json')
    words = []
    errors, warnings = [], []
    for deck in manifest.get('decks', []):
        file = deck.get('file', '')
        if not re.fullmatch(r'[A-Za-z0-9._-]+\.json', file):
            errors.append(f'词书文件名无效：{file}'); continue
        entries = read_json(file)
        if not isinstance(entries, list):
            errors.append(f'{file} 内容不是数组'); continue
        for item in entries:
            if not isinstance(item, dict):
                errors.append(f'{file} 包含非对象词条'); continue
            if item.get('deckId') != deck.get('id'):
                errors.append(f"词书归属不一致：{item.get('id', '无 ID')}")
        words.extend(x for x in entries if isinstance(x, dict))
    ids = Counter(str(x.get('id', '')) for x in words)
    for value, count in ids.items():
        if not value or count > 1: errors.append(f'词条 ID 为空或重复：{value!r}（{count}）')
    for key in ('word', 'meaning', 'phonetic', 'pos'):
        missing = [str(x.get('word', x.get('id', '未知'))) for x in words if not str(x.get(key) or '').strip()]
        if missing: warnings.append(f'{key} 为空（{len(missing)}）：' + '、'.join(missing[:50]))
    by_deck = Counter((str(x.get('deckId', '')), str(x.get('word', '')).strip().casefold()) for x in words)
    for (deck, word), count in by_deck.items():
        if word and count > 1: warnings.append(f'{deck} 同词书内重复词形：{word}（{count}）')
    tiers = Counter(str(x.get('tier', '未分类')) for x in words)
    base = {x['id']: x for x in read_json('memory-stories.json').get('cards', [])}
    override = {x['id']: x for x in read_json('memory-stories-v3-overrides.json').get('cards', [])}
    no_story = []
    for item in words:
        one, two = base.get(item.get('id'), {}), override.get(item.get('id'), {})
        if not (one.get('anchor') or two.get('anchor')) or not (one.get('sentence') or two.get('sentence')):
            no_story.append(str(item.get('word', item.get('id')))); continue
        merged = {**one, **two}
        if not merged.get('anchor') or not merged.get('sentence'):
            no_story.append(str(item.get('word', item.get('id'))))
    if no_story: warnings.append(f'记忆锚点或联想句缺失（{len(no_story)}）：' + '、'.join(no_story[:50]))
    tasks = [(str(x.get('id')), SCENES / (str(x.get('id')) + '.webp')) for x in words if x.get('id')]
    image_errors = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for count, (word_id, error) in enumerate(pool.map(inspect_image, tasks), 1):
            if error: image_errors.append(f'{word_id}：{error}')
            if count % 500 == 0: print(f'已解码 {count}/{len(tasks)} 张图片', flush=True)
    errors.extend(image_errors)
    original = ROOT / '.backup' / 'stability-before-20261028' / 'zhuanshengben-3000.json'
    changes = []
    if original.is_file():
        before = {x['id']: x for x in json.loads(original.read_text(encoding='utf-8-sig'))}
        for item in words:
            old = before.get(item.get('id'))
            if old and (old.get('pos') != item.get('pos') or old.get('meaning') != item.get('meaning')):
                changes.append((item, old))
    lines = ['# 英语词库结构审核报告', '', f'审核时间：{datetime.now().astimezone().strftime("%Y-%m-%d %H:%M %z")}', '',
        '本报告检查字段、编号、词书归属、记忆内容和图片解码；不能代替对所有释义、例句、图文匹配的人工逐条审核。', '',
        f'- 内置词书：{len(manifest.get("decks", []))} 本', f'- 词条总数：{len(words)}', f'- 唯一 ID：{len(ids)}',
        f'- 分层数量：{dict(tiers)}', f'- 已完整解码图片：{len(tasks)} 张', f'- 结构错误：{len(errors)}', f'- 待检查提醒：{len(warnings)}', '',
        '## 本轮已修正的词性字段', '', '根据词条已有释义补齐词性；原始文件保存在 `.backup/stability-before-20261028/zhuanshengben-3000.json`。', '',
        '| 单词 | 旧词性 | 新词性 | 现有释义 |', '| --- | --- | --- | --- |']
    if changes:
        for item, old in changes:
            def esc(v): return str(v or '空').replace('|', '\\|').replace('\n', ' ')
            lines.append(f"| {esc(item.get('word'))} | {esc(old.get('pos'))} | {esc(item.get('pos'))} | {esc(item.get('meaning'))} |")
    else: lines.append('| 暂无本轮变更 | — | — | — |')
    lines += ['', '## 结构错误', ''] + ([f'- {x}' for x in errors] if errors else ['未发现。'])
    lines += ['', '## 待检查提醒', ''] + ([f'- {x}' for x in warnings] if warnings else ['未发现字段缺失或重复词形。'])
    lines += ['', '## 仍需人工审核', '', '- 释义是否符合考试语境、音标和词性是否准确。', '- 熟词锚点、联想句是否自然且有助于记忆；图片是否确实表达该词义。', '- 自动规则和文件存在性不能证明上述内容准确。', '']
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text('\n'.join(lines), encoding='utf-8')
    print(f'词条 {len(words)}；图片 {len(tasks)}；错误 {len(errors)}；提醒 {len(warnings)}。报告：{args.report}', flush=True)
    return 1 if errors else 0
if __name__ == '__main__':
    sys.exit(main())
