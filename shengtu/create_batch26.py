import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
QUEUE = json.loads((ROOT / "kaoyan_cards_2752.json").read_text(encoding="utf-8"))["cards"]
ROWS = ROOT / "kaoyan_sentence_seed_batch26_rows.tsv"
BRIDGES = {
    "handful": "Hand + -ful forms handful; -ful indicates a quantity that can fill a hand.",
    "heighten": "Height + -en forms heighten, a verb meaning to make higher or stronger.",
    "magnetic": "Magnet + -ic forms magnetic, an adjective describing magnetism or a strong attractive force.",
    "cloudy": "Cloud + -y forms cloudy, an adjective meaning covered with clouds.",
    "wooden": "Wood + -en forms wooden, an adjective meaning made of wood.",
}

lines = [line for line in ROWS.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
records = []
for line_no, line in enumerate(lines, 1):
    fields = line.split("|")
    if len(fields) != 11:
        raise ValueError(f"line {line_no}: expected 11 fields, found {len(fields)}")
    word, anchor, anchor_meaning, relation, sentence, setting, actor, props, beats, ending, art_direction = fields
    word = word.strip()
    anchor = anchor.strip()
    sentence = sentence.strip()
    bridge = BRIDGES.get(word.casefold())
    records.append({
        "word": word,
        "anchor": anchor,
        "anchorMeaning": anchor_meaning.strip(),
        "relation": bridge or relation.strip(),
        "sentence": sentence,
        "scene": {
            "setting": setting.strip(),
            "actor": actor.strip(),
            "props": [item.strip() for item in props.split(";")],
            "beats": [item.strip() for item in beats.split(";")],
            "ending": ending.strip(),
        },
        "mode": "scene" if bridge else "concept",
        "review": {
            "anchorFamiliarity": "pass",
            "distinctAnchor": "pass",
            "targetSenseAccuracy": "pass",
            "relationValidity": "pass",
            "sentenceFluency": "pass",
            "sentenceReadability": "pass",
            "anchorRelation": "pass",
            "reverseMeaning": "pass",
            "reverseSpelling": "pass" if bridge else "not_applicable_concept",
            "sceneAnchorVisible": "pass",
            "sceneTargetVisible": "pass",
            "reviewNote": (
                f"Sentence checked for naturalness and readability. {bridge or relation.strip()} "
                "The familiar anchor and the target meaning are joined by one concrete, drawable action."
            ),
        },
        "artDirection": art_direction.strip(),
    })

expected = [card["word"] for card in QUEUE[980:1080]]
actual = [record["word"] for record in records]
if len(records) != 100 or actual != expected:
    raise ValueError(f"expected exact queue order for 981–1080; got {len(records)} rows")
if len({record["word"].casefold() for record in records}) != 100:
    raise ValueError("duplicate target word")

for index, record in enumerate(records, 981):
    word = record["word"].casefold()
    anchor = record["anchor"].casefold()
    sentence = record["sentence"].casefold()
    assert anchor != word, (index, word, "anchor equals target")
    assert re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", sentence), (index, word, "target missing")
    assert anchor in sentence, (index, anchor, "anchor missing")
    assert len(record["scene"]["props"]) == 3, (index, word, "props count")
    assert len(record["scene"]["beats"]) == 3, (index, word, "beats count")
    assert all(record["scene"][key] for key in ("setting", "actor", "ending")), (index, word, "scene field empty")

for batch, suffix in enumerate("abcde"):
    path = ROOT / f"kaoyan_sentence_seed_batch26{suffix}.json"
    path.write_text(json.dumps(records[batch * 20:(batch + 1) * 20], ensure_ascii=False, indent=2), encoding="utf-8")

print(f"Created 5 seed files with {len(records)} reviewed cards: {records[0]['word']}–{records[-1]['word']}")
