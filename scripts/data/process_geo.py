import json, math, numpy as np, os
from PIL import Image
from shapely.geometry import shape, Polygon, MultiPolygon, LineString, MultiLineString, Point, box, mapping
from shapely.ops import unary_union
ROOT="/Users/macbook/Desktop/Workspace/Airport - Media Port website"
LON0,LON1,LAT0,LAT1=55.6,73.6,36.8,45.9
BB=box(LON0,LAT0,LON1,LAT1)
# ---------- DEM ----------
tiles=[l.split() for l in open('tiles.txt')]
z=7; xs=sorted({int(t[1]) for t in tiles}); ys=sorted({int(t[2]) for t in tiles})
mos=np.zeros(((ys[-1]-ys[0]+1)*256,(xs[-1]-xs[0]+1)*256),np.float32)
for _,x,y in tiles:
    x=int(x);y=int(y)
    a=np.asarray(Image.open(f'dem/7_{x}_{y}.png').convert('RGB'),np.float32)
    h=a[...,0]*256+a[...,1]+a[...,2]/256-32768
    mos[(y-ys[0])*256:(y-ys[0]+1)*256,(x-xs[0])*256:(x-xs[0]+1)*256]=h
n=2**z
def merc(lon,lat):
    X=(lon+180)/360*n*256-xs[0]*256
    r=np.radians(lat); Y=(1-np.log(np.tan(r)+1/np.cos(r))/np.pi)/2*n*256-ys[0]*256
    return X,Y
def bilinear(img,X,Y):
    x0=np.floor(X).astype(int); y0=np.floor(Y).astype(int); fx=X-x0; fy=Y-y0
    x0=np.clip(x0,0,img.shape[1]-2); y0=np.clip(y0,0,img.shape[0]-2)
    return (img[y0,x0]*(1-fx)*(1-fy)+img[y0,x0+1]*fx*(1-fy)+img[y0+1,x0]*(1-fx)*fy+img[y0+1,x0+1]*fx*fy)
def blur(a,s):
    r=int(s*3); k=np.exp(-np.arange(-r,r+1)**2/(2*s*s)); k/=k.sum()
    p=np.pad(a,((0,0),(r,r)),mode='edge'); a=sum(k[i]*p[:,i:i+a.shape[1]] for i in range(2*r+1))
    p=np.pad(a,((r,r),(0,0)),mode='edge'); a=sum(k[i]*p[i:i+a.shape[0],:] for i in range(2*r+1))
    return a
meta={}
for W in ():
    H=int(round(W*(LAT1-LAT0)/(LON1-LON0)/math.cos(math.radians((LAT0+LAT1)/2))))
    lon=LON0+(np.arange(W)+0.5)/W*(LON1-LON0); lat=LAT1-(np.arange(H)+0.5)/H*(LAT1-LAT0)
    LON,LAT=np.meshgrid(lon,lat); X,Y=merc(LON,LAT)
    h=bilinear(mos,X,Y); h=blur(h,1.1 if W==1600 else 0.8)
    v=np.clip((h+200)*8,0,65535).astype('<u2')
    v.tofile(f'{ROOT}/public/data/dem-{W}.bin')
    meta[str(W)]={"w":W,"h":H}
    print('dem',W,H,float(h.min()),float(h.max()))
# ---------- borders ----------
topo=json.load(open('countries-10m.json'))
sc=topo['transform']['scale']; tr=topo['transform']['translate']
arcs=[]
for arc in topo['arcs']:
    x=y=0; pts=[]
    for dx,dy in arc:
        x+=dx;y+=dy; pts.append((x*sc[0]+tr[0],y*sc[1]+tr[1]))
    arcs.append(pts)
def ring(idx):
    pts=[]
    for i in idx:
        a=arcs[i] if i>=0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    return pts
geoms={}
for g in topo['objects']['countries']['geometries']:
    gid=str(g.get('id'))
    if gid not in ('860','398','417','762','795','004'): continue
    if g['type']=='Polygon': polys=[Polygon(ring(g['arcs'][0]),[ring(r) for r in g['arcs'][1:]])]
    elif g['type']=='MultiPolygon': polys=[Polygon(ring(p[0]),[ring(r) for r in p[1:] if len(ring(r))>=4]) for p in g['arcs'] if len(ring(p[0]))>=4]
    else: continue
    geoms[gid]=(g.get('properties',{}).get('name'),MultiPolygon(polys))
uz=geoms['860'][1]
def coords_of(geom,tol):
    geom=geom.simplify(tol,preserve_topology=True).intersection(BB)
    out=[]
    gs=getattr(geom,'geoms',[geom])
    for gg in gs:
        if gg.is_empty: continue
        if gg.geom_type=='Polygon':
            out.append([[round(x,4),round(y,4)] for x,y in gg.exterior.coords])
            for r in gg.interiors: out.append([[round(x,4),round(y,4)] for x,y in r.coords])
        elif gg.geom_type in ('LineString','LinearRing'):
            out.append([[round(x,4),round(y,4)] for x,y in gg.coords])
        elif hasattr(gg,'geoms'):
            for ggg in gg.geoms:
                if ggg.geom_type=='LineString': out.append([[round(x,4),round(y,4)] for x,y in ggg.coords])
    return out
