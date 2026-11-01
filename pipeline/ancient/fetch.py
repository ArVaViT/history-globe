import json,sys,time,urllib.request,urllib.parse
S=sys.argv[1]
c=[x for x in json.load(open(f'{S}/wave/candidates.json')) if x['fame']>=8]
L=['en','ru','uk','es','pt','fr','de','it','nl','pl','cs','sv','nb','da','tl','sr','hu','fi','vi','ro','bg']
out={}
def run(q):
    req=urllib.request.Request('https://query.wikidata.org/sparql',data=urllib.parse.urlencode({'query':q}).encode(),headers={'Accept':'application/sparql-results+json','User-Agent':'HistoryGlobeBot/1.0 (https://historyglobe.app; historyglobe.vadym@gmail.com)'})
    for i in range(4):
        try: return json.load(urllib.request.urlopen(req,timeout=120))['results']['bindings']
        except Exception as e: print('retry',e,file=sys.stderr); time.sleep(20*(i+1))
    raise SystemExit('wikidata failed')
qs=sorted({x['qid'] for x in c})
for i in range(0,len(qs),200):
    v=' '.join('wd:'+q for q in qs[i:i+200])
    for b in run(f'SELECT ?i ?c WHERE {{ VALUES ?i {{ {v} }} ?i wdt:P31 ?c }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault('p31',[]).append(b['c']['value'].rsplit('/',1)[1])
    for b in run(f'SELECT ?i ?l WHERE {{ VALUES ?i {{ {v} }} ?i rdfs:label ?l FILTER(LANG(?l) IN ({",".join(repr(x) for x in L)})) }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault('labels',{})[b['l']['xml:lang']]=b['l']['value']
    for b in run(f'SELECT ?i ?p ?t WHERE {{ VALUES ?i {{ {v} }} VALUES ?p {{ wdt:P571 wdt:P576 }} ?i ?p ?t }}'):
        out.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault(b['p']['value'].rsplit('/',1)[1],[]).append(b['t']['value'])
    time.sleep(2)
json.dump(out,open(f'{S}/wave/wd.json','w'),ensure_ascii=False)
print(len(qs),len(out))
