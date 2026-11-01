import csv,gzip,json,math,sys
csv.field_size_limit(10**9)
S=sys.argv[1]; R=sys.argv[2]
fame={}
for r in csv.DictReader(open(f'{S}/wd/pleiades-sitelinks.csv')):
    pid=r['pid'];q=r['item'].rsplit('/',1)[1];n=int(r['links'])
    if n>fame.get(pid,(None,-1))[1]: fame[pid]=(q,n)
inF=lambda lo,la:((lo-28)/40.5)**2+((la-32)/19.5)**2<=1
def km(a,b):
    x=(b[0]-a[0])*math.pi/180*math.cos((a[1]+b[1])/2*math.pi/180); y=(b[1]-a[1])*math.pi/180
    return math.hypot(x,y)*6371
ours=[f['geometry']['coordinates'] for f in json.load(open(f'{R}/apps/web/public/data/places.geojson'))['features'] if f['properties']['kind']=='settlement']
anc=json.load(open(f'{R}/content/ancient-sites.json'))['sites']
have={s['id'] for s in anc}; ours+= [[s['lon'],s['lat']] for s in anc]
plinks={v['id'] for v in json.load(open(f'{R}/content/pleiades.json'))['places'].values()}
grid={}
for c in ours: grid.setdefault((int(c[0]*10),int(c[1]*10)),[]).append(c)
def near(c):
    gx,gy=int(c[0]*10),int(c[1]*10)
    return any(km(c,o)<3 for dx in (-1,0,1) for dy in (-1,0,1) for o in grid.get((gx+dx,gy+dy),[]))
KEEP={'settlement','sanctuary','temple-2','port','temple'}
out=[]
for r in csv.DictReader(gzip.open(f'{S}/pleiades-dl/places.csv.gz','rt')):
    try: lat=float(r['reprLat']);lon=float(r['reprLong'])
    except: continue
    if r['locationPrecision']!='precise' or not inF(lon,lat) or r['id'] not in fame: continue
    if r['id'] in have or r['id'] in plinks: continue
    types={t.strip() for t in r['featureTypes'].split(',')}
    if not types & KEEP: continue
    if near([lon,lat]): continue
    q,n=fame[r['id']]
    out.append(dict(pid=r['id'],qid=q,fame=n,title=r['title'],types=sorted(types),lon=round(lon,5),lat=round(lat,5),min=r['minDate'],max=r['maxDate'],periods=r['timePeriodsKeys']))
out.sort(key=lambda x:-x['fame'])
json.dump(out,open(f'{S}/wave/candidates.json','w'),ensure_ascii=False)
for th in (8,10,12,15,20): print(th,sum(1 for x in out if x['fame']>=th))
print([ (x['title'],x['fame']) for x in out[:25]])
