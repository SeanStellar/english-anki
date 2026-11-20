"""Enrich the extracted word list with historical exam frequencies and dictionary meanings."""
import csv
import glob
import html
import os
import pathlib
import re
import sys
import tempfile
import unicodedata
import urllib.request
from collections import Counter, OrderedDict
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.abspath('shengtu/.xlsx_deps'))
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Alignment, Font, PatternFill

OUT = os.path.join('shengtu', '\u8003\u7814\u8bcd\u6c47.xlsx')
DICT_PATH = pathlib.Path(tempfile.gettempdir()) / 'english_kaoyan_ecdict.csv'
BASE_URL = 'https://study.aseeker.bio'
TOKEN_RE = re.compile(r"[A-Za-z]+(?:['\u2019][A-Za-z]+)*(?:[-\u2010\u2011\u2013][A-Za-z]+(?:['\u2019][A-Za-z]+)*)*")
POS_RE = re.compile(r'(?<![A-Za-z])(interjection|interj|vt|vi|aux|modal|prep|pron|conj|art|num|int|abbr|adj|adv|ad|pl|n|v|a)\.', re.I)
POS_CN = {
    'n':'\u540d\u8bcd', 'pl':'\u540d\u8bcd\uff08\u590d\u6570\u5f62\u5f0f\uff09', 'v':'\u52a8\u8bcd', 'vt':'\u53ca\u7269\u52a8\u8bcd', 'vi':'\u4e0d\u53ca\u7269\u52a8\u8bcd',
    'a':'\u5f62\u5bb9\u8bcd', 'adj':'\u5f62\u5bb9\u8bcd', 'ad':'\u526f\u8bcd', 'adv':'\u526f\u8bcd', 'prep':'\u4ecb\u8bcd', 'pron':'\u4ee3\u8bcd',
    'conj':'\u8fde\u8bcd', 'art':'\u51a0\u8bcd', 'num':'\u6570\u8bcd', 'int':'\u611f\u53f9\u8bcd', 'interj':'\u611f\u53f9\u8bcd',
    'interjection':'\u611f\u53f9\u8bcd', 'aux':'\u52a9\u52a8\u8bcd', 'modal':'\u60c5\u6001\u52a8\u8bcd', 'abbr':'\u7f29\u5199'
}
MANUAL = {
    'a / an': ('\u4e0d\u5b9a\u51a0\u8bcd', '\u4e00\uff1b\u4e00\u4e2a\uff08a/an\uff09'),
    'according to': ('\u4ecb\u8bcd\u77ed\u8bed', '\u6839\u636e\uff1b\u6309\u7167\uff1b\u636e\u2026\u2026\u6240\u8bf4'),
    'agenda': ('\u540d\u8bcd', '\u8bae\u7a0b\uff1b\u5f85\u529e\u4e8b\u9879'),
    'air conditioning': ('\u540d\u8bcd\u77ed\u8bed', '\u7a7a\u8c03\uff1b\u7a7a\u6c14\u8c03\u8282'),
    'bacteria': ('\u540d\u8bcd\uff08\u590d\u6570\u5f62\u5f0f\uff09', '\u7ec6\u83cc'),
    'cyberspace': ('\u540d\u8bcd', '\u7f51\u7edc\u7a7a\u95f4\uff1b\u8d5b\u535a\u7a7a\u95f4'),
    'data': ('\u540d\u8bcd\uff08\u590d\u6570\u5f62\u5f0f\uff09', '\u8d44\u6599\uff1b\u6570\u636e'),
    'goodbye': ('\u611f\u53f9\u8bcd', '\u518d\u89c1'),
    'hello': ('\u611f\u53f9\u8bcd', '\u4f60\u597d\uff1b\u5582'),
    'hi / hey': ('\u611f\u53f9\u8bcd', '\u55e8\uff1b\u5582\uff1b\u4f60\u597d'),
    'ice cream': ('\u540d\u8bcd\u77ed\u8bed', '\u51b0\u6dc7\u6dcb'),
    'internet / internet': ('\u540d\u8bcd', '\u4e92\u8054\u7f51\uff1b\u56e0\u7279\u7f51'),
    'laptop': ('\u540d\u8bcd', '\u7b14\u8bb0\u672c\u7535\u8111'),
    'living room': ('\u540d\u8bcd\u77ed\u8bed', '\u8d77\u5c45\u5ba4\uff1b\u5ba2\u5385'),
    'ought to': ('\u60c5\u6001\u52a8\u8bcd\u77ed\u8bed', '\u5e94\u8be5\uff1b\u5e94\u5f53'),
    'owing to': ('\u4ecb\u8bcd\u77ed\u8bed', '\u7531\u4e8e\uff1b\u56e0\u4e3a'),
    'scissors': ('\u540d\u8bcd\uff08\u590d\u6570\u5f62\u5f0f\uff09', '\u526a\u5200'),
    'trousers': ('\u540d\u8bcd\uff08\u590d\u6570\u5f62\u5f0f\uff09', '\u88e4\u5b50\uff1b\u957f\u88e4'),
}

