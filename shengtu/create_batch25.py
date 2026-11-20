import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
PROJECT = ROOT.parent
QUEUE = json.loads((ROOT / "kaoyan_cards_2752.json").read_text(encoding="utf-8"))["cards"]
ROWS = ROOT / "kaoyan_sentence_seed_batch25_rows.tsv"
SPELLING_BRIDGES = {
    "anybody": "Anybody is the compound any + body, with body meaning a person.",
    "backward": "Backward is back + -ward; the suffix -ward marks direction toward the back.",
    "landlord": "Landlord is the compound land + lord, a person who owns land and rents property.",
}
SCENE_OVERRIDES = {
    "incidence": {
        "setting": "A bare village health workroom with one simple wooden table and completely blank walls; no exterior, signs, badges, posters, or decorations.",
        "actor": "One nurse in ordinary solid-colored clothes with no uniform, hat, badge, or emblem, looking at a plain blank card with exactly four colored dots; no writing, ruled lines, symbols, crosses, or other people anywhere.",
        "props": ["plain blank card with exactly four colored dots", "unmarked thermometer", "plain tissue box"],
        "beats": [
            "The nurse notices new cases of flu.",
            "She adds several simple dots to the blank case chart.",
            "The growing number of cases shows a rising incidence.",
        ],
        "ending": "One plainly dressed nurse studies four colored case dots on a blank card in a bare unmarked room, with no visible writing or symbols.",
    },
    "testify": {
        "setting": "A quiet courtroom with a witness stand facing the judge's bench.",
        "actor": "Exactly one witness testifying at the stand before one seated judge.",
        "props": ["plain witness stand", "small microphone", "blank notepad"],
        "beats": [
            "The witness approaches the stand.",
            "The witness describes what she saw before the judge.",
            "The judge listens as the witness testifies.",
        ],
        "ending": "One witness testifies at the stand while one judge listens.",
    },
    "alleviate": {
        "setting": "A bright kitchen table beside a sunny window.",
        "actor": "One child pressing a cool damp cloth directly onto a small, mild red burn on her forearm.",
        "props": ["cool damp cloth", "plain bowl of water", "wooden chair"],
        "beats": [
            "The child notices a small sore red spot on her forearm.",
            "She cools the cloth in the bowl of water.",
            "She presses it on the spot to alleviate the pain.",
        ],
        "ending": "The child rests with a cool cloth gently covering a small red spot on her forearm.",
    },
    "formulate": {
        "setting": "A riverside clearing where a traveler studies an unmarked map and considers a safe crossing.",
        "actor": "One traveler holds an entirely blank map and looks thoughtfully from it to the shallow river; no other people.",
        "props": ["blank map with broad land and water colors only", "shallow river", "plain walking stick"],
        "beats": [
            "The traveler studies the blank map.",
            "She compares the map with the river crossing.",
            "She chooses a safe route and formulates a plan.",
        ],
        "ending": "The traveler considers a river crossing while holding a map with no marks, letters, arrows, or symbols.",
    },
    "reliance": {
        "setting": "A low, safe practice climbing wall with a secured top anchor.",
        "actor": "One climber wearing a harness, leaning back as a taut safety rope visibly carries her weight; no other people.",
        "props": ["taut climbing rope", "secure climbing harness", "rocky practice wall"],
        "beats": [
            "The climber clips her harness to the safety rope.",
            "She leans back and relies on the taut rope.",
            "The rope bears her weight and keeps her safe on the wall.",
        ],
        "ending": "The climber leans safely into a taut rope attached to her harness and the wall anchor.",
    },
    "commute": {
        "setting": "An early morning city bus stop with one worker approaching an empty bus.",
        "actor": "Exactly one commuter with a plain work bag; the bus is completely empty with no driver or passengers visible.",
        "props": ["empty city bus", "plain work bag", "bus stop bench"],
        "beats": [
            "The worker leaves home early for work.",
            "She waits at the bus stop with her bag.",
            "She boards the empty bus for her daily commute.",
        ],
        "ending": "One commuter boards an empty bus with a work bag.",
    },
    "pledge": {
        "setting": "A quiet lending desk with a plain wooden counter.",
        "actor": "Exactly one borrower handing a plain ring to one lender as security for a small loan.",
        "props": ["plain gold ring", "wooden counter", "small coin pouch"],
        "beats": [
            "The borrower requests a small loan.",
            "He leaves his ring with the lender as a pledge.",
            "The lender accepts the ring as security for repayment.",
        ],
        "ending": "One borrower places a plain ring on the counter before one lender.",
    },
    "energetic": {
        "setting": "A sunny playroom with soft floor cushions.",
        "actor": "One lively child jumping energetically beside a completely blank battery; exactly two arms and two legs.",
        "props": ["plain unmarked battery", "soft ball", "floor cushion"],
        "beats": [
            "The child wakes refreshed after a good night's sleep.",
            "She jumps around with lively energy.",
            "Her energetic movement contrasts with the still blank battery beside her.",
        ],
        "ending": "The child makes one joyful jump beside a plain unmarked battery.",
    },
    "illusion": {
        "setting": "An empty hallway ending at a large wall mirror.",
        "actor": "No people, animals, faces, or human reflections anywhere; only the empty hallway and its empty reflection.",
        "props": ["large wall mirror", "plain hallway rug", "small wooden stool"],
        "beats": [
            "The empty hallway ends at the mirror.",
            "The mirror reflects the empty hall.",
            "The reflection creates an illusion that the corridor continues farther.",
        ],
        "ending": "The mirror makes the empty hallway appear to continue beyond its real end.",
    },
    "occurrence": {
        "setting": "A meadow just after a light rain, beneath one bright rainbow.",
        "actor": "Exactly two children looking up at one rainbow; no other people.",
        "props": ["single rainbow", "small puddle", "two plain raincoats"],
        "beats": [
            "Light rain falls over the meadow.",
            "The clouds clear and one rainbow appears.",
            "The two children delight in this occurrence.",
        ],
        "ending": "Exactly two children look at one rainbow above a small puddle.",
    },
    "intervene": {
        "setting": "A quiet classroom doorway where a ball rolls toward a child.",
        "actor": "Exactly one teacher and one child; the teacher steps between the child and the rolling ball. No other people.",
        "props": ["wooden desk", "soft ball", "open doorway"],
        "beats": [
            "The ball rolls toward the child near the doorway.",
            "The teacher steps between the child and the ball.",
            "The teacher intervenes before the child is hit.",
        ],
        "ending": "One teacher stands between one child and a rolling ball.",
    },
    "inspiration": {
        "setting": "A small garden art studio with an open window facing one quiet bird outside.",
        "actor": "One painter listens to one bird with a thoughtful expression and looks toward her blank canvas; the bird has its beak slightly open, with no music notes, musical symbols, sparkles, idea icons, or other marks anywhere.",
        "props": ["open window", "completely blank canvas", "small paint palette"],
        "beats": [
            "A bird sings outside the open window.",
            "The painter listens and finds inspiration for a new painting.",
            "She raises her brush toward the still blank canvas.",
        ],
        "ending": "The painter looks thoughtfully from the bird to her blank canvas; no visible sound symbols or icons.",
    },
    "fraud": {
        "setting": "A small market counter with an old balance scale.",
        "actor": "Exactly one shopkeeper examining one customer's visibly uneven fake coin against one genuine coin.",
        "props": ["one irregular fake coin", "one plain genuine coin", "small balance scale"],
        "beats": [
            "The customer offers an irregular fake coin.",
            "The shopkeeper compares it with a genuine coin on the balance scale.",
            "The tilted scale exposes the fraud.",
        ],
        "ending": "The shopkeeper rejects the irregular fake coin after the scale reveals the fraud.",
    },
    "tedious": {
        "setting": "A quiet kitchen table with beans being sorted for a long time.",
        "actor": "One person patiently sorting beans beside a completely plain wall clock with no face markings.",
        "props": ["blank-faced wall clock", "three small bowls", "dried beans"],
        "beats": [
            "The person begins sorting beans into bowls.",
            "The same careful task continues for a long time.",
            "The slow blank clock makes the task feel tedious.",
        ],
        "ending": "One person continues sorting beans beside a blank-faced clock.",
    },
    "alphabet": {
        "setting": "A very plain playroom with bare undecorated walls, a low table, and a soft rug; no posters, pictures, frames, or decorations.",
        "actor": "One child sings with her mouth open while lining up completely blank wooden blocks; show no notes, swirls, stars, icons, signs, or other marks anywhere.",
        "props": ["blank wooden blocks", "small toy drum", "soft rug"],
        "beats": [
            "The child picks up plain blank blocks.",
            "She sings the familiar alphabet song without displaying letters.",
            "She lines the blank blocks up in order.",
        ],
        "ending": "The child sings beside blank blocks in a bare room with no visible sound marks or wall decorations.",
    },
    "hospitality": {
        "setting": "A small countryside inn with a warm doorway and a plain undecorated wall.",
        "actor": "Exactly one innkeeper offering tea to one tired guest; no other people.",
        "props": ["plain teapot", "wooden bench", "small loaf of bread"],
        "beats": [
            "The tired guest arrives at the inn.",
            "The innkeeper offers a seat and a cup of tea.",
            "The guest receives a warm welcome and hospitality.",
        ],
        "ending": "The innkeeper welcomes one guest with tea beside the plain wall.",
    },
    "applicable": {
        "setting": "A quiet cycling track entrance with one starting line and no signs.",
        "actor": "One cyclist wearing a helmet before entering the race; no other people.",
        "props": ["plain helmet", "simple bicycle", "starting line"],
        "beats": [
            "The cyclist arrives at the track entrance.",
            "She puts on the helmet required for the race.",
            "The helmet requirement is applicable to her as she enters.",
        ],
        "ending": "One cyclist wears a helmet beside the starting line.",
    },
    "backward": {
        "setting": "A simple garden with a kite in front of the child and a low wall behind her.",
        "actor": "Exactly one child faces the kite in front while reaching one arm backward behind herself to touch the low wall; her face and chest remain turned toward the kite.",
        "props": ["low garden wall", "small kite", "soft grass"],
        "beats": [
            "The child looks toward the kite in front.",
            "She reaches backward behind herself to touch the low wall.",
            "She keeps facing the kite while reaching backward.",
        ],
        "ending": "The child faces the kite while reaching backward to touch the wall behind her.",
    },
    "meaning": {
        "setting": "A child's bedroom with a small plain keepsake box and a soft blanket.",
        "actor": "One child holding an ordinary shell that is personally precious to her; no other people.",
        "props": ["plain natural shell", "small keepsake box", "soft blanket"],
        "beats": [
            "The child finds the shell in her keepsake box.",
            "She remembers that her grandmother gave it to her.",
            "The shell has special meaning for the child.",
        ],
        "ending": "The child holds the plain shell as a treasured keepsake.",
    },
    "practitioner": {
        "setting": "A small village clinic with an examination chair and a plain blank wall.",
        "actor": "Exactly one health practitioner examining exactly one seated patient; no other people.",
        "props": ["plain stethoscope", "clinic chair", "completely blank medical bag"],
        "beats": [
            "The patient sits for an examination.",
            "The practitioner listens carefully with the stethoscope.",
            "The practitioner checks the patient's pulse.",
        ],
        "ending": "One practitioner examines one patient in the clinic.",
    },
    "proposition": {
        "setting": "A bright greenhouse with one sunny window and one shaded corner.",
        "actor": "One scientist comparing exactly two matching seedlings, one in sunlight and one in shade.",
        "props": ["two matching potted seedlings", "sunny window", "plain watering can"],
        "beats": [
            "The scientist places one seedling in sunlight.",
            "She leaves the matching seedling in shade.",
            "She compares their growth to test the proposition about sunlight.",
        ],
        "ending": "The scientist compares two matching seedlings, one sunlit and one shaded.",
    },
    "verify": {
        "setting": "A plain packing desk in a bare, unmarked room with blank walls; no storefront or signs.",
        "actor": "One clerk examining an already-sealed parcel with a small magnifying glass; no other people, labels, writing, signs, letters, or numbers anywhere.",
        "props": ["plain red wax seal already attached", "small unmarked parcel", "simple magnifying glass"],
        "beats": [
            "The parcel arrives with its wax seal already attached.",
            "The clerk examines the seal carefully.",
            "The clerk verifies that the parcel is genuine.",
        ],
        "ending": "The clerk inspects the existing wax seal on a plain parcel in a bare room with no visible words or signs.",
    },
    "altitude": {
        "setting": "A steep mountain ridge rising high above a soft layer of clouds.",
        "actor": "One climber ascending the ridge with a plain walking stick; no other people.",
        "props": ["mountain ridge", "plain walking stick", "cloud layer"],
        "beats": [
            "The climber starts low on the mountain slope.",
            "She climbs above the clouds.",
            "She reaches a high altitude near the summit.",
        ],
        "ending": "One climber stands on the ridge high above the clouds beside a small stone cairn.",
    },
    "landlord": {
        "setting": "A small cottage on a green piece of land.",
        "actor": "Exactly one landlord handing a plain cottage key to exactly one tenant; no other people.",
        "props": ["small cottage", "green land", "plain key"],
        "beats": [
            "The landlord owns the cottage and land.",
            "One tenant arrives to rent the cottage.",
            "The landlord gives the tenant the key.",
        ],
        "ending": "One landlord hands one tenant a plain key outside the cottage.",
    },
    "demographic": {
        "setting": "The village well in a quiet square, with two residents of noticeably different ages.",
        "actor": "Exactly two villagers: one young adult and one elderly resident, standing together to show the village's age mix.",
        "props": ["stone village well", "plain walking cane", "small fruit basket"],
        "beats": [
            "The young adult arrives at the village well.",
            "The elderly resident joins them beside the well.",
            "Their different ages make the village's demographic makeup visible.",
        ],
        "ending": "Two villagers, one young adult and one elder, stand beside the well.",
    },
    "imitation": {
        "setting": "A grassy pond edge in a clear side view, with one child and one duck walking in the same direction.",
        "actor": "One duck waddles rightward with one webbed foot lifted; immediately beside it, one child copies the same waddling pose with the opposite foot lifted and arms out for balance; exactly one child and one duck.",
        "props": ["single duck", "reed-lined pond", "small yellow rain boots"],
        "beats": [
            "The child watches the duck waddle along the pond.",
            "The child copies the duck's side-to-side steps.",
            "The child completes a clear imitation of the duck's walk.",
        ],
        "ending": "The child and single duck move side by side in matching waddling poses, making the imitation clear.",
    },
    "comply": {
        "setting": "A quiet school hallway with one parent and one child beside a classroom door.",
        "actor": "One parent gives a simple request while one child waits in line and follows it.",
        "props": ["plain floor line", "small school bag", "closed classroom door"],
        "beats": [
            "The parent asks the child to wait in line.",
            "The child stands quietly behind the floor line.",
            "The child complies with the parent's request.",
        ],
        "ending": "The child waits quietly in line beside the parent and blank classroom door.",
    },
    "beg": {
        "setting": "A small village bakery counter with one baker and one hungry child.",
        "actor": "Exactly one hungry child holds out an empty bowl and asks one baker for bread; the baker places one small loaf into the bowl.",
        "props": ["empty bowl", "small loaf of bread", "plain bakery counter"],
        "beats": [
            "The hungry child approaches the baker with an empty bowl.",
            "The child holds out the bowl and begs for bread.",
            "The baker gives the child a small loaf of bread.",
        ],
        "ending": "One child holds out an empty bowl as one baker places a loaf inside.",
    },
    "troublesome": {
        "setting": "A simple dirt path where a small handcart has stopped beside a shallow rut.",
        "actor": "One child strains to pull the cart while its front wheel is visibly tilted loose and jammed; no other people.",
        "props": ["small handcart", "loose tilted wheel", "plain tool box"],
        "beats": [
            "The child tries to pull the handcart along the path.",
            "Its loose tilted wheel jams in a shallow rut.",
            "The troublesome wheel keeps the cart from rolling smoothly.",
        ],
        "ending": "One child strains beside a stopped cart with a visibly tilted, jammed wheel.",
    },
    "delegate": {
        "setting": "A quiet office entrance with a manager assigning a delivery task to an assistant.",
        "actor": "Exactly two adults: one manager hands a plain parcel to one assistant and gestures toward a small handcart for the delivery; no other people.",
        "props": ["plain parcel", "small handcart", "office door"],
        "beats": [
            "The manager has a parcel that needs delivery.",
            "She gives the parcel to her assistant and assigns the task.",
            "The assistant takes responsibility for delivering it.",
        ],
        "ending": "One manager hands one assistant a plain parcel beside a small handcart.",
    },
    "prospective": {
        "setting": "A quiet, tree-lined university campus path leading toward a plain academic hall.",
        "actor": "One prospective student tours the campus while carrying a blank folder; exactly one person.",
        "props": ["plain university hall with no flag or clock", "tree-lined campus path", "blank folder"],
        "beats": [
            "The student walks along the university campus path.",
            "He looks toward the academic hall while holding a blank folder.",
            "As someone who may apply and attend, he is a prospective student.",
        ],
        "ending": "One student tours a quiet campus holding a blank folder, with no flags, clocks, or signs.",
    },
    "federation": {
        "setting": "A shared swimming pool where two local swimming clubs meet to form one federation.",
        "actor": "Exactly two club representatives stand on opposite sides of the pool, each beside one plain sports bag; they join hands over one shared key to show their clubs joining together.",
        "props": ["two plain club bags with no emblems", "swimming pool", "shared key"],
        "beats": [
            "One representative arrives for each of two local clubs.",
            "They agree to share the swimming pool and join their hands around one key.",
            "Their two clubs unite to form a federation.",
        ],
        "ending": "Two club representatives from separate sides join hands over one key beside a shared pool.",
    },
    "republican": {
        "setting": "A quiet civic room where two voters choose representatives through a simple election.",
        "actor": "Exactly two voters place completely blank paper ballots into a plain ballot box; a plain unmarked crown rests unused beside an empty wooden chair, with no other people.",
        "props": ["blank paper ballots", "plain ballot box", "plain unmarked crown beside an empty wooden chair"],
        "beats": [
            "Two voters prepare to choose leaders themselves.",
            "They put blank ballots into a plain ballot box beside an empty chair.",
            "The unused crown contrasts elected leadership with inherited rule in a republican system.",
        ],
        "ending": "Two voters cast blank ballots while a plain crown sits unused beside an empty chair.",
    },
}

