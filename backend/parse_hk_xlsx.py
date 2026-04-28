#
# File: parse_hk_xlsx.py
# Created: 2024-01-01
# Author: CAISHENG <caisheng.cn@gmail.com>
# Description: Parses HK stock data from an xlsx spreadsheet file.
#              Extracts stock codes and names from cells filtered by category (Equity,
#              Exchange Traded Products, Real Estate Investment Trusts).
# Version History:
#   1.0 - Initial version with xlsx parsing and stock extraction
#

import zipfile, xml.etree.ElementTree as ET, re, json, sys

with zipfile.ZipFile('/tmp/hk_stocks.xlsx') as z:
    ss_tree = ET.parse(z.open('xl/sharedStrings.xml'))
    ns = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
    shared_strings = [si.find('s:t', ns).text if si.find('s:t', ns) is not None else '' for si in ss_tree.findall('.//s:si', ns)]

    sheet_tree = ET.parse(z.open('xl/worksheets/sheet1.xml'))
    rows = sheet_tree.findall('.//s:row', {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'})

    stocks = []
    for row in rows[3:]:
        cells = row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c')
        vals = {}
        for cell in cells:
            ref = cell.get('r', '')
            col = re.match(r'([A-Z]+)', ref)
            if not col: continue
            cl = col.group(1)
            v = cell.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
            t = cell.get('t', '')
            val = shared_strings[int(v.text)] if t == 's' and v is not None else (v.text if v is not None else '')
            vals[cl] = str(val) if val else ''

        code = vals.get('A', '')
        name = vals.get('B', '')
        cat = vals.get('C', '')

        if not (code and name and code.isdigit()):
            continue
        if cat not in ('Equity', 'Exchange Traded Products', 'Real Estate Investment Trusts'):
            continue

        stocks.append({'code': code, 'name': name})

json.dump(stocks, sys.stdout)
