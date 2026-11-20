import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
TASK = ROOT / "outputs" / "01a19f5d-8041-7603-bac3-19c294926277"
sys.path.insert(0, str(ROOT / "shengtu" / ".xlsx_deps"))
import openpyxl

BOOK = TASK / "考研词汇补集（剔除专升本3000）.xlsx"
SEEDS = [
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch01.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch02.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch03.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch04.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch05.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch06.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch07.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch08.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch09.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch10.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch11.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch12.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch13.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch14.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch15.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch16.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch17.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch18.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch19.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch20a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch20b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch20c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch20d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch20e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch21a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch21b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch21c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch21d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch21e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch22a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch22b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch22c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch22d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch22e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch23a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch23b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch23c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch23d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch23e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch24a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch24b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch24c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch24d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch24e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch25a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch25b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch25c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch25d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch25e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch26a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch26b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch26c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch26d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch26e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch27a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch27b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch27c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch27d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch27e.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch28a.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch28b.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch28c.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch28d.json",
    ROOT / "shengtu" / "kaoyan_sentence_seed_batch28e.json",
]
OUT = ROOT / "shengtu" / "kaoyan_cards_2752.json"

sheet = openpyxl.load_workbook(BOOK, read_only=True, data_only=True).active
cards = []
for row in sheet.iter_rows(min_row=4, values_only=True):
    if len(row) < 4 or not row[2]:
        continue
    cards.append({
        "id": f"kyc-{len(cards) + 1:04d}",
        "serial": row[0],
        "frequency": row[1],
        "word": str(row[2]).strip(),
        "targetSense": str(row[3]).replace("\n", "；").strip(),
        "alt": str(row[4]).strip() if len(row) > 4 and row[4] else "",
    })

old_by_id = {}
if OUT.exists():
    try:
        old_by_id = {card["id"]: card for card in json.loads(OUT.read_text(encoding="utf-8"))["cards"]}
    except (KeyError, ValueError, json.JSONDecodeError):
        old_by_id = {}
seed = []
for seed_path in SEEDS:
    if seed_path.exists():
        seed.extend(json.loads(seed_path.read_text(encoding="utf-8-sig")))
seed_by_word = {card["word"].casefold(): card for card in seed}
assert len(cards) == 2752, f"Expected 2752 source words, got {len(cards)}"
assert len({card["word"].casefold() for card in cards}) == 2752, "Duplicate source words"
assert len(seed_by_word) == len(seed), "Duplicate seed words"
assert len(seed) <= len(cards), "More seed cards than source words"

for card in cards:
    reviewed = seed_by_word.get(card["word"].casefold())
    if reviewed:
        prior = old_by_id.get(card["id"], {})
        card.update(reviewed)
        card.update(
            sentenceStatus="approved",
            imageStatus=prior.get("imageStatus", "pending"),
            imageQCStatus=prior.get("imageQCStatus", "pending"),
        )
        for key in ("imageFile", "imageError", "imageReview"):
            if key in prior:
                card[key] = prior[key]
        sentence = card["sentence"].casefold()
        target = re.search(r"(?<![a-z])" + re.escape(card["word"].casefold()) + r"(?![a-z])", sentence)
        assert target, f"Target missing from sentence: {card['word']}"
        assert card["anchor"].casefold() in sentence, f"Anchor missing from sentence: {card['word']}"
        assert len(card["scene"]["props"]) == 3, f"Expected 3 props: {card['word']}"
        assert len(card["scene"]["beats"]) == 3, f"Expected 3 beats: {card['word']}"
    else:
        card.update(
            anchor=None,
            anchorMeaning=None,
            relation=None,
            sentence=None,
            mode=None,
            scene=None,
            review=None,
            sentenceStatus="pending",
            imageStatus="pending",
            imageQCStatus="pending",
        )

OUT.write_text(
    json.dumps({"source": str(BOOK), "total": len(cards), "cards": cards}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print("queue updated:", len(cards), "words;", len(seed), "sentence-reviewed; remaining", len(cards) - len(seed))
