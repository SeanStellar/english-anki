"""Import the v7.1 workbook and attach existing memory card assets."""

import csv
import filecmp
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(ROOT / "shengtu" / ".xlsx_deps"))
from openpyxl import load_workbook

DATA = ROOT / "renderer" / "data"
IMAGES = ROOT / "renderer" / "assets" / "memory-scenes"
# Retain the existing ID for saved deck selections and study sessions.
DECK_ID = "kaoyan-2752"


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def spelling(text):
    return " ".join(text.split())


def senses(meaning):
    return [part.strip() for part in re.split(r"[，、,；;。\n]+", meaning) if part.strip()]


def dictionary_fields(path, spellings):
    result = {}
    with path.open(encoding="utf-8-sig", newline="") as file:
        for row in csv.DictReader(file):
            word = row["word"]
            if word not in spellings:
                continue
            phonetic = row["phonetic"].strip(" /[]")
            labels = re.findall(
                r"^(n|v|vi|vt|a|adj|ad|adv|prep|pron|conj|aux|int|interj|num|art|det|abbr|pl|suf|pref)\.",
                row["translation"].replace(r"\n", "\n"), flags=re.M,
            )
            canonical = {"a": "adj", "ad": "adv", "int": "interj"}
            pos = " / ".join(dict.fromkeys(canonical.get(label, label) + "." for label in labels))
            result[word] = (f"/{phonetic}/" if phonetic else "", pos)
    return result


def build(workbook_path, source_images, dictionary_path):
    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
    try:
        rows = list(workbook["词频排序表"].iter_rows(min_row=4, values_only=True))
    finally:
        workbook.close()
    if [row[0] for row in rows] != list(range(1, 5531)):
        raise ValueError("v7.1 序号应为 1 至 5530")
    vocabulary = {spelling(row[2]) for row in rows}
    dictionary = dictionary_fields(dictionary_path, vocabulary | {word.lower() for word in vocabulary})

    queue = read_json(ROOT / "shengtu" / "kaoyan_cards_2752.json")["cards"]
    reviewed = read_json(source_images / "manifest.json")["cards"]
    by_serial = {card["serial"]: card for card in queue}
    zsb_words = read_json(DATA / "zhuanshengben-3000.json")
    zsb_by_word = {spelling(card["word"]): card for card in zsb_words}
    zsb_stories = {}
    for file in ("memory-stories.json", "memory-stories-v3-overrides.json"):
        for story in read_json(DATA / file)["cards"]:
            zsb_stories.setdefault(story["id"], {}).update(story)
    replacements = read_json(ROOT / "tools" / "kaoyan_story_corrections.json")
    dictionary_gaps = read_json(ROOT / "tools" / "kaoyan_dictionary_gaps.json")

    words, stories, images_to_copy = [], [], []
    reused = 0
    for serial, frequency, raw_word, meaning, alt in rows:
        word = spelling(raw_word)
        existing = by_serial.get(serial)
        base = zsb_by_word.get(word, {})
        target_senses = senses(meaning or "")
        base_senses = senses(base.get("meaning", ""))
        base_matches = bool(base_senses and set(base_senses).issubset(target_senses))
        ipa, pos = dictionary.get(word, dictionary.get(word.lower(), ("", "")))
        if base_matches:
            ipa = base.get("phonetic") or ipa
            pos = base.get("pos") or pos
        if word in dictionary_gaps:
            ipa, pos = dictionary_gaps[word]
        if word in replacements:
            ipa = replacements[word].get("phonetic", ipa)
            pos = replacements[word].get("pos", pos)
        card_id = existing["id"] if existing else f"kyv7-{serial:04d}"
        words.append({
            "id": card_id, "number": serial, "sourceNumber": serial,
            "word": word, "meaning": meaning or "", "frequency": frequency,
            "alt": alt or "", "phonetic": ipa, "pos": pos,
            "tier": 0, "tierName": "考研词汇", "deckId": DECK_ID,
        })

        if word in replacements:
            correction = replacements[word]
            story = dict(correction["story"])
            if story["targetSense"] not in target_senses:
                raise ValueError(f"修订义项不在原表中：{word}")
            image_name = correction.get("imageFile", "")
            if image_name and not (IMAGES / image_name).is_file():
                raise ValueError(f"找不到修订插画：{image_name}")
        elif existing:
            review = reviewed.get(card_id, {})
            image_name = f"{card_id}.webp"
            image = source_images / image_name
            if (spelling(existing["word"]).casefold() != word.casefold()
                    or existing["sentenceStatus"] != "approved" or existing["imageQCStatus"] != "pass"
                    or review.get("sentenceStatus") != "approved" or review.get("imageQCStatus") != "pass"
                    or review.get("imageFile") != image_name or not image.is_file()):
                raise ValueError(f"考研卡片与源表或审核清单不匹配：{card_id}")
            scene = dict(existing.get("scene", {}))
            scene["props"] = [
                [label, "◆", x, 52] for label, x in zip(scene.get("props", []), (24, 50, 76))
            ]
            story = {
                "anchor": existing["anchor"], "anchorMeaning": existing["anchorMeaning"],
                "sentence": existing["sentence"], "storyKey": f"kaoyan-{card_id}",
                "scene": scene, "review": {"reason": existing["relation"]},
            }
            images_to_copy.append((image, IMAGES / image_name))
        else:
            base_id = base.get("id")
            story = zsb_stories.get(base_id, {})
            image_name = f"{base_id}.webp"
            story_senses = senses(story.get("targetSense", "")) or base_senses
            if not (story_senses and set(story_senses).issubset(target_senses)
                    and story.get("anchor") and story.get("sentence") and (IMAGES / image_name).is_file()):
                continue
            story = {**story, "targetSense": "、".join(story_senses)}
            reused += 1

        stories.append({
            **story, "id": card_id, "word": word,
            **({"illustration": {"file": f"./assets/memory-scenes/{image_name}"}} if image_name else {"textOnly": True}),
        })

    if len(images_to_copy) != len(queue) or len({word["id"] for word in words + zsb_words}) != len(words) + len(zsb_words):
        raise ValueError("存在未关联的考研卡片或重复 ID")
    for source, target in images_to_copy:
        if not target.is_file() or not filecmp.cmp(source, target, shallow=False):
            shutil.copyfile(source, target)
    write_json(DATA / "kaoyan-v7.1.json", words)
    write_json(DATA / "memory-stories-kaoyan.json", {"schemaVersion": 1, "deckId": DECK_ID, "cards": stories})
    print(json.dumps({"words": len(words), "kaoyan_art": len(images_to_copy),
                      "reused_art": reused, "corrections": len(replacements),
                      "without_art": len(words) - sum("illustration" in story for story in stories),
                      "missing_ipa": sum(not word["phonetic"] for word in words),
                      "missing_pos": sum(not word["pos"] for word in words)}))


if __name__ == "__main__":
    build(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
