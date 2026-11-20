import re, os, sys
sys.path.insert(0, 'shengtu/.xlsx_deps')
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill, Alignment
source = 'shengtu/_ocr.txt'
out = 'shengtu/考研词汇.xlsx'
entries = []
for line in open(source, encoding='utf-8'):
    m = re.match(r'(\d+)\t(.*)', line.rstrip('\n'))
    if not m: continue
    line_no, text = int(m.group(1)), m.group(2).strip()
    if not 705 <= line_no <= 6187 or not text: continue
    parts = re.split(r'(?:\t|[\u2000-\u200b\u202f\u205f\u3000]{2,})', text)
    for part in parts:
        part = part.strip()
        if not part: continue
        if re.match(r'^(?:A four-column|Left column|Second column|Third column|Fourth column|Right column)', part):
            part = re.sub(r'^(?:A four-column[^:]*:|Left column(?: entries)?:|Second column(?: entries)?:|Third column(?: entries)?:|Fourth column(?: entries)?:|Right column(?: entries)?:)\s*', '', part)
            if not re.match(r'^(?:Left column|Second column|Third column|Fourth column|Right column)$', part):
                for item in re.split(r'[;,]\s*', part):
                    item = item.strip().strip('.“”"')
                    if re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9()'’ /.,&-]*", item) and len(item) <= 45:
                        entries.append(re.sub(r'\s+', ' ', item))
            continue
        if part.startswith('<') or '2025年' in part or '附录' in part or 'column:' in part or '词汇表' in part or '续表' in part or part.startswith('A four-column'): continue
        if len(part) <= 45 and re.fullmatch(r"[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9()'’ /.,&-]*", part):
            entries.append(re.sub(r'\s+', ' ', part))
entries = list(dict.fromkeys(entries))
entries.sort(key=lambda x: (x.casefold(), x))
wb = Workbook()
ws = wb.active
ws.title = '考研词汇'
ws.append(['序号', '词条'])
for i, word in enumerate(entries, 1): ws.append([i, word])
ws.freeze_panes = 'A2'
ws.auto_filter.ref = f'A1:B{ws.max_row}'
ws.column_dimensions['A'].width = 10
ws.column_dimensions['B'].width = 34
for cell in ws[1]:
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill('solid', fgColor='1F4E78')
    cell.alignment = Alignment(horizontal='center')
for row in ws.iter_rows(min_row=2, max_col=2):
    row[0].alignment = Alignment(horizontal='right')
    row[1].number_format = '@'
info = wb.create_sheet('说明')
info.append(['项目', '内容'])
info_rows = [
    ('词汇来源', '《2025年全国硕士研究生招生考试英语（一）考试大纲（非英语专业）》附录1词汇表'),
    ('原大纲要求', '约5500个单词及相关附表内容；原附录主要列单词基本词形，不含中文释义。'),
    ('本表词条数', f'{len(entries)}条（按原样保留词条形式，去除完全重复的OCR行）'),
    ('整理方式', '从扫描版PDF识别词汇，按字母顺序整理；词条可能包含词形变体、并列拼写和少量词组。'),
    ('来源文件', 'shengtu/考研英语一2025考试大纲_附完整词汇表.pdf'),
    ('来源说明', 'PDF下载自考研资料网站镜像，文件正文为考试大纲；并非教育部官网提供的词表下载。'),
]
for row in info_rows: info.append(row)
info.freeze_panes = 'A2'
info.column_dimensions['A'].width = 18
info.column_dimensions['B'].width = 105
for cell in info[1]:
    cell.font = Font(bold=True, color='FFFFFF')
    cell.fill = PatternFill('solid', fgColor='1F4E78')
for row in info.iter_rows(min_row=2):
    row[0].font = Font(bold=True)
    row[1].alignment = Alignment(wrap_text=True, vertical='top')
wb.save(out)
check = load_workbook(out, read_only=True, data_only=True)
check_ws = check['考研词汇']
assert check_ws.max_row == len(entries) + 1
print('saved:', os.path.abspath(out))
print('entries:', len(entries))
print('first:', entries[:8])
print('last:', entries[-8:])
print('letters:', ''.join(sorted(set(x[0].lower() for x in entries))))
