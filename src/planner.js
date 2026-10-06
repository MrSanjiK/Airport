import { t, num, money, onLang } from './i18n/index.js';
import { LED_ZONES, AIRPORT_TV, LIGHTBOX, KORZINKA, HORECA, REGIONS, TERMS, PHONES, HOLDING } from './data/inventory.js';
import logo from './assets/logo.svg?raw';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CHECK = '<svg viewBox="0 0 14 14"><path d="M2.5 7.5l3 3 6-7"/></svg>';
const ITEMS = () => [
  ...LED_ZONES.map((z, i) => ({ id: `led-${z.id}`, group: 'airport', name: `${i + 1}. ${t(`airport.zones.${z.id}`)}`, price: z.price })),
  { id: 'tv', group: 'other', name: t('plan.tv'), price: AIRPORT_TV.price },
  { id: 'lightbox', group: 'other', name: t('plan.lightbox'), price: LIGHTBOX.price },
  { id: 'korzinka', group: 'other', name: t('plan.korzinka'), price: KORZINKA.price },
  { id: 'horeca', group: 'other', name: t('plan.horeca'), price: HORECA.price },
  { id: 'regions', group: 'other', name: t('plan.regions'), price: REGIONS.price },
];

export function initPlanner({ bus }) {
  const calc = document.getElementById('calc');
  const strip = document.getElementById('strip');
  const inquiry = document.getElementById('inquiry');
  const state = { sel: new Set(['led-arr32', 'korzinka']), term: 6 };
  try {
    const s = JSON.parse(sessionStorage.getItem('mp-plan') || 'null');
    if (s) { state.sel = new Set(s.sel); state.term = s.term; }
  } catch (e) {}

  const chip = (it) => `<label class="chip"><input type="checkbox" name="item" value="${it.id}" ${state.sel.has(it.id) ? 'checked' : ''}/>
      <span class="chip-face"><span class="chip-box">${CHECK}</span><span class="chip-name">${esc(it.name)}</span>
      <span class="chip-price">${num(it.price[TERMS.indexOf(state.term)])} ${esc(t('units.mln'))} ${esc(t('units.perMonth'))}</span></span></label>`;

  const renderCalc = () => {
    const items = ITEMS();
    calc.innerHTML = `
      <fieldset class="fbox"><legend><i>1</i>${esc(t('plan.groupAirport'))}</legend>
        <div class="chips">${items.filter((i) => i.group === 'airport').map(chip).join('')}</div></fieldset>
      <fieldset class="fbox"><legend><i>2</i>${esc(t('plan.groupOther'))}</legend>
        <div class="chips">${items.filter((i) => i.group === 'other').map(chip).join('')}</div></fieldset>
      <fieldset class="fbox"><legend><i>3</i>${esc(t('plan.term'))}</legend>
        <div class="seg" role="radiogroup">${TERMS.map((m) => `<label><input type="radio" name="term" value="${m}" ${m === state.term ? 'checked' : ''}/><span>${esc(t(`units.month${m}`))}</span></label>`).join('')}<span class="seg-thumb" aria-hidden="true"></span></div>
      </fieldset>`;
    placeThumb();
  };
  const placeThumb = () => {
    const seg = calc.querySelector('.seg');
    if (!seg) return;
    const i = TERMS.indexOf(state.term);
    const thumb = seg.querySelector('.seg-thumb');
    const w = (seg.clientWidth - 8) / TERMS.length;
    thumb.style.width = `${w}px`;
    const rtl = document.documentElement.dir === 'rtl';
    thumb.style.transform = `translateX(${(rtl ? -1 : 1) * i * w}px)`;
    if (rtl) { thumb.style.left = 'auto'; thumb.style.right = '4px'; } else { thumb.style.left = '4px'; thumb.style.right = 'auto'; }
  };

  // Animated figures in the result strip
  const shown = { monthly: 0, total: 0, save: 0 };
  let raf;
  const tween = (to) => {
    cancelAnimationFrame(raf);
    const from = { ...shown };
    const t0 = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - t0) / 700);
      const e = 1 - Math.pow(1 - k, 4);
      for (const key in to) shown[key] = from[key] + (to[key] - from[key]) * e;
      paintNums();
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const paintNums = () => {
    if (!strip.querySelector('[data-v="monthly"]')) return;
    ['monthly', 'total', 'save'].forEach((k) => {
      const el = strip.querySelector(`[data-v="${k}"]`);
      const m = money(shown[k]);
      el.firstChild.textContent = m.value;
      el.lastChild.textContent = m.unit;
    });
  };

  const totals = () => {
    const items = ITEMS().filter((i) => state.sel.has(i.id));
    const ti = TERMS.indexOf(state.term);
    const monthly = items.reduce((a, i) => a + i.price[ti], 0);
    const base = items.reduce((a, i) => a + i.price[0], 0);
    return { items, monthly, total: monthly * state.term, save: (base - monthly) * state.term, ti };
  };

  const renderStrip = () => {
    const { items, ti } = totals();
    strip.innerHTML = `
      <div class="strip-row"><span class="strip-k">${esc(t('plan.monthly'))}</span><span class="strip-v" data-v="monthly"><span></span><small>${esc(t('units.mln'))}</small></span></div>
      <div class="strip-row"><span class="strip-k">${esc(t('plan.total'))} · ${esc(t(`units.month${state.term}`))}</span><span class="strip-v" data-v="total"><span></span><small>${esc(t('units.mln'))}</small></span></div>
      <div class="strip-row"><span class="strip-k">${esc(t('plan.saving'))}</span><span class="strip-v strip-v--sm strip-save" data-v="save"><span></span><small>${esc(t('units.mln'))}</small></span></div>
      ${items.length ? `<ul class="strip-list">${items.map((i) => `<li><span>${esc(i.name)}</span><b>${num(i.price[ti])}</b></li>`).join('')}</ul>` : `<p class="strip-empty">${esc(t('plan.empty'))}</p>`}
      <p class="note">${esc(t('units.vat'))}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a class="btn-primary" href="#inquiry" data-send ${items.length ? '' : 'aria-disabled="true" style="opacity:.45;pointer-events:none"'}><span class="btn-primary-label">${esc(t('plan.send'))}</span>
          <span class="btn-primary-flight" aria-hidden="true"><svg viewBox="0 0 64 24"><path class="bp-trail" d="M2 18 C 18 18, 30 14, 46 7" /><g class="bp-plane"><path d="M0 0l-6.5-3.2v1.8l2.6 1.4H-9l-1.4-1.7h-1.2l.8 2.7-.8 2.7h1.2L-9 2h5.1l-2.6 1.4v1.8z" /></g></svg></span></a>
        ${items.length ? `<button class="btn-quiet" type="button" data-clear>${esc(t('plan.clear'))}</button>` : ''}
      </div>`;
    paintNums();
    const tt = totals();
    tween({ monthly: tt.monthly, total: tt.total, save: tt.save });
    strip.querySelector('[data-clear]')?.addEventListener('click', () => {
      state.sel.clear();
      calc.querySelectorAll('input[name="item"]').forEach((i) => (i.checked = false));
      update();
    });
    strip.querySelector('[data-send]')?.addEventListener('click', (e) => {
      e.preventDefault();
      inquiry.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => inquiry.querySelector('input')?.focus({ preventScroll: true }), 700);
    });
  };

  const update = () => {
    try { sessionStorage.setItem('mp-plan', JSON.stringify({ sel: [...state.sel], term: state.term })); } catch (e) {}
    calc.querySelectorAll('.chip-price').forEach((el) => {
      const id = el.closest('.chip').querySelector('input').value;
      const it = ITEMS().find((i) => i.id === id);
      el.textContent = `${num(it.price[TERMS.indexOf(state.term)])} ${t('units.mln')} ${t('units.perMonth')}`;
    });
    renderStrip();
    renderPlanLine();
    bus.dispatchEvent(new CustomEvent('plan', { detail: { sel: [...state.sel], term: state.term } }));
  };

  calc.addEventListener('change', (e) => {
    if (e.target.name === 'item') e.target.checked ? state.sel.add(e.target.value) : state.sel.delete(e.target.value);
    if (e.target.name === 'term') { state.term = +e.target.value; placeThumb(); }
    update();
  });
  bus.addEventListener('planadd', (e) => {
    state.sel.add(e.detail);
    const box = calc.querySelector(`input[value="${e.detail}"]`);
    if (box) box.checked = true;
    update();
  });
  bus.addEventListener('zonepick', (e) => {
    // picking a zone on the chart pre-selects it in the plan
    state.sel.add(`led-${e.detail}`);
    const box = calc.querySelector(`input[value="led-${e.detail}"]`);
    if (box) box.checked = true;
    update();
  });

  // Inquiry form
  const planText = () => {
    const { items, monthly, total } = totals();
    const m = money(monthly);
    const tt = money(total);
    return `${t('form.planLabel')}: ${items.map((i) => i.name).join('; ')} — ${t(`units.month${state.term}`)}, ${m.value} ${m.unit} ${t('units.perMonth')} (${tt.value} ${tt.unit})`;
  };
  const renderPlanLine = () => {
    const el = inquiry.querySelector('.form-plan');
    if (el) el.textContent = state.sel.size ? planText() : '';
  };
  const renderInquiry = () => {
    inquiry.id = 'inquiry';
    inquiry.innerHTML = `
      <div class="inquiry-copy"><h3>${esc(t('form.title'))}</h3><p>${esc(t('form.lead'))}</p>
        <p>${PHONES.map((p) => `<a href="tel:${p.replace(/\s/g, '')}" style="display:block;font-weight:700;font-size:20px;text-decoration:none;margin-top:6px" class="tnum">${p}</a>`).join('')}</p></div>
      <form class="form" novalidate>
        <div class="field"><label for="f-name">${esc(t('form.name'))}</label><input id="f-name" name="name" autocomplete="name" placeholder="${esc(t('form.phName'))}" required /><span class="field-err" aria-live="polite"></span></div>
        <div class="field"><label for="f-company">${esc(t('form.company'))} <small>${esc(t('form.optional'))}</small></label><input id="f-company" name="company" autocomplete="organization" placeholder="${esc(t('form.phCompany'))}" /></div>
        <div class="field field--wide"><label for="f-phone">${esc(t('form.phone'))}</label><input id="f-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="${esc(t('form.phPhone'))}" required /><span class="field-err" aria-live="polite"></span></div>
        <div class="field field--wide"><label for="f-msg">${esc(t('form.message'))} <small>${esc(t('form.optional'))}</small></label><textarea id="f-msg" name="message" rows="3" placeholder="${esc(t('form.phMessage'))}"></textarea></div>
        <div class="form-actions">
          <button class="btn-primary" type="submit"><span class="btn-primary-label">${esc(t('form.submit'))}</span>
            <span class="btn-primary-flight" aria-hidden="true"><svg viewBox="0 0 64 24"><path class="bp-trail" d="M2 18 C 18 18, 30 14, 46 7" /><g class="bp-plane"><path d="M0 0l-6.5-3.2v1.8l2.6 1.4H-9l-1.4-1.7h-1.2l.8 2.7-.8 2.7h1.2L-9 2h5.1l-2.6 1.4v1.8z" /></g></svg></span></button>
          <span class="form-plan"></span>
        </div>
      </form>`;
    renderPlanLine();
    const form = inquiry.querySelector('form');
    const phone = form.querySelector('#f-phone');
    phone.addEventListener('input', () => {
      // +998 XX XXX XX XX
      let d = phone.value.replace(/\D/g, '');
      if (d.startsWith('998')) d = d.slice(3);
      d = d.slice(0, 9);
      const parts = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
      phone.value = d.length ? `+998 ${parts.join(' ')}` : '';
    });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const digits = phone.value.replace(/\D/g, '');
      let ok = true;
      const setErr = (input, msg) => {
        const f = input.closest('.field');
        f.classList.toggle('is-error', !!msg);
        f.querySelector('.field-err').textContent = msg || '';
        input.setAttribute('aria-invalid', msg ? 'true' : 'false');
        if (msg && ok) { input.focus(); ok = false; }
      };
      setErr(form.name, name ? '' : t('form.errName'));
      setErr(phone, digits.length >= 12 ? '' : t('form.errPhone'));
      if (!ok) return;
      const btn = form.querySelector('[type="submit"] .btn-primary-label');
      btn.textContent = t('form.sending');
      const msg = [
        'Media Port — media-plan',
        `${t('form.name')}: ${name}`,
        form.company.value.trim() && `${t('form.company')}: ${form.company.value.trim()}`,
        `${t('form.phone')}: ${phone.value}`,
        state.sel.size && planText(),
        form.message.value.trim() && `${t('form.message')}: ${form.message.value.trim()}`,
      ].filter(Boolean).join('\n');
      setTimeout(() => {
        form.innerHTML = `<div class="done">
          <svg class="done-check" viewBox="0 0 46 46"><circle cx="23" cy="23" r="21"/><path d="M14 23.5l6 6 12-13"/></svg>
          <h4>${esc(t('form.doneTitle'))}</h4><p style="color:var(--ink-2)">${esc(t('form.doneText'))}</p>
          <div class="done-actions">
            <a class="btn-quiet" href="tel:${PHONES[0].replace(/\s/g, '')}"><svg viewBox="0 0 16 16"><path d="M4 2.5h2l1 3-1.5 1a8 8 0 0 0 4 4l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5z"/></svg>${esc(t('form.call'))}</a>
            <a class="btn-quiet" href="https://wa.me/${PHONES[0].replace(/\D/g, '')}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener"><svg viewBox="0 0 16 16"><path d="M8 1.8a6.2 6.2 0 0 0-5.3 9.4L2 14l2.9-.7A6.2 6.2 0 1 0 8 1.8z"/></svg>${esc(t('form.whatsapp'))}</a>
            <button class="btn-quiet" type="button" data-copy><svg viewBox="0 0 16 16"><rect x="5" y="5" width="8.5" height="8.5" rx="1.5"/><path d="M3 10.5V3.5A1 1 0 0 1 4 2.5h7"/></svg><span>${esc(t('form.copy'))}</span></button>
            <button class="btn-quiet" type="button" data-again>${esc(t('form.again'))}</button>
          </div></div>`;
        form.querySelector('[data-copy]').addEventListener('click', async (ev) => {
          try { await navigator.clipboard.writeText(msg); ev.currentTarget.querySelector('span').textContent = t('form.copied'); } catch (err) {}
        });
        form.querySelector('[data-again]').addEventListener('click', renderInquiry);
      }, 650);
    });
  };

  // Footer
  const renderFooter = () => {
    const tel = PHONES[0].replace(/\s/g, '');
    const arrow = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"/></svg>';
    document.getElementById('footer').innerHTML = `<div class="footer-card">
      <div class="footer-top">
        <p class="footer-slogan">${esc(t('footer.slogan')).replace(/(\S+)$/, '<span>$1</span>')}</p>
        <a class="pill pill--route" href="#plan" data-magnetic>${esc(t('hero.cta'))}${arrow}</a>
      </div>
      <div class="footer-grid">
        <div class="footer-brand">
          <span class="logo">${logo}</span>
          <p>${esc(t('footer.about'))}</p>
          <div class="footer-pills">
            <a class="pill" href="https://wa.me/${tel.replace(/\D/g, '')}" target="_blank" rel="noopener"><i></i>WhatsApp</a>
            <a class="pill" href="tel:${tel}"><i></i>${esc(t('form.call'))}</a>
          </div>
        </div>
        <div><h3><b>01</b> · ${esc(t('footer.networks'))}</h3><ul>${['airport', 'korzinka', 'horeca', 'regions', 'plan'].map((k) => `<li><a href="#${k}">${esc(t(`nav.${k}`))}</a></li>`).join('')}</ul></div>
        <div><h3><b>02</b> · ${esc(t('footer.contacts'))}</h3><ul class="footer-phones">${PHONES.map((p) => `<li><a class="tnum" href="tel:${p.replace(/\s/g, '')}">${p}</a></li>`).join('')}</ul><p class="footer-small">${HOLDING.name}</p></div>
        <div><h3><b>03</b> · ${esc(t('footer.sourcesTitle'))}</h3><p class="footer-small">${esc(t('map.sources'))}</p><p class="footer-small">${esc(t('footer.photos'))}</p></div>
      </div>
      <div class="footer-base"><span>© ${new Date().getFullYear()} ${esc(t('footer.rights'))}</span>
        <div class="footer-author"><span>${esc(t('footer.author'))}</span>
          <a class="pill pill--sm" href="tel:+998943494994"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5h2l1 3-1.5 1a8 8 0 0 0 4 4l1-1.5 3 1v2a1.5 1.5 0 0 1-1.6 1.5A11.5 11.5 0 0 1 2.5 4.1 1.5 1.5 0 0 1 4 2.5z"/></svg><span class="tnum">+998 94 349 49 94</span></a>
          <a class="pill pill--sm" href="https://t.me/busanjik" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M14.5 2.5 1.8 7.4c-.6.2-.6 1 0 1.2l3.1 1 1.2 3.7c.2.5.8.6 1.1.2l1.8-1.9 3.2 2.4c.4.3 1 .1 1.1-.4l2.1-10.1c.1-.6-.4-1.1-1-.9z"/><path d="m4.9 9.6 7.3-4.8-5.6 6"/></svg>Telegram</a>
          <a class="pill pill--sm" href="https://instagram.com/busanjik" target="_blank" rel="noopener"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="2" width="12" height="12" rx="3.5"/><circle cx="8" cy="8" r="2.9"/><circle cx="11.6" cy="4.4" r=".6"/></svg>Instagram</a>
        </div>
        <a class="pill pill--icon" href="#top"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13V3M4 7l4-4 4 4"/></svg>${esc(t('footer.top'))}</a></div>
    </div>`;
  };

  const renderAll = () => { renderCalc(); renderStrip(); renderInquiry(); renderFooter(); };
  renderAll();
  onLang(renderAll);
  addEventListener('resize', placeThumb);
}
