import { t } from '../i18n/index.js';

// Photo viewer: any <img> inside [data-gallery] opens full screen with the rest of its gallery, captions from the
// figure (figcaption, alt or data-caption), keyboard and swipe navigation.
export function initLightbox() {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.hidden = true;
  box.innerHTML = `
    <div class="lb-stage"><img alt="" /></div>
    <div class="lb-bar">
      <button type="button" class="lb-btn lb-prev"><svg viewBox="0 0 16 16"><path d="M10 3 5 8l5 5"/></svg></button>
      <p class="lb-cap"><span class="lb-n"></span><span class="lb-t"></span></p>
      <button type="button" class="lb-btn lb-next"><svg viewBox="0 0 16 16"><path d="m6 3 5 5-5 5"/></svg></button>
    </div>
    <button type="button" class="lb-btn lb-close"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8"/></svg></button>`;
  document.body.append(box);
  const img = box.querySelector('img');
  let list = [];
  let i = 0;
  let lastFocus = null;

  const caption = (el) => el.closest('figure')?.querySelector('figcaption')?.textContent?.trim() || el.dataset.caption || el.alt || '';
  const show = (k) => {
    i = (k + list.length) % list.length;
    const el = list[i];
    box.classList.remove('is-loaded');
    // never blow a small deck photo past 1.6× its own pixels
    img.onload = () => { img.style.maxWidth = `min(1400px, 100%, ${Math.round(img.naturalWidth * 1.6)}px)`; box.classList.add('is-loaded'); };
    img.src = el.currentSrc || el.src;
    img.alt = el.alt || '';
    box.querySelector('.lb-n').textContent = list.length > 1 ? `${i + 1} / ${list.length}` : '';
    box.querySelector('.lb-t').textContent = caption(el);
    box.querySelectorAll('.lb-prev, .lb-next').forEach((b) => (b.hidden = list.length < 2));
  };
  const open = (el) => {
    const root = el.closest('[data-gallery]');
    list = [...root.querySelectorAll('img')].filter((x) => !x.closest('.ph-credit'));
    lastFocus = document.activeElement;
    box.querySelector('.lb-prev').setAttribute('aria-label', t('ui.prev'));
    box.querySelector('.lb-next').setAttribute('aria-label', t('ui.next'));
    box.querySelector('.lb-close').setAttribute('aria-label', t('ui.close'));
    box.hidden = false;
    document.documentElement.classList.add('is-lightbox');
    show(list.indexOf(el));
    requestAnimationFrame(() => box.classList.add('is-on'));
    box.querySelector('.lb-close').focus({ preventScroll: true });
  };
  const close = () => {
    box.classList.remove('is-on');
    document.documentElement.classList.remove('is-lightbox');
    setTimeout(() => { box.hidden = true; img.removeAttribute('src'); }, 320);
    lastFocus?.focus?.({ preventScroll: true });
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-gallery] img');
    if (el && !e.target.closest('a, button:not([data-zoom])')) { e.preventDefault(); open(el); }
  });
  box.querySelector('.lb-prev').addEventListener('click', () => show(i - 1));
  box.querySelector('.lb-next').addEventListener('click', () => show(i + 1));
  box.querySelector('.lb-close').addEventListener('click', close);
  box.addEventListener('click', (e) => { if (e.target === box || e.target.classList.contains('lb-stage')) close(); });
  addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    const rtl = document.documentElement.dir === 'rtl' ? -1 : 1;
    if (e.key === 'ArrowRight') show(i + rtl);
    if (e.key === 'ArrowLeft') show(i - rtl);
  });
  let sx = null;
  box.addEventListener('pointerdown', (e) => { sx = e.clientX; });
  box.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) show(i + (dx < 0 ? 1 : -1));
  });
}
