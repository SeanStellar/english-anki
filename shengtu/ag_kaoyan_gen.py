# -*- coding: utf-8 -*-
"""A 路线：hb-0040 作风格参考，按 kaoyan_cards.json 生成考研词汇锚点卡。

用法:
  python ag_kaoyan_gen.py --dry-run
  python ag_kaoyan_gen.py --only production,acute
  python ag_kaoyan_gen.py --force --workers 3
"""
import argparse
import base64
import json
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import numpy as np
import requests
from PIL import Image, ImageOps

from ag_stable_config import API_KEY

BASE = Path(__file__).resolve().parent
CARDS_PATH = BASE / "kaoyan_cards.json"
OUT = BASE / "Photos" / "kaoyan_cards"
REF = BASE / "Photos" / "anki_cards" / "hb-0040-address.png"
URL = "https://token.sensenova.cn/v1/images/edits"
MODEL = "sensenova-u1.5-lite"
SIZE = "1536x1152"
FINAL_SIZE = (1448, 1086)

REF_RULE = """Style reference: 第 1 张图只提供画风、纸张质感、笔触和配色，不提供任何内容与构图。
必须完全重画下面的新场景：不要出现参考图中的快递员、三岔路口、纸箱、紫色箭头、紫色螺旋线、成排树木，也不要沿用参考图的中心构图。
画风严格对齐参考图：手绘儿童绘本插画，水粉+粉蜡笔+彩铅混合，粗糙水彩纸的明显颗粒，颜料颗粒沉淀和蜡笔排线，边缘略毛糙、颜色轻微渗化；圆脸、大头、纯黑点状眼睛、腮红、小鼻子、短圆四肢、简单块状头发；低饱和土色系，赭黄、奶油、暖褐、砖红、橄榄绿、灰蓝、灰紫，比参考图整体压暗一档，减少大面积亮黄和亮白；柔和暖光、彩色阴影；不是数字平涂、不是矢量、不是3D、不是照片、不是动漫。"""

COMP = """Composition: 只画一个连贯场景和一个最清楚的动作高潮；主体占画面约六成；角色严格按 Main character 描述，不要额外添加路人，也不要重复角色；最多保留三件关键实物；背景只用两三笔提示地点；每张卡重新设计镜头，禁止模板构图；full-bleed，插图铺满整个 4:3 画布，四边到边；画面四边都必须有场景颜色和笔触，绝对不要奶油色纸边、白色留白、纸张边框或相框。"""

CONS = """Constraints: 即使缩成小卡片、不看任何文字，也能立刻猜出发生了什么；所有关键物体必须具体画出且轮廓清楚；画面必须铺满到四边；不显示英文单词、中文解释、数字、标牌或说明文字。"""

AVOID = """Avoid: 文字，字母，单词，字幕，标题，标签，注释，说明框，时间轴，信息图，流程图，图解箭头，卡片UI，网页界面，拼贴画，分栏，分镜格，水印，logo，二维码，奶油色纸边，白色留白，纸张边框，相框，边框，低清晰度，模糊，主体过小，重复人物，重复物体，多余路人，第三个人物，无法理解的动作，纯装饰背景，抽象符号代替真实物体，照片写实，三维渲染，电影概念设计，塑料光泽，复杂机械细节，锐利硬边，霓虹高饱和，背景拥挤，写实皮肤，恐怖气氛，固定模板构图，快递员，纸箱，紫色箭头，三岔路口，钟表表盘数字，仪表刻度数字，罗马数字。"""


def load_cards():
    with open(CARDS_PATH, encoding="utf-8") as f:
        return json.load(f)


def validate(card):
    sc = card["scene"]
    assert len(sc["props"]) == 3, f"{card['word']}: props != 3"
    assert len(sc["beats"]) == 3, f"{card['word']}: beats != 3"
    assert card["anchor"].lower() != card["word"].lower(), f"{card['word']}: anchor == word"
    s = card["sentence"].lower()
    assert card["anchor"].lower() in s, f"{card['word']}: anchor missing in sentence"
    assert card["word"].lower() in s, f"{card['word']}: word missing in sentence"
    for key in ("word", "targetSense", "anchor", "anchorMeaning", "relation", "sentence"):
        assert str(card.get(key, "")).strip(), f"{card['word']}: empty {key}"
    for key in ("setting", "actor", "props", "beats", "ending"):
        assert sc.get(key), f"{card['word']}: empty scene.{key}"


def build_prompt(card):
    sc = card["scene"]
    beats = "\n".join(f"{i + 1}. {b}" for i, b in enumerate(sc["beats"]))
    return f"""Use case: illustration-story
Asset type: 英语单词卡的记忆锚点插图，缩小后也必须一眼看懂
Primary request: 为单词 {card['word']}（含义：{card['targetSense']}）绘制一幅记忆锚点插图。
Memory anchor: 熟词 {card['anchor']}（{card['anchorMeaning']}）；记忆句：{card['sentence']}
Visual logic: {card['relation']}
Scene/backdrop: {sc['setting']}
Main character: {sc['actor']}
Visible physical objects: {'、'.join(sc['props'])}
Action sequence to compress into one coherent climax frame:
{beats}
Final visual result: {sc['ending']}
Card-specific art direction: {card['artDirection']}
{REF_RULE}
{COMP}
{CONS}
{AVOID}
""".strip()


