"""How well known each ancient place on the map is: the Wikipedia articles (sitelinks) of its
Wikidata item, where that item is the ancient place itself (an archaeological site, an
ancient city, a tell), not a modern town on it: Amman's articles are not Rabbah's.
Writes content/fame.json, which scripts/build-content.ts ranks the places by.
python3 -I fame.py S R"""
import json,os,sys,time,urllib.request,urllib.parse
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from classes import ANC,MOD
S,R=sys.argv[1],sys.argv[2]
def run(q):
    req=urllib.request.Request('https://query.wikidata.org/sparql',data=urllib.parse.urlencode({'query':q}).encode(),headers={'Accept':'application/sparql-results+json','User-Agent':'HistoryGlobeBot/1.0 (https://historyglobe.app; historyglobe.vadym@gmail.com)'})
    for i in range(4):
        try: return json.load(urllib.request.urlopen(req,timeout=120))['results']['bindings']
        except Exception as e: print('retry',e,file=sys.stderr); time.sleep(20*(i+1))
    raise SystemExit('wikidata failed')
qid=lambda b,k:b[k]['value'].rsplit('/',1)[1]
pl=json.load(open(f'{R}/apps/web/public/data/places.geojson'))['features']
wd=json.load(open(f'{R}/content/wikidata.json'))['places']
an=json.load(open(f'{R}/apps/web/public/data/ancient.geojson'))['features']
qs=sorted({wd[f['properties']['id']] for f in pl if f['properties']['kind']=='settlement' and f['properties']['id'] in wd}|{f['properties']['qid'] for f in an if f['properties'].get('qid')})
links={};p31={}
for i in range(0,len(qs),300):
    v=' '.join('wd:'+q for q in qs[i:i+300])
    for b in run(f'SELECT ?i ?n ?c WHERE {{ VALUES ?i {{ {v} }} ?i wikibase:sitelinks ?n . OPTIONAL {{ ?i wdt:P31 ?c }} }}'):
        links[qid(b,'i')]=int(b['n']['value'])
        if 'c' in b: p31.setdefault(qid(b,'i'),set()).add(qid(b,'c'))
    time.sleep(2)
lab=json.load(open(f'{S}/wave/classes.json'))
miss=sorted({c for cs in p31.values() for c in cs}-set(lab))
for i in range(0,len(miss),300):
    v=' '.join('wd:'+q for q in miss[i:i+300])
    for b in run(f'SELECT ?c ?l WHERE {{ VALUES ?c {{ {v} }} ?c rdfs:label ?l FILTER(LANG(?l)="en") }}'): lab[qid(b,'c')]=b['l']['value']
json.dump(lab,open(f'{S}/wave/classes.json','w'),ensure_ascii=False)
out={}
for q,n in links.items():
    cls={lab.get(c,c) for c in p31.get(q,())}
    if cls&ANC and not any(MOD.search(k) for k in cls if k not in ANC): out[q]=n
json.dump({'_source':'Wikipedia articles (sitelinks) of the Wikidata items (CC0) of the places on the map that are ancient sites, not modern towns; 2026-11-01. Written by pipeline/ancient/fame.py.','items':dict(sorted(out.items()))},open(f'{R}/content/fame.json','w'),indent=0)
print(len(qs),len(links),len(out))
