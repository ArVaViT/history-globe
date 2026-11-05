import json,os,sys,time,urllib.request,urllib.parse
S=sys.argv[1]
c=[x for x in json.load(open(f'{S}/wave/candidates.json')) if x['fame']>=int(os.environ.get('FAME',8))]
L=['en','ru','uk','es','pt','fr','de','it','nl','pl','cs','sv','nb','da','tl','sr','hu','fi','vi','ro','bg']
try: out=json.load(open(f'{S}/wave/wd.json'))
except FileNotFoundError: out={}
def run(q):
    req=urllib.request.Request('https://query.wikidata.org/sparql',data=urllib.parse.urlencode({'query':q}).encode(),headers={'Accept':'application/sparql-results+json','User-Agent':'HistoryGlobeBot/1.0 (https://historyglobe.app; historyglobe.vadym@gmail.com)'})
    for i in range(4):
        try: return json.load(urllib.request.urlopen(req,timeout=120))['results']['bindings']
        except Exception as e: print('retry',e,file=sys.stderr); time.sleep(20*(i+1))
    raise SystemExit('wikidata failed')
# Items cached before the dates carried their precision ("time|precision") are fetched again.
stale=lambda d:any('|' not in v for k in ('P571','P576') for v in d.get(k,[]))
for q in [q for q,d in out.items() if stale(d)]: del out[q]
qs=sorted({x['qid'] for x in c}-set(out))
for i in range(0,len(qs),200):
    v=' '.join('wd:'+q for q in qs[i:i+200])
    for b in run(f'SELECT ?i ?c WHERE {{ VALUES ?i {{ {v} }} ?i wdt:P31 ?c }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault('p31',[]).append(b['c']['value'].rsplit('/',1)[1])
    for b in run(f'SELECT ?i ?l WHERE {{ VALUES ?i {{ {v} }} ?i rdfs:label ?l FILTER(LANG(?l) IN ({",".join(repr(x) for x in L)})) }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault('labels',{})[b['l']['xml:lang']]=b['l']['value']
    # Founding and end with their precision (9 a year, 7 a century): "time|precision"; the
    # best-ranked statements only, as wdt: gives them.
    for b in run(f'SELECT ?i ?p ?t ?pr WHERE {{ VALUES ?i {{ {v} }} VALUES (?p ?ps) {{ (wd:P571 psv:P571) (wd:P576 psv:P576) }} ?p wikibase:claim ?st . ?i ?st ?s . ?s a wikibase:BestRank ; ?ps ?n . ?n wikibase:timeValue ?t ; wikibase:timePrecision ?pr }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault(b['p']['value'].rsplit('/',1)[1],[]).append(f"{b['t']['value']}|{b['pr']['value']}")
    time.sleep(2)
json.dump(out,open(f'{S}/wave/wd.json','w'),ensure_ascii=False)
print(len(qs),len(out))
