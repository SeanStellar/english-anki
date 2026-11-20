import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "outputs" / "01a19f5d-8041-7603-bac3-19c294926277"
SEED = ROOT / "shengtu" / "kaoyan_sentence_seed_batch01.json"
QUEUE = ROOT / "shengtu" / "kaoyan_cards_2752.json"
IMAGE_MANIFEST = OUT / "考研锚点卡片_逐张核验" / "manifest.json"

rework = {
    "have": {
        "sentence": "I have half a sandwich left（我还剩半个三明治）。",
        "scene": {
            "setting": "温暖的家庭餐桌旁",
            "actor": "拿着一半三明治的孩子",
            "props": ["恰好切成两半的三明治", "圆餐盘", "小叉子"],
            "beats": ["孩子看见一份三明治正好分成两半", "孩子拿起其中一半", "另一半留在盘子里"],
            "ending": "孩子拿着两半中的一半，另一半单独放在盘子里；全图只有这两半",
        },
        "reviewNote": "复核后改为三明治，句子自然；画面必须只出现两半，明确展示孩子拥有其中一半。",
    },
    "I": {
        "scene": {
            "setting": "明亮简洁的室内",
            "actor": "正面朝向观者、闭上一只眼睛的孩子",
            "props": ["一枝鲜花", "木椅", "小布球"],
            "beats": ["孩子看向观者", "孩子闭上一只眼睛", "孩子自然地眨眼微笑"],
            "ending": "孩子正面看向观者，清楚闭上一只眼睛眨眼",
        },
        "reviewNote": "移除镜子和倒影，避免重复人物；句子自然，正面闭眼动作直接呈现 eye/I 联想。",
    },
    "two": {
        "sentence": "The tooth fairy leaves two coins beside one baby tooth（牙仙在一颗乳牙旁留下两枚硬币）。",
        "scene": {
            "setting": "夜晚的儿童卧室",
            "actor": "蹲在枕头旁的牙仙",
            "props": ["恰好一颗乳牙", "恰好两枚无刻字硬币", "柔软枕头"],
            "beats": ["牙仙发现枕头旁的一颗乳牙", "牙仙数出两枚硬币", "牙仙把两枚硬币放在乳牙旁"],
            "ending": "一颗乳牙旁清楚放着两枚没有数字或图案的硬币",
        },
        "reviewNote": "原图多画了乳牙且硬币似有数字，已改句和场景为一颗牙、两枚无刻字硬币。",
    },
    "direction": {
        "sentence": "The guide directs a hiker toward the river, showing the direction to follow（向导把一名徒步者引向河边，告诉他该走的方向）。",
        "scene": {
            "setting": "河边的分岔山路",
            "actor": "一名举手指路的向导和一名徒步者",
            "props": ["分岔小路", "木手杖", "远处的河流"],
            "beats": ["向导和一名徒步者走到岔路口", "向导把徒步者引向河边一侧", "徒步者沿着指出的方向出发"],
            "ending": "向导只为一名徒步者指明通往河边的方向",
        },
        "reviewNote": "原图多出一名徒步者；句子改为单数并将画面人数限制为向导和一名徒步者。",
    },
    "four": {
        "scene": {
            "setting": "温暖农舍敞开的门口",
            "actor": "无人物，只突出滚动的苹果",
            "props": ["敞开的木门", "全图恰好四个红苹果", "空藤编篮子"],
            "beats": ["空篮子碰歪滚到门边", "四个苹果从篮口滚出", "四个苹果滚过敞开的门槛"],
            "ending": "门边清楚可数的四个红苹果正滚过门槛，篮子里和背景中没有其他水果",
        },
        "reviewNote": "原图苹果数量超过四个；重做后锁定全图总数恰好四个，篮子为空且背景无水果。",
    },
    "three": {
        "scene": {
            "setting": "只有一棵树的开阔草地",
            "actor": "无人物，只突出树和落果",
            "props": ["一棵苹果树", "全图恰好三个红苹果", "空藤篮"],
            "beats": ["三个苹果挂在唯一的树枝上", "三个苹果从枝头落下", "三个苹果落向树下空篮"],
            "ending": "唯一一棵树下只有三个苹果，背景没有其他树、果实或果园",
        },
        "reviewNote": "原图背景果树和苹果过多；场景收为单树草地，全图只留三个苹果和空篮。",
    },
    "statement": {
        "scene": {
            "setting": "安静简洁的听证室",
            "actor": "一名证人在麦克风前，面对一名听众",
            "props": ["立式麦克风", "简洁讲台", "空白纸张"],
            "beats": ["证人走到麦克风前", "证人平静陈述经过", "唯一听众认真聆听"],
            "ending": "证人在麦克风前向一名听众作出简短声明",
        },
        "reviewNote": "原图有三个人；重做场景只保留证人和一名听众，声明与 state 的陈述动作同时可见。",
    },
    "economic": {
        "sentence": "The local economy grows when a shopkeeper spends money on new goods, creating economic activity（店主花钱购进新货，带动当地经济活动）。",
        "scene": {
            "setting": "安静简洁的小镇商店",
            "actor": "一名正在补货的店主",
            "props": ["几枚无刻字硬币", "木制货架", "一篮新货"],
            "beats": ["店主把硬币投入进货", "店主把新货摆上货架", "原本空出的货架被新货填满"],
            "ending": "店主独自在店里补满货架，硬币和新货同时清楚可见",
        },
        "reviewNote": "原图出现清晰英文招牌且人物过多；句子改为单店主，画面不得有招牌或任何文字。",
    },
    "likely": {
        "anchor": "umbrella",
        "anchorMeaning": "雨伞",
        "relation": "雨伞是看见降雨可能性时会准备的具体物件；语义场景锚点，不作词源或拼写关系。",
        "sentence": "Dark clouds make rain likely, so the child opens an umbrella（乌云预示着可能下雨，孩子因此撑开雨伞）。",
        "mode": "concept",
        "scene": {
            "setting": "乌云刚聚起、还没有下雨的田野边",
            "actor": "准备撑伞的孩子",
            "props": ["聚拢的深灰云层", "打开的蓝色雨伞", "被风吹起的几片叶子"],
            "beats": ["孩子看见乌云聚拢", "孩子判断可能马上下雨", "孩子撑开雨伞等待"],
            "ending": "孩子在尚未落雨时撑开伞，深云和风叶显示降雨可能性",
        },
        "reviewNote": "原图已在下雨，表达的是事实而非可能性；改为尚未落雨，并以雨伞作语义锚点。",
    },
    "scientist": {
        "scene": {
            "setting": "背景简洁的实验室工作台",
            "actor": "一名专注研究样本的科学家",
            "props": ["一台显微镜", "一个透明样本瓶", "一个烧杯"],
            "beats": ["科学家把样本瓶放到显微镜旁", "科学家观察样本", "科学家把样本放入烧杯完成测试"],
            "ending": "科学家在只有显微镜、样本瓶和烧杯的工作台前研究样本",
        },
        "reviewNote": "原图背景实验器具太多；重做时只保留三件关键实验器材和一名科学家。",
    },
    "teacher": {
        "scene": {
            "setting": "简洁安静的教室",
            "actor": "一名老师和一名学生",
            "props": ["一截粉笔", "空白黑板", "一张木课桌"],
            "beats": ["老师拿起粉笔", "老师在黑板上画简单图形并讲解", "唯一学生认真听懂后点头"],
            "ending": "老师手持粉笔给一名学生讲课，教室里没有其他人",
        },
        "reviewNote": "原图多出三名学生；重做时明确画面只有一名老师和一名学生。",
    },
    "themselves": {
        "scene": {
            "setting": "没有标牌的比赛后更衣室",
            "actor": "两名球员站在镜前；镜中只显示他们各自正常的倒影",
            "props": ["高身镜", "足球", "搭在长凳上的球衣"],
            "beats": ["两名球员走到镜前", "他们在镜中看见自己的倒影", "他们相视一笑并整理球衣"],
            "ending": "两名球员在镜中看着自己的倒影，画面没有其他人物或标牌",
        },
        "reviewNote": "原图多出运动员标识牌且镜前人物关系混乱；重做时保留两名球员及正常镜像，不加标牌。",
    },
}