vec={"bbox":[LON0,LAT0,LON1,LAT1],"uz":coords_of(uz,0.003),"neighbors":[]}
for gid in ('398','417','762','795','004'):
    vec['neighbors']+=coords_of(geoms[gid][1].boundary,0.01)
# ---------- rivers & lakes ----------
rv=json.load(open('rivers.geojson'))
vec['rivers']=[]
for f in rv['features']:
    g=shape(f['geometry'])
    if not g.intersects(BB): continue
    if (f['properties'].get('scalerank') or 9)>9: continue
    vec['rivers']+=coords_of(g,0.006)
lk=json.load(open('lakes.geojson'))
vec['lakes']=[]
for f in lk['features']:
    g=shape(f['geometry'])
    if not g.intersects(BB) or g.area<0.002: continue
    vec['lakes']+=coords_of(g,0.004)
json.dump(vec,open(f'{ROOT}/public/data/vectors.json','w'),separators=(',',':'))
print('vectors', len(vec['uz']), len(vec['neighbors']), len(vec['rivers']), len(vec['lakes']), os.path.getsize(f'{ROOT}/public/data/vectors.json'))
# ---------- places ----------
cities=json.load(open('places.json'))['elements']
want={'Tashkent':'toshkent','Samarkand':'samarqand','Bukhara':'buxoro','Fergana':'fargona','Andijan':'andijon','Namangan':'namangan','Kokand':'qoqon','Margilan':'margilon','Asaka':'asaka','Jizzakh':'jizzax','Karshi':'qarshi','Navoiy':'navoiy','Gulistan':'guliston'}
city={}
for e in cities:
    n=e['tags'].get('name:en')
    if n in want and want[n] not in city: city[want[n]]=[round(e['lon'],5),round(e['lat'],5)]
tr=json.load(open('tregion.json'))['elements']
for e in tr:
    if e['tags'].get('name')=='Nurafshon': city['nurafshon']=[round(e['lon'],5),round(e['lat'],5)]
    if e['tags'].get('name')=='Chirchiq': city['chirchiq']=[round(e['lon'],5),round(e['lat'],5)]
k=json.load(open('korzinka.json'))['elements']
kor=[]
for e in k:
    c=e.get('center',e); p=Point(c['lon'],c['lat'])
    if uz.contains(p): kor.append([round(c['lon'],5),round(c['lat'],5)])
kor=sorted(set(map(tuple,kor)))
hm=json.load(open('horeca_matched.json'))
keep={"\"Rayhon\" oilaviy taomlari - Qatortol filiali","Rayhon (Qoratosh)","Rayhon","RAYHON milliy taomlar","Xon Atlas","ресторан «Marvarid»","Nomdor","SOY","Sardoba","Bogi zilol","Bek Osiyo","Madina Milliy taomlari","Labi Hovuz","Mazali Makon (Ikki panja)","Олтин жужа","Plov City","Qaldirg'och","Daryo by Bursa","Uzbegim milliy taomlari"}
hor=[]
for e in hm:
    nm=e['tags'].get('name')
    if nm in keep or (nm=='Anor' and abs(e.get('center',e)['lat']-41.2935)<0.001) or (nm=='Файз' and abs(e.get('center',e)['lat']-41.2317)<0.001):
        c=e.get('center',e); hor.append({"n":nm.replace('ресторан ','').replace('«','').replace('»','').replace('"',''),"p":[round(c['lon'],5),round(c['lat'],5)]})
ap=json.load(open('airport.json'))['elements']; ap2=json.load(open('airport2.json'))['elements']
air={"terminals":[],"runways":[],"taxiways":[],"aprons":[],"hangars":[]}
for e in ap+ap2:
    t=e['tags']; g=[[round(p['lon'],6),round(p['lat'],6)] for p in e.get('geometry',[])]
    if not g: continue
    if t.get('aeroway')=='terminal':
        nm=t.get('name','')
        tid='T2' if 'Tashkent-2' in nm else 'T3' if 'Tashkent-3' in nm else 'T1'
        air['terminals'].append({"id":tid,"name":nm,"g":g})
    elif t.get('aeroway')=='runway': air['runways'].append({"ref":t.get('ref'),"g":g,"w":float(t.get('width','60') or 60)})
    elif t.get('aeroway')=='taxiway': air['taxiways'].append(g)
    elif t.get('aeroway')=='apron': air['aprons'].append(g)
    elif t.get('building')=='hangar': air['hangars'].append(g)
places={"source":"OpenStreetMap contributors (ODbL), fetched 2026-10-05","airport":{"iata":"TAS","icao":"UZTT","p":[69.2812,41.2579]},"cities":city,"korzinka":kor,"horeca":hor,"airportPlan":air}
json.dump(places,open(f'{ROOT}/public/data/places.json','w'),ensure_ascii=False,separators=(',',':'))
meta={"1600":{"w":1600,"h":1078},"800":{"w":800,"h":539}}
json.dump({"bbox":[LON0,LAT0,LON1,LAT1],"dem":meta,"enc":"uint16le (h+200)*8"},open(f'{ROOT}/public/data/meta.json','w'))
print('cities',city); print('korzinka in UZ',len(kor)); print('horeca',len(hor),[h['n'] for h in hor]); print({k:len(v) for k,v in air.items()})
