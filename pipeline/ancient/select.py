import json,math,os,re,sys,collections
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
from classes import ANC,MOD
S=sys.argv[1]
c=json.load(open(f'{S}/wave/candidates.json')); w=json.load(open(f'{S}/wave/wd.json')); lab=json.load(open(f'{S}/wave/classes.json'))
SANCT={'sanctuary','temple-2','temple'}
YMIN,YMAX=-3500,1300
def yr(t):
    m=re.match(r'([+-]?\d+)-',t or '')
    return int(m.group(1)) if m else None
out=[];why=collections.Counter()
for x in c:
    if x['fame']<int(os.environ.get('FAME',8)): continue
    d=w.get(x['qid'],{}); cls={lab.get(k,k) for k in d.get('p31',[])}
    if not cls & ANC: why['not ancient']+=1; continue
    if any(MOD.search(k) for k in cls if k not in ANC): why['modern too']+=1; continue
    try: a=int(float(x['min'])); b=int(float(x['max']))
    except: why['no years']+=1; continue
    # Pleiades years are calendar (-750 = 750 BC); the map's are astronomical.
    a=a+1 if a<0 else a; b=b+1 if b<0 else b
    a=max(a,YMIN); b=min(b,YMAX)
    if a>=b: why['bad years']+=1; continue
    L=d.get('labels',{}); en=L.get('en') or x['title']
    en=re.sub(r'^(the )?(archaeological site of|ancient city of|site of)\s+','',en,flags=re.I).strip()
    en=en[0].upper()+en[1:]
    if re.search(r'\d|\(|archaeolog',en,re.I): why['odd name']+=1; continue
    types=set(x['types'])
    kind='sanctuary' if types&SANCT and 'settlement' not in types or cls&{'Egyptian temple','ancient Greek temple','hieron','temple','Roman temple','Heraion','oracle','sanctuary','Etruscan temple','Asclepeion','Necromanteion','Romano-Celtic temple','mithraeum'} else 'port' if 'port' in types or cls&{'ancient port'} else 'city' if 'settlement' in types else 'site'
    wd=[yr(t) for t in d.get('P571',[])]
    out.append(dict(id=x['pid'],en=en,names={k:v for k,v in L.items() if k!='en'},lon=x['lon'],lat=x['lat'],from_=a,to=b,approx=True,kind=kind,fame=x['fame'],qid=x['qid'],wd_from=min([v for v in wd if v is not None],default=None)))
# one per 3 km: the better known
def km(p,q):
    return math.hypot((q['lon']-p['lon'])*math.cos(math.radians((p['lat']+q['lat'])/2)),q['lat']-p['lat'])*111.2
kept=[]
for s in sorted(out,key=lambda s:-s['fame']):
    if any(km(s,k)<3 for k in kept): why['near another']+=1; continue
    kept.append(s)
json.dump(kept,open(f'{S}/wave/wave.json','w'),ensure_ascii=False)
print(len(kept),dict(why)); print(collections.Counter(s['kind'] for s in kept))
print('ru',sum('ru' in s['names'] for s in kept),'fame>=45',sum(s['fame']>=45 for s in kept))
print(', '.join(f"{s['en']}({s['fame']})" for s in kept[:40]))
