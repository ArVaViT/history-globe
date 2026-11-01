import json,re,sys,glob,collections
S,R=sys.argv[1],sys.argv[2]
k=json.load(open(f'{S}/wave/wave1.json'))
MOVED=re.compile(r'Dendur|Debod|Taffeh|Ellesy',re.I)
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
for f in glob.glob(f'{R}/content/names-*.yaml'):
    l=f.rsplit('-',1)[1][:2]
    for m in re.finditer(r'^\s+"?\d+"?:\s*"?([^"\n]+)"?\s*$',open(f).read(),re.M): taken[l].add(m.group(1))
out=[];drop=collections.Counter()
for s in sorted(k,key=lambda s:-s['fame']):
    if MOVED.search(s['en']): drop['moved']+=1; continue
    en=clean(s['en'])
    if en in taken['en']: drop['english name taken']+=1; continue
    names={}
    for l,v in s['names'].items():
        v=clean(v)
        if v and v not in taken[l] and v!=en: names[l]=v
        elif v in taken[l]: drop[f'name taken {l}']+=1
    for l,v in names.items(): taken[l].add(v)
    taken['en'].add(en)
    out.append({'id':s['id'],'en':en,**({'names':names} if names else {}),'lon':s['lon'],'lat':s['lat'],'from':s['from_'],'to':s['to'],'approx':True,'kind':s['kind'],'rank':1 if s['fame']>=12 else 2,
      'sources':[f"https://pleiades.stoa.org/places/{s['id']}",f"https://www.wikidata.org/wiki/{s['qid']}",f"years: the span of the periods Pleiades attests it in ({s['periods']})"]})
out.sort(key=lambda s:s['id'])
json.dump({'_source':'Ancient sites, wave 1 (2026-11-01): Pleiades (CC BY 3.0) settlements, sanctuaries and ports linked to a Wikidata item (CC0) that is an ancient site, not a modern town; point from Pleiades; years the span of the periods Pleiades attests (modern ones left out), so approximate; names from Wikidata labels, none that another place on the map already has. Written by a script; see docs/adr/0018.','sites':out},open(f'{R}/content/ancient-sites-wave1.json','w'),ensure_ascii=False,indent=1)
print(len(out),dict(drop),collections.Counter(s['rank'] for s in out))
