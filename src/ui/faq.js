import { t } from '../i18n/index.js';

// Questions clients ask before booking (mediagate.uz): one answer open at a time, the height eased in CSS
export function mountFaq(el) {
  if (!el) return;
  const open = +(el.dataset.open ?? 0);
  el.innerHTML = `<div class="faq-head"><p class="pm-k"><i></i>${t('faq.k')}</p><h3>${t('faq.title')}</h3></div>
    <div class="faq-list">${[1, 2, 3, 4, 5].map((i) => `<div class="faq-item${i - 1 === open ? ' is-open' : ''}">
      <button type="button" class="faq-q" aria-expanded="${i - 1 === open}" aria-controls="faq-a${i}" id="faq-q${i}"><span class="tnum">0${i}</span>${t(`faq.q${i}`)}<i aria-hidden="true"></i></button>
      <div class="faq-a" id="faq-a${i}" role="region" aria-labelledby="faq-q${i}"><div><p>${t(`faq.a${i}`)}</p></div></div>
    </div>`).join('')}</div>`;
  el.querySelectorAll('.faq-q').forEach((b, i) => b.addEventListener('click', () => {
    const was = b.getAttribute('aria-expanded') === 'true';
    el.querySelectorAll('.faq-item').forEach((it, j) => {
      const on = j === i && !was;
      it.classList.toggle('is-open', on);
      it.querySelector('.faq-q').setAttribute('aria-expanded', String(on));
    });
    el.dataset.open = was ? -1 : i;
  }));
}
