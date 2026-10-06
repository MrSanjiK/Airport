"""Place the HORECA deck's Tashkent venues (name + landmark, pages 7–8) on the map.

Usage: python3 scripts/data/horeca_geo.py <pairs.tsv> <cache-dir>
  pairs.tsv: one "NAME<TAB>landmark or address" per line, as printed in the deck.
Each landmark is looked up with Nominatim inside Tashkent (cached in <cache-dir>/nominatim-tash.json);
the venue then takes the nearest OSM restaurant with its name within 700 m (exact), else the landmark (≈).
Writes scripts/data/horeca_deck.json for cities.py.
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

pairs = [l.rstrip('\n').split('\t') for l in open(sys.argv[1]) if '\t' in l]
CACHE = sys.argv[2]
NC = f'{CACHE}/nominatim-tash.json'
NOM = json.load(open(NC)) if os.path.exists(NC) else {}
VIEW = '69.10,41.44,69.48,41.18'


def search(q):
    if q not in NOM:
        url = 'https://nominatim.openstreetmap.org/search?' + urllib.parse.urlencode({'q': q, 'format': 'jsonv2', 'limit': 3, 'countrycodes': 'uz', 'viewbox': VIEW, 'bounded': 1, 'accept-language': 'ru'})
        try:
            NOM[q] = json.load(urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'MediaPortSite/1.0 (venue geocoding)'}), timeout=30))
        except Exception as e:  # noqa: BLE001
            print('fail', q, e)
            NOM[q] = []
        time.sleep(1.1)
        json.dump(NOM, open(NC, 'w'), ensure_ascii=False)
    return NOM[q]


def clean(s):
    s = re.sub(r'[«»"“”]', '', s)
    s = re.sub(r'^(Ташкент|Ташкентская область),\s*', '', s)
    s = re.sub(r'\b(Бывш\.|бывш\.)\s*', '', s)
    s = re.sub(r',?\s*\d+\s*этаж', '', s)
    return s.strip(' .')


# a few landmarks Nominatim knows under another name
ALIAS = {
    'ТРЦ Next': ['Next', 'Некст'], 'ТРЦ Mega Planet': ['Mega Planet'], 'Гостиница THE ELEMENTS': ['The Elements'],
    'Спортивный комплекс JAR': ['Жар', 'JAR'], 'Госпитальный рынок': ['Госпитальный'], 'Городская больница № 1': ['Городская клиническая больница № 1'],
    'Mediapark Караташ': ['Mediapark'], 'Сквер им. Амира Темура': ['Сквер Амира Темура'], 'Дворец Дружбы Народов': ['Дворец дружбы народов', 'Дворец Халклар Дустлиги'],
    'Посольство Республики Казахстан': ['Посольство Казахстана'], 'Детский мир': ['Детский мир'], 'Алгоритм': ['Алгоритм рынок', 'Algoritm'],
    'Банкетный зал Фарход': ['Фарход'], 'Катартал': ['Катартал'], 'Стадион Бунёдкор': ['Бунёдкор стадион', 'Milliy stadion'],
    'Магазин Чимган': ['Чимган'], 'Гостиница Сайёхат': ['Сайёхат'], 'Перекресток Шастри': ['Шастри'], 'Рынок МАЛИКА': ['Малика рынок', 'Малика'],
    'Чайхана Sultan Said': ['Sultan Said'], 'ТЦ Farg\'ona': ['Фаргона'], 'ТЦ Ярмарка — Сергели': ['Ярмарка Сергели'], 'Паркентский рынок': ['Паркентский рынок'],
    'Узбум': ['Узбум'], 'Ибн Сино': ['Ибн Сино'], 'Истирахат': ['Истирохат'], 'Ресторан Yakkasaroy': ['Яккасарай'], 'Кукча Дарвоза': ['Кукча'],
    'Куш Беги': ['Кушбеги'], 'Рисовый базар': ['Рисовый базар'], 'Городской родильный комплекс № 8': ['Родильный комплекс 8'], 'Ханабад': ['Ханабад'],
    'Дубовая': ['Дубовая роща'], 'Мечеть Илон ота': ['Илон ота'], 'Мечеть Бадамзар': ['Бадамзар'], 'Автосалон Юнусабад': ['Юнусабад автосалон'],
}
out = []
for name, mark in pairs:
    if 'Чирчик' in mark:
        out.append({'n': name.title(), 'mark': mark, 'p': None, 'town': 'chirchiq'})
        continue
    m = clean(mark)
    hit = None
    for q in [m, *ALIAS.get(m, [])]:
        r = search(q + ', Ташкент')
        # keep an answer only if it names what we asked for (Nominatim otherwise returns the nearest lookalike)
        keys = [w.lower() for w in re.findall(r'[\w-]{4,}', q) if w.lower() not in ('улица', 'район', 'ташкент', 'рынок', 'мечеть', 'гостиница')]
        house = re.search(r'\b\d+[а-яa-z]?\b', q)
        for cand in r:
            dn = cand.get('display_name', '').lower()
            if keys and all(k[:5] not in dn for k in keys):
                continue
            if house and cand.get('addresstype') not in ('building', 'house', 'amenity', 'shop', 'place') and not dn.startswith(house.group(0).lower()):
                continue
            hit = cand
            break
        if hit:
            break
    out.append({'n': name, 'mark': mark, 'p': [float(hit['lon']), float(hit['lat'])] if hit else None, 'what': hit.get('display_name', '')[:80] if hit else ''})
    print(('OK ' if hit else '-- ') + name, '|', mark, '|', out[-1]['what'])
json.dump(out, open('scripts/data/horeca_deck.json', 'w'), ensure_ascii=False, indent=1)
print(sum(1 for o in out if o['p']), 'of', len(out))
