import json,csv,gzip,sys,collections,re
csv.field_size_limit(10**9)
S=sys.argv[1]
# Pleiades periods, astronomical years (approximate bounds of their vocabulary). Later than
# 1300 or modern: ignored (the map ends there, and a modern name is not an ancient life).
P={'neolithic-eastern-med':(-9999,-3501),'archaic':(-749,-550),'classical':(-549,-330),'hellenistic-republican':(-329,-30),
'roman':(-29,300),'late-antique':(301,640),'mediaeval-byzantine':(641,1453),'early-byzantine':(301,640),'late-antique-late-byzantine':(301,1453),
'roman-early-empire-late-antique':(-29,640),'hellenistic-roman-early-empire':(-329,300),'2nd-millenium-bce':(-1999,-1000),'3rd-millennium-bc':(-2999,-2000),
'1st-millennium-bce':(-999,0),'neo-assyrian-babylonian-middle-east':(-911,-539),'new-kingdom-egypt':(-1549,-1069),'first-bce':(-99,0),'third-bce':(-299,-200),
'early-bronze-age-southern-levant':(-3299,-2000),'akkadian-ur-iii-mesopotamia':(-2349,-2003),'old-babylonian-assyrian-mesopotamia':(-2002,-1595),
'iron-age-southern-levant':(-1199,-586),'hellenistic-middle-east':(-331,-30),'1200-bc-middle-east':(-1199,-1000),'early-iron-age-anatolia':(-1199,-800),
'middle-late-iron-age-anatolia':(-799,-550),'abassid-middle-east':(750,1258),'ilkhanate-middle-east':(1256,1335),'first-ce':(1,100),'second-ce':(101,200),
'third-ce':(201,300),'fourth-ce':(301,400),'fifth-ce':(401,500),'sixth-ce':(501,600),'seventh-ce':(601,700),'second-bce':(-199,-100),'fourth-bce':(-399,-300),
'fifth-bce':(-499,-400),'sixth-bce':(-599,-500),'seventh-bce':(-699,-600),'eighth-bce':(-799,-700),'chalcolithic-eastern-med':(-4500,-3301),
'bronze-age':(-3299,-1200),'iron-age':(-1199,-550),'umayyad-middle-east':(661,750),'early-islamic-middle-east':(633,750),'fatimid-middle-east':(909,1171),
'ayyubid-mamluk-middle-east':(1171,1517),'crusader-middle-east':(1099,1291),'mediaeval':(641,1453),'roman-middle-east':(-29,300),'late-antiquity-in-central-asia':(301,640),'4th-millenium-bce':(-3999,-3000),
'late-bronze-age-anatolia':(-1599,-1200),'bronze-age-malta':(-2499,-700),'transition-roman-early-empire-late-antique':(201,400),
'late-bronze-age-southern-levant':(-1549,-1200),'crusader-seljuq-ayyubid-levant':(1099,1291),'late-helladic':(-1599,-1100),'late-minoan':(-1599,-1100),
'early-geometric':(-899,-850),'early-dynastic-mesopotamia':(-2899,-2350),'middle-bronze-age-anatolia':(-1999,-1600),
'roman-early-empire-parthian-middle-east':(-29,224),'late-antique-sasanian-middle-east':(225,651),'mongol-middle-east':(1256,1335),'achaemenid-middle-east':(-549,-330),'kangju-yuezhi-kushan-central-asia':(-199,375),'1st-millennium-ce':(1,1000),
'transition-early-middle-bronze-age-southern-levant':(-2199,-2000),'middle-bronze-age-southern-levant':(-1999,-1550),'2nd-millennium-bc-levant':(-1999,-1000),
'egyptian-hittite-levant':(-1549,-1200),'roman-early-byzantine-middle-east':(-29,640),'third-intermediate-period-egypt':(-1068,-663),'late-period-egypt':(-663,-331),
'later-2nd-millennium-bc-mesopotamia':(-1594,-1000),'proto-byzantine':(301,640),'middle-byzantine':(641,1204),'crusader-byzantine-seljuq-middle-east':(1071,1291),
'middle-geometric':(-849,-760),'ninth-ce':(801,900),'tenth-ce':(901,1000),'early-minoan':(-3099,-2100),'middleminoan':(-2099,-1600),
'neo-babylonian-achaemenid-southern-levant':(-585,-330),'middle-kingdom-egypt':(-2054,-1650),'second-intermediate-period-egypt':(-1649,-1550),
'late-byzantine':(1205,1453),'thirteenth-ce':(1201,1300),'achaemenid-central-asia':(-549,-330),'hellenistic-central-asia':(-329,-30),
'pre-islamic-early-middle-ages-central-asia':(301,750),'neo-hittite-northern-levant':(-1179,-700),'early-1st-millennium-mesopotamia':(-999,-612),
'achaemenid-roman-republic-middle-east':(-549,-30),'calcolithic-eurasian-cenieh':(-4500,-3301),
'early-bronze-age-anatolia':(-2999,-2000),'copy_of_middle-bronze-age-anatolia':(-1999,-1600),'middle-hittite-anatolia':(-1499,-1400),'tenth-bce':(-999,-900),'ninth-bce':(-899,-800),
'eighth-ce':(701,800),'ptolemaic-egypt':(-331,-30),'ptolemaic-roman-egypt':(-331,300),'old-kingdom-egypt':(-2685,-2180),'2nd-millennium-bc-egypt':(-1999,-1000),
'early-helladic':(-3199,-2000),'middle-helladic':(-1999,-1600),'caliphate-umayyad-middle-east':(661,750),'ummayad':(661,750),'rum-crusader-anatolia':(1077,1300),
'seljuq-khwarezmian-middle-east':(1037,1231),'khwarezmian-middle-east':(1077,1231),'early-medieval-caucasus':(641,1000),'samanid-ghaznavid-iran':(819,1186),'bronze-eurasian-cenieh':(-3299,-1200)}
LATE=('modern','twentieth','twenty-first','nineteenth','eighteenth','seventeenth','sixteenth','fifteenth','ottoman','khedivate','mandate','safavid','qajar','pahlavi','fourteenth','1500-ad','thirteenth-ce-ottoman','early-ottoman','late-ottoman')
YMIN,YMAX=-3500,1300
ids={s['id']:s for s in json.load(open(f'{S}/wave/wave.json'))}
wd=json.load(open(f'{S}/wave/wd.json'))
unk=collections.Counter(); keep=[]; drop=collections.Counter()
for r in csv.DictReader(gzip.open(f'{S}/pleiades-dl/places.csv.gz','rt')):
    s=ids.get(r['id'])
    if not s: continue
    spans=[]
    for p in (x.strip() for x in r['timePeriodsKeys'].split(',')):
        if not p or p.startswith(LATE) or 'modern' in p: continue
        if p in P: spans.append(P[p])
        else: unk[p]+=1
    if not spans: drop['no ancient period']+=1; continue
    a=max(min(x for x,_ in spans),YMIN); b=min(max(y for _,y in spans),YMAX)
    if b<YMIN or a>=b: drop['outside the map']+=1; continue
    # Wikidata's founding or end, where it narrows the span: a site destroyed in the middle
    # of a period (Glanum, 260) ends then, not at the period's end; an earlier founding is
    # left out (often the district's, not the town's). An end up to 250 years past the last
    # period is taken too, where Pleiades has not recorded the town's last years (Kamarina,
    # burned by the Arabs in 853; five sites in the waves, checked 2026-11-04).
    d=wd.get(s['qid'],{})
    # The query service writes a year before Christ held to the year as an astronomical year
    # already (753 BC is -0752, as the map counts), but one held to a century as written
    # (the 5th century BC is -0500): that one is moved, the other taken as it is.
    def yr(t):
        m=re.match(r'([+-]?\d+)-[^|]*(?:\|(\d+))?',t)
        if not m: return None
        y=int(m.group(1))
        return y+1 if y<0 and m.group(2) and int(m.group(2))<9 else y
    f0=max([y for t in d.get('P571',[]) if (y:=yr(t)) is not None],default=None)
    e0=min([y for t in d.get('P576',[]) if (y:=yr(t)) is not None],default=None)
    if f0 is not None and a<f0<b: a=f0
    if e0 is not None and a<e0<=min(b+250,YMAX): b=e0
    s['from_'],s['to']=a,b
    s['periods']=r['timePeriodsKeys']
    keep.append(s)
json.dump(keep,open(f'{S}/wave/wave.json','w'),ensure_ascii=False)
print(len(keep),dict(drop),'unknown periods:',unk.most_common(60))
print(collections.Counter((s['from_'],s['to']) for s in keep).most_common(8))
print([(s['en'],s['from_'],s['to']) for s in keep if s['en'] in ('Göbekli Tepe','Çatalhöyük','Sicyon','Knidos','Opis','Abu Mena','Mystras','Malgium','Tel Shikmona','Epidaurus')])
