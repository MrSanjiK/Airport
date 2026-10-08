// Every figure below is copied from the commercial-offer PDFs in the project root.
// Prices: million sum per month, excluding VAT, for a 3 / 6 / 12-month contract.

export const AIRPORT = {
  iata: 'TAS',
  icao: 'UZTT',
  coords: [69.2812, 41.2579],
  visitsDay: 50000,
  visitsMonth: 1500000,
  visitsYear: 18000000,
  areaK: 105, // thousand m²
  halls: 20,
  flightsDay: 100,
  men: 68,
  women: 32,
  citizens: 80,
  foreigners: 20,
  arrive2h: 53, // JCDecaux
  intlBrand: 69, // JCDecaux
  airlines: ['Uzbekistan Airways', 'Turkish Airlines', 'Qatar Airways', 'Etihad Airways', 'Korean Air', 'Aeroflot'],
};

// LED zones. `terminal` + `spot` place the schematic marker on the real OSM terminal footprint.
export const LED_ZONES = [
  { id: 'filter', screens: 1, size: '1024×288', res: '2560×720', price: [80, 60, 45], img: 'air-filter', terminal: 'DEP', spot: [0.5, 0.18] },
  { id: 'dep1', screens: 1, size: '2560×224', res: '10112×786', price: [100, 80, 60], img: 'air-departure-1', terminal: 'DEP', spot: [0.34, 0.38] },
  { id: 'dep2', screens: 1, size: '1504×178', res: '4096×512', price: [90, 70, 50], img: 'air-departure-2', terminal: 'DEP', spot: [0.66, 0.42] },
  { id: 'dutyfree', screens: 1, size: '256×448', res: '640×1120', price: [40, 30, 20], img: 'air-dutyfree', terminal: 'DEP', spot: [0.56, 0.74] },
  { id: 'arr32', screens: 32, size: '512×176', res: '1920×704', price: [500, 400, 300], img: 'air-arrival-32', terminal: 'ARR', spot: [0.5, 0.55], hit: true },
  { id: 'cipdep', screens: 1, size: '512×256', res: '1920×1080', price: [80, 60, 40], img: 'air-cip-departure', terminal: 'DEP', spot: [0.16, 0.62] },
  { id: 'ciparr', screens: 2, size: '480×176', res: '1920×1080', price: [150, 125, 100], img: 'air-cip-arrival', terminal: 'ARR', spot: [0.2, 0.72], hit: true },
  { id: 'forecourt', screens: 3, size: '970×960', res: 'P2', price: [200, 175, 150], img: 'air-forecourt', terminal: 'DEP', spot: [0.56, 0.06], outdoor: true },
  { id: 't3', screens: 2, size: '1600×560', res: '6.8×2.33', price: [200, 150, 100], img: 'air-terminal3-b', terminal: 'T3', spot: [0.5, 0.5] },
  { id: 'waiting', screens: 1, size: '7.2×3.2', res: '1920×1080', price: [200, 150, 100], img: 'air-arrival-waiting', terminal: 'ARR', spot: [0.46, 0.22] },
];

export const LED_FACTS = { count: 40, pitch: 'P2', playsDay: 150, spotSec: 15, hours: '24/7' };

// Fly TV deck p6–7: 200 monitors across the airport; the deck prints "22/7" but states the monitors run round the clock.
export const AIRPORT_TV = {
  monitors: 200, diag: '85 / 75 / 65″', playsDay: 96, spotSec: 15, hours: '24/7', price: [250, 200, 150],
  zones: ['vip', 'cip', 'dep', 'arr'],
  imgs: ['tv-corridor', 'tv-gates', 'tv-checkin', 'tv-lounge', 'tv-vip', 'tv-hall'],
};

export const LIGHTBOX = {
  count: 10,
  zones: ['Filter', 'Registration 1', 'Registration 2', 'Corridor', 'Duty Free', 'B8–B10', 'Cofelito B1–B2', 'Gallery B3–B4', 'Safia B5–B7', 'Milliy B13–B14'],
  areaM2: 35,
  price: [300, 250, 200],
  imgs: ['lb-bmw', 'lb-gallery', 'lb-pillars', 'lb-stairs', 'lb-hall'],
};

export const KORZINKA = {
  stores2025: 250,
  stores2026: 500,
  venues: 300,
  receiptsDay: 900000,
  monitors: 3000,
  playsDay: '20–25',
  playsMonth: 750,
  spotSec: 20,
  visitors2025: 600000,
  visitors2026: 1500000,
  audioShare: 70,
  price: [250, 175, 150],
  imgs: ['kz-checkout', 'kz-checkout-screens', 'kz-storefront', 'kz-speaker'],
};

