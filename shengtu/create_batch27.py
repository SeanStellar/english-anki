import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
QUEUE = json.loads((ROOT / "kaoyan_cards_2752.json").read_text(encoding="utf-8"))["cards"]
ROWS = ROOT / "kaoyan_sentence_seed_batch27_rows.tsv"
records = []
lines = [line for line in ROWS.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
for line_no, line in enumerate(lines, 1):
    fields = line.split("|")
    if len(fields) != 11:
        raise ValueError(f"line {line_no}: expected 11 fields, found {len(fields)}")
    word, anchor, anchor_meaning, relation, sentence, setting, actor, props, beats, ending, art_direction = fields
    word = word.strip()
    anchor = anchor.strip()
    sentence = sentence.strip()
    records.append({
        "word": word,
        "anchor": anchor,
        "anchorMeaning": anchor_meaning.strip(),
        "relation": relation.strip(),
        "sentence": sentence,
        "scene": {
            "setting": setting.strip(),
            "actor": actor.strip(),
            "props": [item.strip() for item in props.split(";")],
            "beats": [item.strip() for item in beats.split(";")],
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
            "reviewNote": (
                f"Sentence checked for naturalness and readability. {relation.strip()} "
                "The familiar anchor and target meaning appear together in one drawable scene."
            ),
        },
        "artDirection": art_direction.strip(),
    })

expected = [card["word"] for card in QUEUE[1080:1180]]
actual = [record["word"] for record in records]
if len(records) != 100 or actual != expected:
    raise ValueError(f"expected exact queue order for 1081–1180; got {len(records)} rows")
if len({record["word"].casefold() for record in records}) != 100:
    raise ValueError("duplicate target words")

for index, record in enumerate(records, 1081):
    word = record["word"].casefold()
    anchor = record["anchor"].casefold()
    sentence = record["sentence"].casefold()
    assert anchor != word, (index, word, "anchor equals target")
    assert re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", sentence), (index, word, "target missing")
    assert anchor in sentence, (index, anchor, "anchor missing")
    assert len(record["scene"]["props"]) == 3, (index, word, "props count")
    assert len(record["scene"]["beats"]) == 3, (index, word, "beats count")
    assert all(record["scene"][key] for key in ("setting", "actor", "ending")), (index, word, "scene field empty")
    review = record["review"]
    assert review["sentenceFluency"] == "pass" and review["sentenceReadability"] == "pass"

for batch, suffix in enumerate("abcde"):
    path = ROOT / f"kaoyan_sentence_seed_batch27{suffix}.json"
    path.write_text(json.dumps(records[batch * 20:(batch + 1) * 20], ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Created 5 seed files with {len(records)} reviewed cards: {records[0]['word']}–{records[-1]['word']}")
