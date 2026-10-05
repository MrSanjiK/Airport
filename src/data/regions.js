// Per-city detail for the regional network, from the Region 2026 deck (venue list, pages 14–15; venue photos,
// pages 6–12). Venues are listed under the city their address or name places them in; the few the deck does not
// place are kept with the Fergana valley as a whole. Store collages are the deck's regional Korzinka pages.

export const CITY_VENUES = {
  andijon: [
    ['Mehmon', 'Bobur shoh ko‘ch., 3'],
    ['Uz Turk 2', 'Amir Temur ko‘ch., 9'],
    ['O‘zbegim · Makro M32', 'Sulton ko‘ch., 10'],
    ['Makro M20', 'Amir Umarxon ko‘ch., 24'],
    ['Makro M16', 'Bobur shoh ko‘ch., 8'],
    ['Stimorol', 'Kichik massiv 4, Lermontov ko‘ch., 30'],
    ['Korzinka · Navruz', 'Mashrab ko‘ch., 62'],
    ['Korzinka · Vokzal', 'Amir Temur ko‘ch., 62'],
    ['Mega polis', 'Toshkent ko‘ch., 44'],
    ['Gumbaz 1', 'Bobur shoh ko‘ch., 36'],
    ['Zaytun', 'Andijon tumani, Oltin vodiy ko‘ch., 20'],
    ['O‘zbegim Food Kort', 'Sulton ko‘ch., 10'],
    ['O‘zbegim · Sulton Ahmet', 'Sulton shoh ko‘ch., 10'],
    ['Makro M19 · Shahrixon', 'Shahrixon shoh ko‘ch., 1'],
    ['Korzinka · Shahrixon', 'Shahrixon shoh ko‘ch., 34'],
  ],
  asaka: [
    ['Gumbaz', 'Karvonsaroy ko‘ch., 1'],
    ['Iris', 'Imom Buxoriy ko‘ch., 14'],
    ['Sulton Saroy', 'Imom Buxoriy ko‘ch., 13'],
    ['Obu Rohat', 'Imom Buxoriy ko‘ch.'],
    ['Yulduz', 'Kalin ko‘ch., 31'],
    ['Korzinka', 'Jaloliddin Manguberdi ko‘ch., 36'],
    ['Makro M22', 'Umid ko‘ch., 49'],
  ],
  fargona: [
    ['Rayhon', 'Vatan ravnaqi ko‘ch., 1'],
    ['O‘zbegim milliy taomlari', 'Dodxoh ko‘ch., 22a'],
    ['Istiqlol', 'Yuksalish ko‘ch., 104/2'],
    ['KWIK', 'Al-Farg‘oniy ko‘ch., universitet qarshisida'],
    ['Oybek osh markazi 1', 'Oqsuv ko‘ch., 12'],
    ['Oybek osh markazi 2', 'Ko‘ksaroy, Bahor ko‘ch., 13'],
    ['Sulton Ahmet', 'Yuksalish ko‘ch., 1'],
    ['Oxu', 'Mustaqillik ko‘ch., 55'],
    ['Korzinka', 'Yuksalish ko‘ch., 53'],
  ],
  margilon: [
    ['Marg‘ilon kabob', 'Istiqlol ko‘ch., 32'],
    ['Yakko Marg‘ilon', 'Navoiy ko‘ch., 41'],
    ['Kish Mish', 'Eski Tor ko‘ch., 186'],
  ],
  qoqon: [
    ['Oilaviy', 'Istiqlol ko‘ch., 4'],
    ['My cafe', 'Istiqlol ko‘ch., 4'],
    ['Mini Food', 'Xudoyorxon ko‘ch., 13'],
    ['Benazir', 'Xudoyorxon ko‘ch., 11'],
    ['Bahor', 'Xudoyorxon ko‘ch., 2'],
    ['Benazir 1', 'Bobur ko‘ch.'],
    ['Benazir 2', 'Chahri ko‘ch.'],
    ['Benazir 3', 'Navoiy ko‘ch.'],
    ['Makro M24', 'Istiqlol ko‘ch., 4'],
    ['Korzinka', 'Shohruhobod ko‘ch., 39'],
    ['Yoshlik', 'Bobur ko‘ch., Pedagogika instituti qarshisida'],
  ],
  valley: [
    ['Bizning donar', 'Dehqon bozori yonida'],
    ['Makro M27', 'Sanoat ko‘ch., 8'],
    ['Makro M36', 'Sayilgoh ko‘ch., 26'],
    ['Makro M47 · Buvayda', 'Halqa yo‘li, aylana qarshisida'],
    ['Atlas milliy taomlar', 'Shox Saroy mo‘ljali'],
  ],
};

// venue photos from the deck, per city (public/img/rg/<key>-n.webp)
export const CITY_GALLERY = {
  fargona: 6, andijon: 6, qoqon: 6, asaka: 3, margilon: 3, namangan: 6,
};
// the deck's Korzinka store collage for the city (public/img/rg/kz-<key>-1.webp)
export const CITY_STORES = ['samarqand', 'buxoro', 'andijon', 'fargona', 'jizzax', 'namangan'];