def norm(s):
    s = unicodedata.normalize('NFKC', s.replace('\u2019', "'").replace('\u2018', "'").replace('\u2011', '-').replace('\u2013', '-').replace('\u2010', '-'))
    return re.sub(r'\s+', ' ', s).strip().casefold()

def edit_distance(a, b):
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y)))
        previous = current
    return previous[-1]

if not DICT_PATH.exists():
    request = urllib.request.Request('https://raw.githubusercontent.com/skywind3000/ECDICT/master/ecdict.csv', headers={'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(request, timeout=90) as source, DICT_PATH.open('wb') as target:
        while True:
            block = source.read(1 << 20)
            if not block:
                break
            target.write(block)

dictionary = {}
with DICT_PATH.open('r', encoding='utf-8-sig', newline='') as stream:
    for row in csv.DictReader(stream):
        key = norm(row.get('word', ''))
        if key and key not in dictionary:
            dictionary[key] = row

def expand_entry(raw):
    raw = raw.strip()
    if norm(raw) in dictionary:
        return [raw]
    raw = raw.replace('(1)', '(l)')
    if ' / ' in raw:
        first = raw.split(' / ')[0].strip()
        expanded = []
        for part in raw.split(' / '):
            part = part.strip()
            if part.startswith('-'):
                suffix = part[1:]
                options = [first[:cut] + suffix for cut in range(1, len(first)) if norm(first[:cut] + suffix) in dictionary]
                if options:
                    best = min(edit_distance(norm(first), norm(option)) for option in options)
                    expanded.extend(option for option in options if edit_distance(norm(first), norm(option)) == best)
            else:
                expanded.extend(expand_entry(part))
        seen = set()
        return [item for item in expanded if norm(item) in dictionary and not (norm(item) in seen or seen.add(norm(item)))]
    if '(' in raw and ')' in raw:
        forms = [re.sub(r'\([^()]*\)', '', raw), re.sub(r'\(([^()]*)\)', r'\1', raw)]
        expanded = []
        for form in forms:
            expanded.extend(expand_entry(form))
        seen = set()
        return [item for item in expanded if norm(item) in dictionary and not (norm(item) in seen or seen.add(norm(item)))]
    return []

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0 (compatible; study vocabulary workbook)'})
    with urllib.request.urlopen(request, timeout=45) as response:
        return response.read().decode('utf-8', 'replace')

def read_paper(year, kind):
    slug = f'{year}_english{kind}'
    page = fetch(f'{BASE_URL}/english/paper/{slug}/')
    start = page.find('<h2>\u771f\u9898\u5168\u6587')
    if start < 0:
        raise RuntimeError(f'\u627e\u4e0d\u5230\u771f\u9898\u6b63\u6587\u8d77\u70b9\uff1a{slug}')
    end = page.find('<nav class="nav"', start)
    body = page[start:end if end >= 0 else len(page)]
    body = re.sub(r'<[^>]+class="zh"[^>]*>.*?</[^>]+>', ' ', body, flags=re.S)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', body))
    text = text.replace('\u2019', "'").replace('\u2018', "'").replace('\u2011', '-').replace('\u2013', '-').replace('\u2010', '-')
    text = re.sub(r'(?<![A-Za-z])[A-D][.)](?=\s)', ' ', text)
    text = re.sub(r'\([A-D]\)', ' ', text)
    text = re.sub(r'\bPart\s+[A-G]\b', 'Part', text, flags=re.I)
    text = re.sub(r'\b[A-G]\s*[-\u2013]\s*[A-G]\b', ' ', text)
    full_tokens = Counter(token.casefold() for token in TOKEN_RE.findall(text))
    tokens = Counter(token.casefold() for token in re.findall(r'[A-Za-z]+', text))
    return slug, {'year': year, 'kind': kind, 'text': text, 'tokens': tokens, 'full_tokens': full_tokens}

paper_args = [(year, kind) for year in range(2017, 2027) for kind in (1, 2)]
with ThreadPoolExecutor(max_workers=4) as pool:
    papers = dict(pool.map(lambda args: read_paper(*args), paper_args))
if len(papers) != 20:
    raise RuntimeError(f'\u771f\u9898\u5957\u6570\u5e94\u4e3a20\uff0c\u5b9e\u9645{len(papers)}')

def count_candidate(candidate, paper):
    pieces = [token.casefold() for token in TOKEN_RE.findall(norm(candidate))]
    if not pieces:
        return 0
    if len(pieces) == 1:
        if '-' in pieces[0] or "'" in pieces[0]:
            return paper['full_tokens'][pieces[0]]
        return paper['tokens'][pieces[0]]
    pattern = r"(?<![A-Za-z0-9'\-])" + r'\s+'.join(re.escape(piece) for piece in pieces) + r"(?![A-Za-z0-9'\-])"
    return len(re.findall(pattern, paper['text'], flags=re.I))

for sample, expected in [('answer', 170), ('words', 57), ('well-being', 12)]:
    actual = sum(count_candidate(sample, paper) for paper in papers.values())
    if actual != expected:
        raise RuntimeError(f'\u771f\u9898\u9891\u6b21\u62bd\u67e5\u672a\u5bf9\u4e0a\uff1a{sample}={actual}\uff0c\u7f51\u9875\u516c\u5e03={expected}')

source_wb = load_workbook(OUT, read_only=True, data_only=True)
entries = [str(row[1]).strip() for row in list(source_wb.worksheets[0].values)[1:] if row and len(row) > 1 and row[1]]
source_wb.close()
layout_artifact = 'arranged in vertical alphabetical clusters'
entries = [entry for entry in entries if norm(entry) != norm(layout_artifact)]
if len(entries) != 5423:
    raise RuntimeError(f'\u6e05\u7406\u540e\u8bcd\u6761\u6570\u4e0e\u9884\u671f\u4e0d\u7b26\uff1a{len(entries)}')

manual = {norm(key): value for key, value in MANUAL.items()}
records = []
for entry in entries:
    forms = expand_entry(entry)
    form_keys = list(dict.fromkeys(norm(form) for form in forms))
    if not form_keys:
        raise RuntimeError(f'\u672a\u5339\u914d\u5230\u8bcd\u5178\u8bcd\u6761\uff1a{entry}')
    frequency = 0
    for slug, paper in papers.items():
        occurrences = sum(count_candidate(form, paper) for form in form_keys)
        frequency += occurrences
    parts = OrderedDict()
    untagged = []
    for key in form_keys:
        raw = dictionary[key].get('translation', '').replace(r'\n', '\n')
        for line in raw.splitlines():
            line = line.strip()
            if not line or line.startswith('['):
                continue
            match = POS_RE.match(line)
            if match:
                code = match.group(1).casefold()
                meaning = re.sub(r'^\[[^\]]+\]\s*', '', line[match.end():].strip(' ;\uff1b'))
                if meaning and not meaning.startswith('['):
                    parts.setdefault(code, [])
                    if norm(meaning) not in {norm(item) for item in parts[code]}:
                        parts[code].append(meaning)
            elif not untagged:
                untagged.append(line)
    pos = '\uff1b'.join(dict.fromkeys(POS_CN[code] for code in parts if code in POS_CN))
    if parts:
        translation = '\uff1b'.join(f"{POS_CN[code]}\uff1a{'\uff1b'.join(senses)}" for code, senses in parts.items() if code in POS_CN and senses)
    else:
        translation = '\uff1b'.join(dict.fromkeys(untagged))
        pos = '\u77ed\u8bed' if ' ' in entry else '\u672a\u6807\u6ce8'
    if norm(entry) in manual:
        pos, translation = manual[norm(entry)]
    if not pos or not translation:
        raise RuntimeError(f'\u8bcd\u6027\u6216\u91ca\u4e49\u4e3a\u7a7a\uff1a{entry} / {pos} / {translation}')
    records.append({'word':entry, 'pos':pos, 'translation':translation, 'frequency':frequency})

ranked = sorted(records, key=lambda item: (-item['frequency'], norm(item['word'])))

wb = Workbook()
ws = wb.active
ws.title = '\u8003\u7814\u8bcd\u6c47'
headers = ['\u5e8f\u53f7','\u8bcd\u6761','\u8bcd\u6027','\u4e2d\u6587\u91ca\u4e49','\u8fd110\u5e74\u771f\u9898\u8bcd\u9891']
ws.append(headers)
for i, item in enumerate(records, 1):
    ws.append([i,item['word'],item['pos'],item['translation'],item['frequency']])
freq_ws = wb.create_sheet('\u6309\u8bcd\u9891\u6392\u5e8f')
freq_ws.append(headers)
for i, item in enumerate(ranked, 1):
    freq_ws.append([i,item['word'],item['pos'],item['translation'],item['frequency']])

notes = wb.create_sheet('\u8bf4\u660e')
notes.append(['\u9879\u76ee','\u8bf4\u660e'])
note_rows = [
    ('\u8bcd\u6761\u6765\u6e90','\u300a2025\u5e74\u5168\u56fd\u7855\u58eb\u7814\u7a76\u751f\u62db\u751f\u8003\u8bd5\u82f1\u8bed\uff08\u4e00\uff09\u8003\u8bd5\u5927\u7eb2\uff08\u975e\u82f1\u8bed\u4e13\u4e1a\uff09\u300b\u9644\u5f551\u8bcd\u6c47\u8868\uff1b\u6cbf\u7528\u9879\u76ee\u76ee\u5f55\u4e2d\u7684\u5927\u7eb2 PDF\u3002'),
    ('\u8bcd\u6761\u6570\u91cf',f'{len(records)} \u6761\u3002\u539f OCR \u63d0\u53d6 5424 \u6761\uff0c\u5254\u9664\u4e86 1 \u6761 PDF \u6392\u7248\u8bf4\u660e\u201c{layout_artifact}\u201d\uff0c\u907f\u514d\u628a\u8bf4\u660e\u6587\u5b57\u5f53\u5355\u8bcd\u3002'),
    ('\u771f\u9898\u8303\u56f4','2017\u20142026 \u5e74\u82f1\u8bed\uff08\u4e00\uff0910 \u5957\u3001\u82f1\u8bed\uff08\u4e8c\uff0910 \u5957\uff0c\u5171 20 \u5957\u3002'),
    ('\u8bcd\u9891\u7edf\u8ba1\u53e3\u5f84','\u4ece\u771f\u9898\u6b63\u6587\u3001\u9898\u5e72\u3001\u82f1\u6587\u9009\u9879\u8ba1\u6570\uff0c\u5927\u5c0f\u5199\u4e0d\u654f\u611f\uff1b\u6392\u9664 A/B/C/D \u9009\u9879\u6807\u53f7\u3002\u6487\u53f7\u548c\u8fde\u5b57\u7b26\u4f5c\u4e3a\u8bcd\u754c\uff0c\u6240\u6709\u683c\u57fa\u7840\u8bcd\u4f1a\u8ba1\u5165\uff1b\u8fde\u5b57\u7b26\u8bcd\u6761\u4e5f\u6309\u6574\u4f53\u5339\u914d\u3002\u591a\u8bcd\u77ed\u8bed\u6309\u8fde\u7eed\u51fa\u73b0\u8ba1\u6570\u3002\u672a\u505a\u8bcd\u5f62\u8fd8\u539f\u3002\u8bcd\u6761\u4e2d\u659c\u7ebf\u6216\u62ec\u53f7\u5217\u51fa\u7684\u53d8\u4f53\u5408\u5e76\u7edf\u8ba1\u3002'),
    ('\u8bcd\u9891\u6765\u6e90','\u8003\u7814\u771f\u9898\u7f51\u7684\u516c\u5f00\u771f\u9898\u8bcd\u6c47\u4e0e\u8bd5\u9898\u6574\u7406\uff08\u975e\u5b98\u65b9\u7edf\u8ba1\uff09\u3002\u8be5\u7ad9\u8bf4\u660e\u8d44\u6599\u6765\u6e90\u5305\u542b\u516c\u5f00\u771f\u9898\u4e0e\u56de\u5fc6\u7248\uff1b\u8bcd\u9891\u53cd\u6620\u8be5\u7ad9\u6574\u7406\u8bed\u6599\u3002'),
    ('\u8bcd\u9891\u6765\u6e90\u7f51\u5740','https://study.aseeker.bio/english/words/'),
    ('\u6570\u636e\u6838\u5bf9','\u91cd\u65b0\u7edf\u8ba1\u7f51\u7ad9 2017\u20142026 \u5e74 20 \u5957\u8bd5\u9898\u6b63\u6587\u4e0e\u82f1\u6587\u9009\u9879\uff1banswer\u3001words\u3001well-being \u5206\u522b\u4e3a 170\u300157\u300112\uff0c\u4e0e\u7f51\u7ad9\u516c\u5e03\u503c\u4e00\u81f4\u3002\u7f51\u7ad9 people \u8bcd\u6761\u9875\u663e\u793a 132\uff0c\u672c\u8868\u6309\u7edf\u4e00\u5207\u5206\u89c4\u5219\u4e3a 142\uff1b\u5dee\u5f02\u6765\u81ea people\u2019s \u7b49\u6240\u6709\u683c\u7684\u5904\u7406\uff0c\u672c\u8868\u5c06\u6487\u53f7\u4f5c\u4e3a\u8bcd\u754c\u3002'),
    ('\u8bcd\u6027\u4e0e\u91ca\u4e49\u6765\u6e90','ECDICT \u82f1\u6c49\u8bcd\u5178\u6570\u636e\u5e93\uff08MIT License\uff09\uff1b\u5408\u5e76\u540c\u4e00\u8bcd\u6761\u5217\u51fa\u7684\u62fc\u5199/\u8bcd\u5f62\u53d8\u4f53\uff0c\u6574\u7406\u8bcd\u6027\u548c\u5e38\u7528\u4e2d\u6587\u91ca\u4e49\u3002\u5c11\u6570\u65e0\u901a\u7528\u8bcd\u6027\u6807\u6ce8\u7684\u6761\u76ee\u4f5c\u4e86\u4eba\u5de5\u8865\u5145\u3002'),
    ('\u8bcd\u5178\u6765\u6e90\u7f51\u5740','https://github.com/skywind3000/ECDICT'),
    ('\u5b57\u6bb5\u8bf4\u660e','\u552f\u4e00\u8bcd\u9891\u5217\u662f 2017\u20142026 \u5e74\u82f1\u4e00\u548c\u82f1\u4e8c 20 \u5957\u771f\u9898\u7684\u7d2f\u8ba1\u51fa\u73b0\u6b21\u6570\uff1b\u300c\u6309\u8bcd\u9891\u6392\u5e8f\u300d\u9875\u4f7f\u7528\u76f8\u540c\u8bcd\u9891\u503c\u964d\u5e8f\u6392\u5217\u3002'),
    ('\u96f6\u9891\u6761\u76ee','0 \u8868\u793a\u8be5\u8bcd\u6761\u672a\u5728\u4e0a\u8ff0 20 \u5957\u8bed\u6599\u4e2d\u5339\u914d\u5230\uff1b\u8bcd\u5f62\u53d8\u5316\u9664\u8bcd\u6761\u672c\u8eab\u5217\u51fa\u7684\u53d8\u4f53\u5916\u4e0d\u5408\u5e76\u3002'),
    ('\u6574\u7406\u65e5\u671f','2026-11-03'),
]
for row in note_rows:
    notes.append(row)

header_fill = PatternFill('solid', fgColor='1F4E78')
header_font = Font(name='Microsoft YaHei', bold=True, color='FFFFFF', size=10)
body_font = Font(name='Microsoft YaHei', size=10)
for sheet in (ws, freq_ws):
    sheet.freeze_panes = 'C2'
    sheet.auto_filter.ref = f'A1:E{sheet.max_row}'
    sheet.sheet_view.showGridLines = False
    sheet.row_dimensions[1].height = 28
    for col, width in {'A':9,'B':28,'C':24,'D':72,'E':20}.items():
        sheet.column_dimensions[col].width = width
    for cell in sheet[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)
    for row in sheet.iter_rows(min_row=2):
        for cell in row:
            cell.font = body_font
        row[0].alignment = Alignment(horizontal='right', vertical='top')
        row[1].number_format = '@'
        row[2].alignment = Alignment(vertical='top', wrap_text=True)
        row[3].alignment = Alignment(vertical='top', wrap_text=True)
        for cell in row[4:]:
            cell.alignment = Alignment(horizontal='right', vertical='top')
            cell.number_format = '0'

notes.sheet_view.showGridLines = False
notes.freeze_panes = 'A2'
notes.auto_filter.ref = f'A1:B{notes.max_row}'
notes.column_dimensions['A'].width = 22
notes.column_dimensions['B'].width = 115
notes.row_dimensions[1].height = 26
for cell in notes[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal='center', vertical='center')
for row in notes.iter_rows(min_row=2):
    row[0].font = Font(name='Microsoft YaHei', bold=True, size=10)
    row[0].alignment = Alignment(vertical='top')
    row[1].font = body_font
    row[1].alignment = Alignment(vertical='top', wrap_text=True)
    if row[0].value in ('\u8bcd\u9891\u6765\u6e90\u7f51\u5740','\u8bcd\u5178\u6765\u6e90\u7f51\u5740'):
        row[1].hyperlink = str(row[1].value)
        row[1].style = 'Hyperlink'

tmp_out = OUT + '.tmp.xlsx'
wb.save(tmp_out)
check = load_workbook(tmp_out, read_only=True, data_only=True)
if check.sheetnames != ['\u8003\u7814\u8bcd\u6c47','\u6309\u8bcd\u9891\u6392\u5e8f','\u8bf4\u660e']:
    raise RuntimeError(f'\u5de5\u4f5c\u8868\u5f02\u5e38\uff1a{check.sheetnames}')
if check['\u8003\u7814\u8bcd\u6c47'].max_row != len(records) + 1 or check['\u6309\u8bcd\u9891\u6392\u5e8f'].max_row != len(records) + 1:
    raise RuntimeError('\u4fdd\u5b58\u540e\u8bcd\u6761\u884c\u6570\u5f02\u5e38')
if check['\u8003\u7814\u8bcd\u6c47'].max_column != 5 or check['\u6309\u8bcd\u9891\u6392\u5e8f'].max_column != 5:
    raise RuntimeError('\u8bcd\u9891\u5217\u6570\u5f02\u5e38')
check.close()
os.replace(tmp_out, OUT)
print('saved:', os.path.abspath(OUT))
print('entries:',len(records),'frequency_gt_0:',sum(item['frequency']>0 for item in records),'zero:',sum(item['frequency']==0 for item in records),'papers:',len(papers))
print('top:',[(item['word'],item['frequency']) for item in ranked[:12]])
print('a_an_frequency:',next(item['frequency'] for item in records if item['word']=='a / an'))