export const HORECA = {
  visitors: 250000,
  venues: 75,
  monitors: 1000,
  playsDay: '25–30',
  spotSec: 20,
  avgCheck: 150000,
  dwell: '50–60',
  campaigns: 1000,
  since: 2010,
  price: [150, 100, 60],
  imgs: ['hr-akfa-screens', 'hr-terrace-tv', 'hr-hall-screens', 'hr-soy', 'hr-axmad-night', 'hr-rayhon'],
  // Venue names exactly as listed in HORECA 2026.pdf
  venueList: [
    'Volidam', 'Next Food Court', 'Marvarid Milliy Taomlar', 'Rayhon Milliy Taomlar', 'Anor Milliy Taomlar', 'Mega Planet Food Court',
    'Köfteci İsmail', 'Sapfir Milliy Taomlar', 'Sardoba Milliy Taomlar', 'Toshkent Restaurant', 'Ugolok', 'Soy Milliy Taomlar',
    "Axmad Oltin Jo'ja", 'Plov City', 'Barakah', 'Tansiq Milliy Taomlar', 'Xon Atlas', 'Oshpaolov', 'Ikki Panja', 'Osh City',
    'Madina Food', "Bog'i Zilol Milliy Taomlar", 'Axa Osh', "Zo'r Osh", 'Le Taom', 'Shohona Milliy Taomlar', 'Anor Keles',
    'Tandoor Milliy Taomlar', 'Nomdor', "Qaldirg'och Oilaviy Restoran", "Ishtixon Zig'ir Osh", 'Samosh', 'Adras Milliy Taomlar',
    'Fayz Chinor', "O'zbegim", 'Bek Osiyo', 'Al-Fajr', "Ahmad Olmos Jo'ja", 'Dunyo', 'Tandir Milliy Taomlar', 'Labi Hauz',
    'Daryo', 'Fayz Sergeli', 'Fayz Milliy Taomlar', 'King Plov', 'Nurafshon Osh', 'Marhabo', 'Choy Poy',
  ],
};

// Region table, Region 2026.pdf p5. Keys match the city keys in public/data/places.json.
export const REGIONS = {
  venues: 100,
  visitorsDay: 300000,
  playsDay: '25–30',
  monitorsPerVenue: '4–10',
  spotSec: 20,
  notice: 70,
  see: '50–80',
  price: [150, 100, 60],
  imgs: ['rg-cafe-screens', 'rg-checkout', 'rg-cafe-3', 'rg-foodcourt', 'rg-restaurant', 'rg-navruz'],
  rows: [
    { key: 'andijon', screens: 121, venues: 17, daily: 30000, iata: 'AZN' },
    { key: 'fargona', screens: 97, venues: 17, daily: 17000, iata: 'FEG' },
    { key: 'namangan', screens: 97, venues: 17, daily: 17000, iata: 'NMA' },
    { key: 'margilon', screens: 50, venues: 10, daily: 35000 },
    { key: 'asaka', screens: 50, venues: 10, daily: 15000 },
    { key: 'qoqon', screens: 100, venues: 17, daily: 30000, iata: 'OQN' },
    { key: 'samarqand', screens: 30, venues: 10, daily: 12000, iata: 'SKD' },
    { key: 'buxoro', screens: 25, venues: 10, daily: 10000, iata: 'BHK' },
    { key: 'jizzax', screens: 25, venues: 5, daily: 5000 },
    { key: 'qarshi', screens: 25, venues: 5, daily: 3000, iata: 'KSQ' },
    { key: 'nurafshon', screens: 100, venues: 17, daily: 30000 },
  ],
};

export const HOLDING = { name: 'Orient Advertising', specialists: 100 };
export const PHONES = ['+998 99 178 77 77'];
export const TERMS = [3, 6, 12];

// The six directions, each under its original brand (decks in the project root). Media Port is also the site's name.
export const DIRECTIONS = [
  { id: 'mediaport', chapter: 'airport', brand: 'Media Port', color: '#163b67', accent: '#e3000f', logo: null, site: null, group: 'airport', items: () => LED_ZONES.map((z) => `led-${z.id}`) },
  { id: 'flytv', chapter: 'flytv', brand: 'Fly TV', color: '#e40045', logo: 'flytv', site: 'flytv.uz', group: 'airport', items: () => ['tv'] },
  { id: 'mediagate', chapter: 'mediagate', brand: 'Media Gate', color: '#153b66', accent: '#d0021b', logo: 'mediagate', site: 'mediagate.uz', group: 'airport', items: () => ['lightbox'] },
  { id: 'tvl-korzinka', chapter: 'korzinka', brand: 'TV Line', sub: 'Korzinka', color: '#e2001b', logo: 'tvline', subLogo: 'korzinka', site: 'tvline.uz', group: 'tvline', items: () => ['korzinka'] },
  { id: 'tvl-horeca', chapter: 'horeca', brand: 'TV Line', sub: 'HoReCa', color: '#e11783', logo: 'tvline', site: 'tvline.uz', group: 'tvline', items: () => ['horeca'] },
  { id: 'tvl-region', chapter: 'regions', brand: 'TV Line', sub: 'Region', color: '#ad4482', logo: 'tvline', subLogo: 'region-script', site: 'tvline.uz', group: 'tvline', items: () => ['regions'] },
];
export const directionOf = (itemId) => DIRECTIONS.find((d) => d.items().includes(itemId));

// Networks the media-plan calculator can combine.
export const PLAN_ITEMS = [
  ...LED_ZONES.map((z) => ({ id: `led-${z.id}`, group: 'airport', zone: z.id, price: z.price })),
  { id: 'tv', group: 'airport', price: AIRPORT_TV.price },
  { id: 'lightbox', group: 'airport', price: LIGHTBOX.price },
  { id: 'korzinka', group: 'korzinka', price: KORZINKA.price },
  { id: 'horeca', group: 'horeca', price: HORECA.price },
  { id: 'regions', group: 'regions', price: REGIONS.price },
];