def trim_near_white(im):
    a = np.asarray(im).astype("float32").mean(axis=2)
    h, w = a.shape
    row, col = a.mean(axis=1), a.mean(axis=0)
    top = 0
    while top < h and row[top] > 235:
        top += 1
    bottom = h - 1
    while bottom > top and row[bottom] > 235:
        bottom -= 1
    left = 0
    while left < w and col[left] > 235:
        left += 1
    right = w - 1
    while right > left and col[right] > 235:
        right -= 1
    if (left, top, right + 1, bottom + 1) == (0, 0, w, h):
        return im
    return im.crop((left, top, right + 1, bottom + 1))


def crop_and_finalize(raw_path, final_path):
    im = Image.open(raw_path).convert("RGB")
    im = trim_near_white(im)
    im = ImageOps.fit(im, FINAL_SIZE, method=Image.Resampling.LANCZOS)
    im.save(final_path, "PNG", optimize=True)
    return im.size


def generate(card, ref_data_url):
    prompt = build_prompt(card)
    payload = {
        "model": MODEL,
        "images": [{"image_url": ref_data_url}],
        "prompt": prompt,
        "n": 1,
        "size": SIZE,
        "response_format": "b64_json",
        "watermark": False,
        "prompt_extend": False,
    }
    last = None
    for attempt in range(1, 4):
        try:
            s = requests.Session()
            s.trust_env = False
            h = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}
            r = s.post(URL, headers=h, json=payload, timeout=300)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < 3:
                time.sleep(2 ** attempt)
                continue
            d = r.json()
            if d.get("error"):
                last = f"HTTP {r.status_code}: {json.dumps(d['error'], ensure_ascii=False)[:200]}"
                if attempt < 3:
                    time.sleep(2 ** attempt)
                    continue
                raise RuntimeError(last)
            raw = base64.b64decode(d["data"][0]["b64_json"], validate=True)
            raw_path = OUT / f"{card['id']}_raw.png"
            final_path = OUT / f"{card['id']}.png"
            raw_path.write_bytes(raw)
            size = crop_and_finalize(raw_path, final_path)
            return {
                "word": card["word"],
                "path": str(final_path),
                "size": size,
                "bytes": final_path.stat().st_size,
                "usage": d.get("usage"),
            }
        except Exception as exc:
            last = f"{type(exc).__name__}: {exc}"
            if attempt < 3:
                time.sleep(2 ** attempt)
    raise RuntimeError(f"{card['word']} failed: {last}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", help="逗号分隔的单词或 id，只跑这些")
    ap.add_argument("--force", action="store_true", help="已存在也重跑")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--limit", type=int, help="最多跑前 N 张")
    ap.add_argument("--dry-run", action="store_true", help="只打印 prompt，不调 API")
    args = ap.parse_args()

    cards = load_cards()
    for c in cards:
        validate(c)

    if args.only:
        wanted = {s.strip().lower() for s in args.only.split(",") if s.strip()}
        cards = [c for c in cards if c["word"].lower() in wanted or c["id"].lower() in wanted]
        if not cards:
            raise SystemExit("--only 没有匹配到卡片")

    OUT.mkdir(parents=True, exist_ok=True)
    if args.dry_run:
        for c in cards:
            print("=" * 20, c["word"])
            print(build_prompt(c))
        return

    assert REF.exists(), f"missing style ref: {REF}"
    ref_data_url = "data:image/png;base64," + base64.b64encode(REF.read_bytes()).decode("ascii")

    todo = []
    for c in cards:
        final_path = OUT / f"{c['id']}.png"
        if final_path.exists() and not args.force:
            print("skip", c["word"], final_path.name)
            continue
        todo.append(c)
    if args.limit:
        todo = todo[: args.limit]

    if not todo:
        print("没有需要生成的卡片")
        return

    print(f"A 路线 | style ref: {REF.name} | 待生成 {len(todo)} 张 | workers={args.workers}")
    results = []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(generate, c, ref_data_url): c for c in todo}
        for fut in as_completed(futures):
            c = futures[fut]
            try:
                res = fut.result()
                results.append(res)
                print("OK", res["word"], res["size"], res["bytes"], res["usage"])
            except Exception as exc:
                print("FAIL", c["word"], exc)

    print("\n=== 结果 ===")
    for r in sorted(results, key=lambda x: x["word"]):
        print(r["word"], r["path"], r["size"], r["bytes"])
    if len(results) != len(todo):
        raise SystemExit(1)


if __name__ == "__main__":
    main()
