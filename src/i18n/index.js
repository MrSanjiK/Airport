import uz from './uz.js';

export const LANGS = [
  { code: 'uz', flag: 'uz', locale: 'uz-Latn-UZ' },
  { code: 'ru', flag: 'ru', locale: 'ru-RU' },
  { code: 'en', flag: 'gb', locale: 'en-GB' },
  { code: 'ar', flag: 'ae', locale: 'ar-AE', rtl: true, font: 'Noto+Kufi+Arabic:wght@500..800&family=Noto+Sans+Arabic:wght@400..700' },
  { code: 'zh', flag: 'cn', locale: 'zh-CN', font: 'Noto+Sans+SC:wght@400..800' },
  { code: 'tr', flag: 'tr', locale: 'tr-TR' },
  { code: 'fr', flag: 'fr', locale: 'fr-FR' },
  { code: 'it', flag: 'it', locale: 'it-IT' },
  { code: 'ko', flag: 'kr', locale: 'ko-KR', font: 'Noto+Sans+KR:wght@400..800' },
];

const loaders = {
  uz: () => Promise.resolve({ default: uz }),
  ru: () => import('./ru.js'),
  en: () => import('./en.js'),
  ar: () => import('./ar.js'),
  zh: () => import('./zh.js'),
  tr: () => import('./tr.js'),
  fr: () => import('./fr.js'),
  it: () => import('./it.js'),
  ko: () => import('./ko.js'),
};

let dict = uz;
let current = LANGS[0];
const listeners = new Set();

export const lang = () => current;
export const onLang = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function t(key, fallback = '') {
  let v = dict;
  for (const k of key.split('.')) v = v?.[k];
  if (v == null) {
    let u = uz;
    for (const k of key.split('.')) u = u?.[k];
    return u ?? fallback;
  }
  return v;
}

const nf = new Map();
export function num(n, opts) {
  const k = current.locale + JSON.stringify(opts || {});
  if (!nf.has(k)) {
    // Uzbek and Russian group thousands with a space, which reads like the decks.
    const loc = current.code === 'uz' ? 'ru-RU' : current.locale;
    nf.set(k, new Intl.NumberFormat(loc, opts));
  }
  return nf.get(k).format(n).replace(/ | /g, ' ');
}

function loadFont(spec) {
  if (!spec || document.querySelector(`link[data-font="${spec}"]`)) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = `https://fonts.googleapis.com/css2?family=${spec}&display=swap`;
  l.dataset.font = spec;
  document.head.append(l);
}

export function apply(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const v = t(el.dataset.i18n);
    if (typeof v === 'string') el.textContent = v;
  });
  root.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      el.setAttribute(attr, t(key));
    });
  });
  root.querySelectorAll('[data-num]').forEach((el) => {
    el.textContent = num(+el.dataset.num);
  });
}

export async function setLang(code, { persist = true } = {}) {
  const meta = LANGS.find((l) => l.code === code) || LANGS[0];
  const mod = await loaders[meta.code]();
  dict = mod.default;
  current = meta;
  loadFont(meta.font);
  const html = document.documentElement;
  html.lang = meta.code;
  html.dir = meta.rtl ? 'rtl' : 'ltr';
  document.title = t('meta.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('meta.description'));
  if (persist) {
    try { localStorage.setItem('mp-lang', meta.code); } catch (e) {}
  }
  apply();
  listeners.forEach((fn) => fn(meta));
}

export function initialLang() {
  try {
    const q = new URLSearchParams(location.search).get('lang');
    if (q && loaders[q]) return q;
    const s = localStorage.getItem('mp-lang');
    if (s && loaders[s]) return s;
  } catch (e) {}
  const nav = (navigator.language || 'uz').slice(0, 2).toLowerCase();
  return loaders[nav] ? nav : 'uz';
}

// Amounts are kept in million sum; from a thousand million they read as billions (1,2 mlrd so'm).
export function money(mln) {
  if (Math.abs(mln) >= 1000) {
    const v = mln / 1000;
    return { value: num(v, { maximumFractionDigits: v < 10 ? 2 : 1, minimumFractionDigits: 0 }), unit: t('units.bln') };
  }
  return { value: num(Math.round(mln)), unit: t('units.mln') };
}