pass_words = {"be", "do", "accord", "social", "different", "education", "service", "worker"}
fail_notes = {
    "have": "数量不符：图里多出三角派块，half 不清楚。",
    "I": "镜面出现重复人物，未通过逐张肢体/重复检查。",
    "two": "乳牙数量多于句子所说，且硬币疑似带数字。",
    "direction": "向导和两名徒步者超出两人上限。",
    "four": "苹果数量超过 four。",
    "three": "背景出现额外树和苹果，数量远超 three。",
    "statement": "出现证人加两名听众，共三人。",
    "economic": "出现清晰的 Economy 招牌文字，且场景人物过多。",
    "likely": "已经下雨，画面表达的是正在发生而非 likely。",
    "scientist": "实验器具远超三件关键物品，背景过于拥挤。",
    "teacher": "出现三名学生，超过句子和场景卡设定。",
    "themselves": "额外出现运动员图标标牌，镜前人物关系不清。",
}

seed = json.loads(SEED.read_text(encoding="utf-8-sig"))
for card in seed:
    change = rework.get(card["word"])
    if not change:
        continue
    for key, value in change.items():
        if key == "reviewNote":
            card.setdefault("review", {})["reviewNote"] = value
        else:
            card[key] = value
    card.setdefault("review", {}).update(
        sentenceFluency="pass",
        sentenceReadability="pass",
        anchorRelation="pass",
    )
    assert card["anchor"].casefold() in card["sentence"].casefold(), card["word"]
    assert card["word"].casefold() in card["sentence"].casefold(), card["word"]
SEED.write_text(json.dumps(seed, ensure_ascii=False, indent=2), encoding="utf-8")

queue = json.loads(QUEUE.read_text(encoding="utf-8"))
for card in queue["cards"][:20]:
    if card["word"] in pass_words:
        card.update(imageStatus="approved", imageQCStatus="pass", imageReview="画面逐张检查通过：锚点与目标义可见，无文字或明显解剖问题。")
    elif card["word"] in fail_notes:
        card.update(imageStatus="redo", imageQCStatus="rejected", imageReview=fail_notes[card["word"]])
QUEUE.write_text(json.dumps(queue, ensure_ascii=False, indent=2), encoding="utf-8")

if IMAGE_MANIFEST.exists():
    manifest = json.loads(IMAGE_MANIFEST.read_text(encoding="utf-8"))
    for card in queue["cards"][:20]:
        entry = manifest.get("cards", {}).get(card["id"])
        if entry:
            entry["imageStatus"] = card["imageStatus"]
            entry["imageQCStatus"] = card["imageQCStatus"]
            entry["imageReview"] = card.get("imageReview")
    IMAGE_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

print("batch01 sentence corrections saved; image pass", len(pass_words), "redo", len(fail_notes))
