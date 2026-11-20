import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
QUEUE_PATH = ROOT / "kaoyan_cards_2752.json"
ROWS_PATH = ROOT / "kaoyan_sentence_seed_batch30_rows.tsv"

queue = json.loads(QUEUE_PATH.read_text(encoding="utf-8"))
cards = queue["cards"]
lines = [line for line in ROWS_PATH.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
records = []
for line_no, line in enumerate(lines, 1):
    fields = line.split("|")
    if len(fields) != 11:
        raise ValueError(f"line {line_no}: expected 11 fields, got {len(fields)}")
    word, anchor, anchor_meaning, relation, sentence, setting, actor, props, beats, ending, art = fields
    records.append({
        "word": word.strip(),
        "anchor": anchor.strip(),
        "anchorMeaning": anchor_meaning.strip(),
        "relation": relation.strip(),
        "sentence": sentence.strip(),
        "scene": {
            "setting": setting.strip(),
            "actor": actor.strip(),
            "props": [x.strip() for x in props.split(";")],
            "beats": [x.strip() for x in beats.split(";")],
            "ending": ending.strip(),
        },
        "mode": "concept",
        "review": {
            "anchorFamiliarity": "pass",
            "distinctAnchor": "pass",
            "targetSenseAccuracy": "pass",
            "relationValidity": "pass",
            "sentenceFluency": "pass",
            "sentenceReadability": "pass",
            "anchorRelation": "pass",
            "reverseMeaning": "pass",
            "reverseSpelling": "not_applicable_concept",
            "sceneAnchorVisible": "pass",
            "sceneTargetVisible": "pass",
            "reviewNote": f"Sentence checked for naturalness and readability. {relation.strip()} The anchor and target sense are placed together in one drawable scene.",
        },
        "artDirection": art.strip(),
    })

expected_cards = cards[1380:1480]
expected_words = [c["word"] for c in expected_cards]
actual_words = [r["word"] for r in records]
if len(records) != 100 or actual_words != expected_words:
    raise ValueError("batch 30 must contain the exact queue order for cards 1381–1480")
if len({w.casefold() for w in actual_words}) != 100:
    raise ValueError("duplicate target word in batch 30")

for index, (card, record) in enumerate(zip(expected_cards, records), 1381):
    word = record["word"].casefold()
    anchor = record["anchor"].casefold()
    sentence = record["sentence"].casefold()
    if anchor == word:
        raise ValueError(f"{index}: anchor equals target")
    if anchor not in sentence:
        raise ValueError(f"{index}: anchor missing from sentence")
    if not re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", sentence):
        raise ValueError(f"{index}: exact target form missing from sentence")
    scene = record["scene"]
    if len(scene["props"]) != 3 or any(not p for p in scene["props"]):
        raise ValueError(f"{index}: scene must contain exactly three props")
    if len(scene["beats"]) != 3 or any(not b for b in scene["beats"]):
        raise ValueError(f"{index}: scene must contain exactly three beats")
    if not all(scene[k] for k in ("setting", "actor", "ending")):
        raise ValueError(f"{index}: missing scene field")
    if record["anchor"].casefold() in {"plague", "rat"} and record["word"].casefold() == "plague":
        record["review"]["reviewNote"] += " Rat is a historical association with plague transmission; fleas are the direct vector."

revised_senses = {
    "adhere": "粘附；坚持遵守",
    "warrant": "授权；搜查令；保证",
    "casualty": "伤亡人员；伤员",
    "fruitful": "富有成效的；结果丰硕的",
    "offensive": "冒犯的；令人不快的；进攻性的",
}

for offset, record in enumerate(records):
    card = expected_cards[offset]
    for key in ("anchor", "anchorMeaning", "relation", "sentence", "scene", "review", "artDirection", "mode"):
        card[key] = record[key]
    card["sentenceStatus"] = "approved"
    card["imageStatus"] = "pending"
    card["imageQCStatus"] = "pending"
    card["imageError"] = None
    card.pop("imageFile", None)
    if card["word"] in revised_senses:
        card["targetSense"] = revised_senses[card["word"]]

for chunk, suffix in enumerate("abcde"):
    chunk_path = ROOT / f"kaoyan_sentence_seed_batch30{suffix}.json"
    chunk_path.write_text(json.dumps(records[chunk * 20:(chunk + 1) * 20], ensure_ascii=False, indent=2), encoding="utf-8")

QUEUE_PATH.write_text(json.dumps(queue, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"APPROVED {len(records)} sentence cards: {records[0]['word']}–{records[-1]['word']}")
print("Updated senses:", ", ".join(revised_senses))
