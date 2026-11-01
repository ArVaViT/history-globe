import json,re,sys,csv,gzip,time,urllib.request,urllib.parse
csv.field_size_limit(10**9)
S,R=sys.argv[1],sys.argv[2]
exec(open(f'{S}/wave/periods.py').read().split('YMIN,YMAX')[0])  # P, LATE
cur=json.load(open(f'{R}/content/ancient-sites.json'))['sites']
qid=lambda s:next((m.group(1) for u in s['sources'] if (m:=re.search(r'wikidata\.org/wiki/(Q\d+)$',u))),None)
qs=sorted({q for s in cur if (q:=qid(s))})
def run(q):
    req=urllib.request.Request('https://query.wikidata.org/sparql',data=urllib.parse.urlencode({'query':q}).encode(),headers={'Accept':'application/sparql-results+json','User-Agent':'HistoryGlobeBot/1.0 (https://historyglobe.app; historyglobe.vadym@gmail.com)'})
    for i in range(5):
        try: return json.load(urllib.request.urlopen(req,timeout=120))['results']['bindings']
        except Exception as e: time.sleep(20*(i+1))
    raise SystemExit('wikidata failed')
wd={}
for i in range(0,len(qs),250):
    v=' '.join('wd:'+q for q in qs[i:i+250])
    for b in run(f'SELECT ?i ?p ?t WHERE {{ VALUES ?i {{ {v} }} VALUES ?p {{ wdt:P571 wdt:P576 wdt:P582 wdt:P580 }} ?i ?p ?t }}'):
        m=re.match(r'([+-]?\d+)-',b['t']['value'])
        if m:
            y=int(m.group(1)); y=y+1 if y<0 else y
            wd.setdefault(b['i']['value'].rsplit('/',1)[1],{}).setdefault(b['p']['value'].rsplit('/',1)[1],[]).append(y)
    time.sleep(2)
per={}
ids={s['id'] for s in cur}
for r in csv.DictReader(gzip.open(f'{S}/pleiades-dl/places.csv.gz','rt')):
    if r['id'] in ids:
        sp=[P[p.strip()] for p in r['timePeriodsKeys'].split(',') if p.strip() in P and not p.strip().startswith(LATE)]
        if sp: per[r['id']]=(min(a for a,_ in sp),max(b for _,b in sp))
flags=[]
for s in cur:
    w=wd.get(qid(s) or '',{}); p=per.get(s['id'])
    end=min(w.get('P576',[])+w.get('P582',[]),default=None); beg=min(w.get('P571',[])+w.get('P580',[]),default=None)
    why=[]
    if end is not None and s['to']>end+150 and s['to']<1300: why.append(f'wd end {end}')
    if end is not None and s['to']>=1300 and end<1150: why.append(f'wd end {end}')
    if beg is not None and abs(s['from']-beg)>400: why.append(f'wd start {beg}')
    if p and s['to']>p[1]+400: why.append(f'pleiades last {p[1]}')
    if p and s['from']<p[0]-800: why.append(f'pleiades first {p[0]}')
    if why: flags.append((s['id'],s['en'],s['from'],s['to'],'; '.join(why)))
json.dump(flags,open(f'{S}/wave/audit.json','w'),ensure_ascii=False)
print(len(cur),len(flags))
for f in flags: print(*f,sep=' | ')
