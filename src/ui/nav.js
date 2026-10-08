import logo from '../assets/logo.svg?raw';
import { LANGS, lang, setLang, t, onLang } from '../i18n/index.js';
import { flagSvg } from './flags.js';

const $ = (s, r = document) => r.querySelector(s);
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9.5M8.5 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
import { DIRECTIONS } from '../data/inventory.js';
import { badge, tagline } from './brand.js';

const MEGA_KEYS = ['mediaport', 'flytv', 'mediagate', 'tvline', 'plan'];
const HREF = { mediaport: 'airport', flytv: 'flytv', mediagate: 'mediagate', tvline: 'korzinka', plan: 'plan' };
const DIR = { mediaport: 'mediaport', flytv: 'flytv', mediagate: 'mediagate' };

export function mountLogos() {
  document.querySelectorAll('[data-logo]').forEach((el) => (el.innerHTML = logo));
}

export function initNav({ onTheme } = {}) {
  const nav = $('#nav');
  const links = $('.nav-links', nav);
  const mega = $('#mega');
  const megaInner = $('#megaInner');
  const scrim = $('#scrim');

  // Sliding hover pill behind the links
  const pill = document.createElement('span');
  pill.className = 'nav-pill';
  links.append(pill);
  const movePill = (a) => {
    const r = a.getBoundingClientRect();
    const p = links.getBoundingClientRect();
    pill.style.width = `${r.width}px`;
    pill.style.transform = `translateX(${r.left - p.left}px)`;
    pill.style.opacity = '1';
  };

  // Mega flyout
  const renderMega = () => {
    const dir = (id) => DIRECTIONS.find((d) => d.id === id);
    megaInner.innerHTML = MEGA_KEYS.map((k) => {
      if (k === 'tvline') {
        // TV Line carries three networks: each one its own way in
        const tl = DIRECTIONS.filter((d) => d.group === 'tvline');
        return `<div class="mega-panel mega-panel--tvline" data-panel="${k}" hidden>
          <div class="mega-head">${badge(tl[0], 'md').replace(/<i class="bd-sep".*<\/span>$/, '</span>')}<p class="mega-title">${t('mega.tvline.title')}</p><small>${t('dir.tvlineAbout')}</small></div>
          <div class="mega-subs">${tl.map((d) => `<a class="mega-sub" href="#${d.chapter}" style="--brand:${d.color}">${badge(d, 'sm')}<b>${d.sub}</b><span>${tagline(d)}</span>${ARROW}</a>`).join('')}</div>
        </div>`;
      }
      const d = DIR[k] && dir(DIR[k]);
      return `<div class="mega-panel" data-panel="${k}" hidden>
        <div class="mega-head">${d ? badge(d, 'md') : ''}<p class="mega-title">${t(`mega.${k}.title`)}</p></div>
        <ul class="mega-list"><li>${t(`mega.${k}.a`)}</li><li>${t(`mega.${k}.b`)}</li><li>${t(`mega.${k}.c`)}</li></ul>
        <div class="mega-stat"><span><b>${t(`mega.${k}.stat`)}</b></span><a class="mega-go" href="#${HREF[k]}">${t('mega.open')} ${ARROW}</a></div>
      </div>`;
    }).join('');
  };
  renderMega();

  let closeTimer;
  let openKey = null;
  const openMega = (key) => {
    clearTimeout(closeTimer);
    if (matchMedia('(max-width: 960px)').matches) return;
    openKey = key;
    megaInner.querySelectorAll('.mega-panel').forEach((p) => (p.hidden = p.dataset.panel !== key));
    nav.classList.add('is-mega');
    mega.setAttribute('aria-hidden', 'false');
    scrim.classList.add('is-on');
  };
  const closeMega = (delay = 160) => {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
      openKey = null;
      nav.classList.remove('is-mega');
      mega.setAttribute('aria-hidden', 'true');
      scrim.classList.remove('is-on');
      pill.style.opacity = '0';
    }, delay);
  };

  links.querySelectorAll('a').forEach((a) => {
    a.addEventListener('pointerenter', () => { movePill(a); openMega(a.dataset.mega); });
    a.addEventListener('focus', () => { movePill(a); openMega(a.dataset.mega); });
    a.addEventListener('click', () => closeMega(0));
  });
  links.addEventListener('pointerleave', () => closeMega());
  mega.addEventListener('pointerenter', () => clearTimeout(closeTimer));
  mega.addEventListener('pointerleave', () => closeMega());
  megaInner.addEventListener('click', (e) => { if (e.target.closest('a')) closeMega(0); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openKey) closeMega(0); });

  // Mobile menu
  const burger = $('#burger');
  const mobile = $('#mobileNav');
  const renderMobile = () => {
    mobile.innerHTML =
      DIRECTIONS.map((d) => `<a href="#${d.chapter}" style="--brand:${d.color}">${badge(d, 'sm')}<small>${tagline(d)}</small></a>`).join('') +
      `<a href="#plan">${t('nav.plan')} <small>${t('mega.plan.stat')}</small></a>` +
      `<a class="btn-primary" href="#plan"><span class="btn-primary-label">${t('hero.cta')}</span></a>`;
  };
  renderMobile();
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    mobile.hidden = !open;
    scrim.classList.toggle('is-on', open);
  });
  mobile.addEventListener('click', (e) => {
    if (e.target.closest('a')) { burger.setAttribute('aria-expanded', 'false'); mobile.hidden = true; scrim.classList.remove('is-on'); }
  });

  // Theme toggle
  const tt = $('#themeToggle');
  const syncTheme = () => {
    const night = document.documentElement.dataset.theme === 'night';
    tt.setAttribute('aria-pressed', String(night));
    tt.querySelector('.sr-only').textContent = night ? t('nav.themeDay') : t('nav.themeNight');
    tt.title = tt.querySelector('.sr-only').textContent;
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', night ? '#0A1729' : '#EDF2F6'));
  };
  tt.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'night' ? 'day' : 'night';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('mp-theme', next); } catch (e) {}
    syncTheme();
    onTheme?.(next);
  });
  syncTheme();

  // Language switcher
  const btn = $('#langBtn');
  const pop = $('#langPop');
  const flag = $('#langFlag');
  const renderLang = () => {
    flag.innerHTML = flagSvg(lang().flag);
    btn.title = `${t('nav.lang')}: ${t('langName')}`;
    pop.setAttribute('aria-label', t('nav.lang'));
    pop.innerHTML = LANGS.map(
      (l) => `<button type="button" role="option" class="lang-opt" data-lang="${l.code}" lang="${l.code}" aria-selected="${l.code === lang().code}">
        <span class="flag">${flagSvg(l.flag)}</span><span>${NATIVE[l.code]}</span></button>`,
    ).join('');
  };
  const openPop = () => {
    pop.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    (pop.querySelector('[aria-selected="true"]') || pop.querySelector('.lang-opt')).focus();
  };
  const closePop = (focusBtn) => {
    pop.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    if (focusBtn) btn.focus();
  };
  btn.addEventListener('click', () => (pop.hidden ? openPop() : closePop()));
  pop.addEventListener('click', async (e) => {
    const o = e.target.closest('.lang-opt');
    if (!o) return;
    closePop(true);
    await setLang(o.dataset.lang);
  });
  pop.addEventListener('keydown', (e) => {
    const opts = [...pop.querySelectorAll('.lang-opt')];
    const i = opts.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 3, ArrowUp: -3 }[e.key];
    if (step) {
      e.preventDefault();
      const dir = document.documentElement.dir === 'rtl' && Math.abs(step) === 1 ? -step : step;
      opts[(i + dir + opts.length) % opts.length].focus();
    } else if (e.key === 'Escape') closePop(true);
    else if (e.key === 'Tab') closePop(false);
  });
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !e.target.closest('#lang')) closePop(false); });
  renderLang();

  // Contact: one round button in the bar; the number, a call and WhatsApp open in a small sheet under it
  const callBtn = $('#callBtn');
  const callPop = $('#callPop');
  const closeCall = (focusBtn) => { callPop.hidden = true; callBtn.setAttribute('aria-expanded', 'false'); if (focusBtn) callBtn.focus(); };
  callBtn.addEventListener('click', () => {
    if (!callPop.hidden) return closeCall();
    closePop(false);
    callPop.hidden = false;
    callBtn.setAttribute('aria-expanded', 'true');
    callPop.querySelector('.call-num').focus();
  });
  $('#callCopy').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(callPop.querySelector('.call-num').textContent.trim()); } catch (err) { return; }
    b.classList.add('is-done');
    setTimeout(() => b.classList.remove('is-done'), 1600);
  });
  callPop.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCall(true); });
  document.addEventListener('pointerdown', (e) => { if (!callPop.hidden && !e.target.closest('#call')) closeCall(false); });
  btn.addEventListener('click', () => closeCall(false));

  onLang(() => { renderMega(); renderMobile(); renderLang(); syncTheme(); });

  // Current chapter dot in the nav
  // TV Line stands for its three chapters
  const setCurrent = (id) => links.querySelectorAll('a').forEach((a) => a.classList.toggle('is-current', !!id && (a.getAttribute('href') === `#${id}` || (a.dataset.also || '').split(' ').includes(id))));
  return { setCurrent };
}

const NATIVE = { uz: "O'zbekcha", ru: 'Русский', en: 'English', ar: 'العربية', zh: '中文', tr: 'Türkçe', fr: 'Français', it: 'Italiano', ko: '한국어' };
