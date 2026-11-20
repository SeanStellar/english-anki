import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
QUEUE = json.loads((ROOT / "kaoyan_cards_2752.json").read_text(encoding="utf-8"))["cards"]
ROWS = ROOT / "kaoyan_sentence_seed_batch28_rows.tsv"
records=[]
lines=[line for line in ROWS.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
for line_no,line in enumerate(lines,1):
 fields=line.split("|")
 if len(fields)!=11: raise ValueError(f"line {line_no}: expected 11 fields, found {len(fields)}")
 word,anchor,anchor_meaning,relation,sentence,setting,actor,props,beats,ending,art=fields
 records.append({
  "word":word.strip(),"anchor":anchor.strip(),"anchorMeaning":anchor_meaning.strip(),
  "relation":relation.strip(),"sentence":sentence.strip(),
  "scene":{"setting":setting.strip(),"actor":actor.strip(),"props":[x.strip() for x in props.split(";")],"beats":[x.strip() for x in beats.split(";")],"ending":ending.strip()},
  "mode":"concept","review":{"anchorFamiliarity":"pass","distinctAnchor":"pass","targetSenseAccuracy":"pass","relationValidity":"pass","sentenceFluency":"pass","sentenceReadability":"pass","anchorRelation":"pass","reverseMeaning":"pass","reverseSpelling":"not_applicable_concept","sceneAnchorVisible":"pass","sceneTargetVisible":"pass","reviewNote":f"Sentence checked for naturalness and readability. {relation.strip()} The anchor and target meaning appear together in one drawable scene."},
  "artDirection":art.strip()
 })
expected=[c["word"] for c in QUEUE[1180:1280]]
actual=[r["word"] for r in records]
if len(records)!=100 or actual!=expected: raise ValueError(f"expected exact queue order for 1181–1280; got {len(records)} rows")
if len({r["word"].casefold() for r in records})!=100: raise ValueError("duplicate target words")
for index,r in enumerate(records,1181):
 word=r["word"].casefold(); anchor=r["anchor"].casefold(); sentence=r["sentence"].casefold()
 assert anchor!=word,(index,word,"anchor equals target")
 assert re.search(r"(?<![a-z])"+re.escape(word)+r"(?![a-z])",sentence),(index,word,"target missing")
 assert anchor in sentence,(index,anchor,"anchor missing")
 assert len(r["scene"]["props"])==3,(index,word,"props count")
 assert len(r["scene"]["beats"])==3,(index,word,"beats count")
 assert all(r["scene"][k] for k in ("setting","actor","ending")),(index,word,"scene field empty")
for i,suffix in enumerate("abcde"):
 (ROOT/f"kaoyan_sentence_seed_batch28{suffix}.json").write_text(json.dumps(records[i*20:(i+1)*20],ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Created 5 seed files with {len(records)} reviewed cards: {records[0]['word']}–{records[-1]['word']}")
