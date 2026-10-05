# Media Port — veb-sayt

Toshkent xalqaro aeroporti, Korzinka, HoReCa va hududlardagi ekranlarda reklama joylari uchun 3D interaktiv sayt.

- Stek: Vite + Three.js + GSAP + Lenis
- Tillar: uz, ru, en, ar (RTL), zh, tr, fr, it, ko
- Kunduzgi va tungi xarita, xaritani o'rganish rejimi, media-plan kalkulyatori

## Ishga tushirish

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm run build    # dist/ ga statik build
```

## Ma'lumot manbalari

- Relyef: Mapzen Terrain Tiles (AWS Open Data)
- Chegaralar, daryolar: Natural Earth
- Yo'llar, Korzinka va HoReCa joylari, aeroport rejasi: © OpenStreetMap hissadorlari (ODbL)
- Shahar suratlari: Wikimedia Commons, mualliflar `src/data/photo-credits.js` da va har bir suratda ko'rsatilgan
- Ma'lumotlarni qayta tayyorlash: `scripts/data/README.md`
