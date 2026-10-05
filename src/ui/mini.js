import { t } from '../i18n/index.js';

// Mini cards: any element with data-mini="<key>" opens a small glass card anchored to it, with the figure,
// its label, a sentence of context (mini.<key>) and, when given, an action (data-mini-plan="<plan group>").
export function initMini(bus) {
  const card = document.createElement('div');
  card.className = 'mini';
  card.setAttribute('role', 'dialog');
  card.hidden = true;
  document.body.append(card);
  let anchor = null;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const close = () => {
    if (!anchor) return;
    anchor.classList.remove('is-mini');
    anchor.setAttribute('aria-expanded', 'false');
    anchor = null;
    card.classList.remove('is-on');
    setTimeout(() => { if (!anchor) card.hidden = true; }, 260);
  };
  const place = () => {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const below = r.bottom + h + 16 < innerHeight;
    const x = Math.min(innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    const y = below ? r.bottom + 10 : r.top - h - 10;
    card.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`;
    card.style.setProperty('--ax', `${Math.min(w - 22, Math.max(22, r.left + r.width / 2 - x)).toFixed(0)}px`);
    card.classList.toggle('is-above', !below);
  };
  const open = (el) => {
    if (anchor === el) return close();
    close();
    anchor = el;
    const key = el.dataset.mini;
    const value = el.querySelector('dd, b, .mini-v')?.innerHTML || '';
    const label = el.querySelector('dt, span, .mini-l')?.textContent || '';
    const plan = el.dataset.miniPlan;
    card.innerHTML = `
      <div class="mini-head"><span class="mini-v">${value}</span><span class="mini-l">${esc(label)}</span></div>
      <p>${esc(t(`mini.${key}`))}</p>
      <div class="mini-foot"><small>${esc(t('mini.source'))}</small>${plan ? `<button type="button" class="mini-act" data-plan="${plan}">${esc(t('ui.addPlan'))}</button>` : ''}</div>`;
    card.hidden = false;
    el.classList.add('is-mini');
    el.setAttribute('aria-expanded', 'true');
    place();
    requestAnimationFrame(() => card.classList.add('is-on'));
  };

  document.addEventListener('click', (e) => {
    const act = e.target.closest('.mini-act');
    if (act) {
      bus.dispatchEvent(new CustomEvent('planadd', { detail: act.dataset.plan }));
      act.textContent = t('card.added');
      act.disabled = true;
      return;
    }
    const el = e.target.closest('[data-mini]');
    if (el) { e.preventDefault(); open(el); return; }
    if (!e.target.closest('.mini')) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-mini]')) { e.preventDefault(); open(e.target); }
  });
  addEventListener('scroll', close, { passive: true });
  addEventListener('resize', close);
}