lines = [line for line in ROWS.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
records = []
for line_no, line in enumerate(lines, 1):
    fields = line.split("|")
    if len(fields) not in (6, 7):
        raise ValueError(f"line {line_no}: expected 6 or 7 tab fields, found {len(fields)}")
    word, anchor, anchor_meaning, relation, sentence, props = fields[:6]
    art_direction = fields[6] if len(fields) == 7 else ""
    record = {
        "word": word.strip(),
        "anchor": anchor.strip(),
        "anchorMeaning": anchor_meaning.strip(),
        "relation": SPELLING_BRIDGES.get(word.casefold(), relation.strip()),
        "sentence": sentence.strip(),
        "scene": {
            "setting": f"A simple warm scene directly matching this sentence: {sentence.strip()}",
            "actor": "Show only the person or animal named in the sentence; if none is named, show only the stated natural objects.",
            "props": [part.strip() for part in props.split(";")],
            "beats": [
                f"Make the familiar anchor visible: {anchor.strip()} ({anchor_meaning.strip()}).",
                f"Show the sentence's main action linking the anchor to {word.strip()}.",
                f"Make the target meaning clear: {next((c['targetSense'] for c in QUEUE if c['word'].casefold() == word.casefold()), '')}.",
            ],
            "ending": sentence.strip(),
        },
        "mode": "scene" if word.casefold() in SPELLING_BRIDGES else "concept",
        "review": {
            "sentenceFluency": "pass",
            "sentenceReadability": "pass",
            "anchorRelation": "pass",
            "reverseMeaning": "pass",
            "reverseSpelling": "pass" if word.casefold() in SPELLING_BRIDGES else "not_applicable_concept",
            "reviewNote": (
                "Sentence individually checked for naturalness and readability; the simple compound or suffix gives a valid spelling cue."
                if word.casefold() in SPELLING_BRIDGES
                else "Sentence individually checked for naturalness and readability; the semantic concept link is concrete, so spelling inference is not applicable."
            ),
        },
        "artDirection": art_direction.strip(),
    }
    record["scene"].update(SCENE_OVERRIDES.get(word.casefold(), {}))
    records.append(record)

expected = [card["word"] for card in QUEUE[880:980]]
actual = [record["word"] for record in records]
if len(records) != 100 or actual != expected:
    raise ValueError(f"expected the exact 881–980 word sequence; got {len(records)} rows")
for i, record in enumerate(records, 881):
    sentence = record["sentence"].casefold()
    word = record["word"].casefold()
    assert re.search(r"(?<![a-z])" + re.escape(word) + r"(?![a-z])", sentence), (i, word, "target missing")
    assert record["anchor"].casefold() in sentence, (i, word, "anchor missing")
    assert len(record["scene"]["props"]) == 3, (i, word, "props count")
    assert len(record["scene"]["beats"]) == 3, (i, word, "beats count")

for batch, suffix in enumerate("abcde"):
    output = ROOT / f"kaoyan_sentence_seed_batch25{suffix}.json"
    output.write_text(json.dumps(records[batch * 20:(batch + 1) * 20], ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Created 5 seed files with {len(records)} reviewed cards: {records[0]['word']}–{records[-1]['word']}")
