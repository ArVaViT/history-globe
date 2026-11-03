# The sites' points against Wikidata's (P625): those more than 5 km apart, farthest first.
# Most are Wikidata's rough points or a disputed site; the rest are a wrong pairing of
# Pleiades and Wikidata (Lycian Korykos as the Cilician city) or a wrong point, fixed by hand.
# python3 pipeline/ancient/coords.py <repo>
import json,glob,re,math,time,urllib.request,urllib.parse,sys
R=sys.argv[1]
def km(a,b):
  la1,la2=math.radians(a[1]),math.radians(b[1]);dl=math.radians(b[0]-a[0]);dp=la2-la1
  return 2*6371*math.asin(math.sqrt(math.sin(dp/2)**2+math.cos(la1)*math.cos(la2)*math.sin(dl/2)**2))
S=[s for f in sorted(glob.glob(f'{R}/content/ancient-sites*.json')) for s in json.load(open(f))['sites']]
qid=lambda s:next((m.group(1) for u in s['sources'] if (m:=re.search(r'wikidata\.org/wiki/(Q\d+)$',u))),None)
by={}
for s in S:
  q=qid(s)
  if q: by.setdefault(q,[]).append(s)
qs=sorted(by)
def run(q):
  req=urllib.request.Request('https://query.wikidata.org/sparql',data=urllib.parse.urlencode({'query':q}).encode(),headers={'Accept':'application/sparql-results+json','User-Agent':'HistoryGlobeBot/1.0 (https://historyglobe.app; historyglobe.vadym@gmail.com)'})
  for i in range(5):
    try: return json.load(urllib.request.urlopen(req,timeout=120))['results']['bindings']
    except Exception: time.sleep(15*(i+1))
  raise SystemExit('wikidata failed')
wd={}
for i in range(0,len(qs),300):
  v=' '.join('wd:'+q for q in qs[i:i+300])
  for b in run(f'SELECT ?i ?c WHERE {{ VALUES ?i {{ {v} }} ?i wdt:P625 ?c }}'):
    m=re.match(r'Point\(([-\d.eE]+) ([-\d.eE]+)\)',b['c']['value'])
    if m: wd.setdefault(b['i']['value'].rsplit('/',1)[1],[]).append((float(m.group(1)),float(m.group(2))))
  time.sleep(2)
out=[]
for q,ss in by.items():
  for s in ss:
    if q in wd:
      d=min(km((s['lon'],s['lat']),c) for c in wd[q])
      if d>5: out.append((round(d,1),s['id'],s['en'],q,(s['lon'],s['lat']),wd[q][0]))
out.sort(reverse=True)
print(len(S),'sites,',len(wd),'with P625,',len(out),'differ >5 km')
for o in out: print(*o)
