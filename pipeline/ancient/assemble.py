import json,os,re,sys,glob,collections
S,R=sys.argv[1],sys.argv[2]; W=os.environ.get('WAVE','1')
k=json.load(open(f'{S}/wave/wave.json'))
# Moved away, or not the ancient place the item is about.
MOVED=re.compile(r'San Vincenzo al Volturno|Dendur|Debod|Taffeh|Ellesy|^Thinis$|Wadi Hammamat',re.I)
# Years the periods cannot give (a town destroyed in the middle of one), from the history
# itself; astronomical years. Checked 2026-11-01.
FIX={'Gamla':(-149,67,'a town from the 2nd century BC, destroyed by Vespasian in AD 67 (Josephus, Jewish War 4.1)'),
 'Stabiae':(None,79,'buried by Vesuvius in AD 79'),
 'Helike':(None,-372,'sunk by the earthquake of 373 BC'),
 'Potidaea':(None,-355,'destroyed by Philip II in 356 BC; refounded as Cassandreia'),
 'Luxor Temple':(None,400,'a temple from Amenhotep III, a Roman camp in the 3rd-4th centuries AD'),
 'Mangup':(500,1300,'the fortress from the 5th-6th centuries AD, Theodoro until 1475'),
 'Eryx':(-549,640,'the Elymian sanctuary town; Wikidata\'s founding (AD 1) is wrong'),
 'Gerf Hussein':(-1269,640,'the rock temple of Ramesses II, built c. 1270 BC'),
 'Methone':(-732,-353,'the Eretrian colony of c. 733 BC, razed by Philip II in 354 BC'),
 'Kainua':(-549,-350,'the Etruscan town of the late 6th century BC, left after the Gauls came in the 4th'),
 'Phintias':(-281,300,'founded by Phintias of Akragas c. 282 BC'),
 'Ptolemais Theron':(-269,300,'founded by Ptolemy II c. 270 BC'),
 'Jebel Khalid':(-299,-69,'the Seleucid fortress, left c. 70 BC'),
 'Segeda':(None,-71,'the Celtiberian town, taken by Rome in 153 BC, its successor left c. 72 BC')}
# English labels Wikidata gives in another language or with a note; kinds it gets wrong.
RENAME={'Temple romain de Château-Bas':'Temple of Château-Bas','Archeological site of Alba-la-Romaine':'Alba Helviorum',
 'Cala Morell Settlement':'Cala Morell','Portus Magnus, Algeria':'Portus Magnus','Poblat talaiòtic de Montefí':'Montefí',
 'Sa Caleta Phoenician Settlement':'Sa Caleta','Nicaea, Locris':'Nicaea in Locris','Epiphania, Cilicia':'Epiphania in Cilicia',
 'Temple of Janus':'Temple of Janus at Autun',
 'Hosn Niha Site':'Hosn Niha','Ancient Tenea':'Tenea','Ancient Lappa':'Lappa','Gremanu nuraghe sacred place':'Gremanu'}
KIND={'Villa of Herodes Atticus':'site','Necropolis of Pranu Muttedu':'site'}
clean=lambda n:re.sub(r'\s*\([^)]*\)','',n).strip()
# Names already on the map, per language: a new site never takes one (Thebe near Troy as «Фивы»).
taken=collections.defaultdict(set)
pl=json.load(open(f'{R}/apps/web/public/data/places.geojson'))['features']
cj=json.load(open(f'{R}/apps/web/public/data/content.json'))
for f in pl: taken['en'].add(f['properties']['name'])
for pid,e in cj['names'].items():
    for l,v in e.items():
        if isinstance(v,str): taken[l].add(v)
for s in json.load(open(f'{R}/content/ancient-sites.json'))['sites']:
    taken['en'].add(s['en']); taken['ru'].add(s['ru'])
for w in glob.glob(f'{R}/content/ancient-sites-wave*.json'):
    if w.endswith(f'wave{W}.json'): continue
    for s in json.load(open(w))['sites']:
        taken['en'].add(s['en'])
        for l,v in s.get('names',{}).items(): taken[l].add(v)
for f in glob.glob(f'{R}/content/names-*.yaml'):
    l=f.rsplit('-',1)[1][:2]
    for m in re.finditer(r'^\s+"?\d+"?:\s*"?([^"\n]+)"?\s*$',open(f).read(),re.M): taken[l].add(m.group(1))
out=[];drop=collections.Counter()
for s in sorted(k,key=lambda s:-s['fame']):
    if MOVED.search(s['en']): drop['moved']+=1; continue
    en=clean(RENAME.get(s['en'],s['en'])); s['kind']=KIND.get(en,s['kind'])
    if en in taken['en']: drop['english name taken']+=1; continue
    names={}
    for l,v in s['names'].items():
        v=clean(v)
        if v and v not in taken[l] and v!=en: names[l]=v
        elif v in taken[l]: drop[f'name taken {l}']+=1
    for l,v in names.items(): taken[l].add(v)
    taken['en'].add(en)
    fx=FIX.get(en)
    if fx:
        s['from_']=fx[0] if fx[0] is not None else s['from_']; s['to']=fx[1]
    out.append({'id':s['id'],'en':en,**({'names':names} if names else {}),'lon':s['lon'],'lat':s['lat'],'from':s['from_'],'to':s['to'],'approx':True,'kind':s['kind'],'rank':1 if s['fame']>=12 else 2,
      'sources':[f"https://pleiades.stoa.org/places/{s['id']}",f"https://www.wikidata.org/wiki/{s['qid']}",f"years: the span of the periods Pleiades attests it in ({s['periods']})"+(f"; by hand: {fx[2]}" if fx else "")]})
out.sort(key=lambda s:s['id'])
json.dump({'_source':f'Ancient sites, wave {W} (2026-11-01): Pleiades (CC BY 3.0) settlements, sanctuaries and ports linked to a Wikidata item (CC0) that is an ancient site, not a modern town; point from Pleiades; years the span of the periods Pleiades attests (modern ones left out), so approximate; names from Wikidata labels, none that another place on the map already has. Written by a script; see docs/adr/0018.','sites':out},open(f'{R}/content/ancient-sites-wave{W}.json','w'),ensure_ascii=False,indent=1)
print(len(out),dict(drop),collections.Counter(s['rank'] for s in out))
