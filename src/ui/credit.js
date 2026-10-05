import { t } from '../i18n/index.js';

// Licence attribution for a Commons photograph, kept on the photograph itself
// (inside a clickable tile it is plain text; the info card carries the link to the source page)
export const credit = (c, { link = true } = {}) => {
  const text = `${t('card.photoBy')}: ${String(c.author).replace(/[&<>"]/g, '')} · ${c.license}`;
  return link ? `<a class="ph-credit" href="${c.source}" target="_blank" rel="noopener">${text}</a>` : `<span class="ph-credit">${text}</span>`;
};
