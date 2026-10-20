import '../styles/chat.css';
import { lang, onLang } from '../i18n/index.js';
import { BOT_URL, LEAD_API, OPERATOR } from '../data/inventory.js';

/* The chat in the corner of the site: the company's operator (the same AI as the Telegram bot, the CRM worker's
   /api/chat), one conversation per visitor, kept in their browser by a signed token. A manager's replies appear here
   too; "Telegram" moves the whole conversation into the bot. Loaded as its own chunk once the page is idle, so the
   chart never waits. It wears the site's own clothes: frosted capsules, plates, hairlines, the chart's condensed
   capitals and the route's red dot. */

const S = {
  uz: {
    sub: 'Onlayn · savol bering', status: 'Onlayn · Orient Advertising', today: 'Bugun',
    hello: (n) => `Assalomu alaykum! Men ${n}, Orient Advertising’dan 👋\n\nAeroport, Korzinka, restoranlar va 11 ta hududdagi ekranlar haqida so‘rang: narx, auditoriya, joylar. Qaysi mahsulotingizni reklama qilmoqchisiz?`,
    chips: ['Narxlar qancha?', 'Aeroportda reklama', 'Korzinka ekranlari', 'Menejer qo‘ng‘iroq qilsin'],
    ph: 'Xabar yozing…', send: 'Yuborish', close: 'Yopish', tg: 'Telegram’da davom etish',
    manager: 'Menejer', deck: 'PDF · taqdimot', open: 'Ochish', typing: (n) => `${n} yozmoqda`, retry: 'Aloqa uzildi. Qayta yuborish',
    rate: 'Juda ko‘p xabar. Bir daqiqadan so‘ng yozing.', aiErr: 'Kechirasiz, hozir javob bera olmadim. Qayta yozing yoki +998 93 566 45 01 raqamiga qo‘ng‘iroq qiling.',
    note: 'Virtual operator · narxlar QQSsiz', moved: 'Suhbat Telegram’da davom etmoqda',
    teaser: 'Narx yoki joylar bo‘yicha savolingiz bo‘lsa, yozing — darhol javob beraman.',
  },
  ru: {
    sub: 'Онлайн · задайте вопрос', status: 'Онлайн · Orient Advertising', today: 'Сегодня',
    hello: (n) => `Здравствуйте! Я ${n} из Orient Advertising 👋\n\nСпросите об экранах в аэропорту, Korzinka, ресторанах и 11 регионах: цены, аудитория, площадки. Что вы хотите прорекламировать?`,
    chips: ['Сколько стоит?', 'Реклама в аэропорту', 'Экраны в Korzinka', 'Перезвоните мне'],
    ph: 'Напишите сообщение…', send: 'Отправить', close: 'Закрыть', tg: 'Продолжить в Telegram',
    manager: 'Менеджер', deck: 'PDF · презентация', open: 'Открыть', typing: (n) => `${n} печатает`, retry: 'Нет связи. Отправить ещё раз',
    rate: 'Слишком много сообщений. Напишите через минуту.', aiErr: 'Извините, не получилось ответить. Напишите ещё раз или позвоните: +998 93 566 45 01.',
    note: 'Виртуальный оператор · цены без НДС', moved: 'Диалог продолжается в Telegram',
    teaser: 'Есть вопрос о ценах или площадках? Напишите — отвечу сразу.',
  },
  en: {
    sub: 'Online · ask a question', status: 'Online · Orient Advertising', today: 'Today',
    hello: (n) => `Hello! I’m ${n} from Orient Advertising 👋\n\nAsk me about screens at the airport, in Korzinka, restaurants and 11 regions: prices, audience, venues. What would you like to advertise?`,
    chips: ['What are the prices?', 'Airport advertising', 'Korzinka screens', 'Have a manager call me'],
    ph: 'Write a message…', send: 'Send', close: 'Close', tg: 'Continue in Telegram',
    manager: 'Manager', deck: 'PDF · presentation', open: 'Open', typing: (n) => `${n} is typing`, retry: 'Connection lost. Send again',
    rate: 'Too many messages. Please write again in a minute.', aiErr: 'Sorry, I couldn’t answer just now. Please try again or call +998 93 566 45 01.',
    note: 'Virtual operator · prices excl. VAT', moved: 'The conversation continues in Telegram',
    teaser: 'A question about prices or venues? Write — I’ll answer right away.',
  },
  ar: {
    sub: 'متصلة · اسأل', status: 'متصلة · Orient Advertising', today: 'اليوم',
    hello: (n) => `مرحبًا! أنا ${n} من Orient Advertising 👋\n\nاسألني عن الشاشات في المطار وKorzinka والمطاعم و11 منطقة: الأسعار والجمهور والمواقع. ما الذي تريد الإعلان عنه؟`,
    chips: ['ما هي الأسعار؟', 'الإعلان في المطار', 'شاشات Korzinka', 'اتصلوا بي'],
    ph: 'اكتب رسالة…', send: 'إرسال', close: 'إغلاق', tg: 'المتابعة في Telegram',
    manager: 'مدير', deck: 'PDF · عرض تقديمي', open: 'فتح', typing: (n) => `${n} تكتب`, retry: 'انقطع الاتصال. إعادة الإرسال',
    rate: 'رسائل كثيرة جدًا. اكتب بعد دقيقة.', aiErr: 'عذرًا، لم أتمكن من الرد الآن. حاول مجددًا أو اتصل على ‎+998 93 566 45 01.',
    note: 'مشغّلة افتراضية · الأسعار بدون ضريبة', moved: 'تستمر المحادثة في Telegram',
    teaser: 'لديك سؤال عن الأسعار أو المواقع؟ اكتب وسأجيب فورًا.',
  },
  zh: {
    sub: '在线 · 欢迎咨询', status: '在线 · Orient Advertising', today: '今天',
    hello: (n) => `您好！我是 Orient Advertising 的 ${n} 👋\n\n欢迎咨询机场、Korzinka 超市、餐厅及 11 个地区的屏幕广告：价格、受众和点位。您想推广什么产品？`,
    chips: ['价格是多少？', '机场广告', 'Korzinka 屏幕', '请经理给我回电'],
    ph: '输入消息…', send: '发送', close: '关闭', tg: '在 Telegram 继续', manager: '经理', deck: 'PDF · 介绍资料', open: '打开',
    typing: (n) => `${n} 正在输入`, retry: '连接中断，重新发送', rate: '消息过多，请一分钟后再试。', aiErr: '抱歉，暂时无法回复。请重试或致电 +998 93 566 45 01。',
    note: '虚拟客服 · 价格不含增值税', moved: '对话已转到 Telegram', teaser: '对价格或点位有疑问？请留言，我马上回复。',
  },
  tr: {
    sub: 'Çevrimiçi · soru sorun', status: 'Çevrimiçi · Orient Advertising', today: 'Bugün',
    hello: (n) => `Merhaba! Ben ${n}, Orient Advertising’den 👋\n\nHavalimanı, Korzinka, restoranlar ve 11 bölgedeki ekranları sorun: fiyatlar, kitle, lokasyonlar. Neyin reklamını yapmak istiyorsunuz?`,
    chips: ['Fiyatlar ne kadar?', 'Havalimanında reklam', 'Korzinka ekranları', 'Beni arayın'],
    ph: 'Mesaj yazın…', send: 'Gönder', close: 'Kapat', tg: 'Telegram’da devam et', manager: 'Yönetici', deck: 'PDF · sunum', open: 'Aç',
    typing: (n) => `${n} yazıyor`, retry: 'Bağlantı kesildi. Tekrar gönder', rate: 'Çok fazla mesaj. Bir dakika sonra yazın.', aiErr: 'Üzgünüm, şu an yanıt veremedim. Tekrar deneyin ya da +998 93 566 45 01 numarasını arayın.',
    note: 'Sanal operatör · fiyatlara KDV dahil değil', moved: 'Sohbet Telegram’da devam ediyor', teaser: 'Fiyat ya da lokasyon sorunuz mu var? Yazın, hemen yanıtlayayım.',
  },
  fr: {
    sub: 'En ligne · posez une question', status: 'En ligne · Orient Advertising', today: 'Aujourd’hui',
    hello: (n) => `Bonjour ! Je suis ${n}, d’Orient Advertising 👋\n\nInterrogez-moi sur les écrans à l’aéroport, chez Korzinka, dans les restaurants et 11 régions : prix, audience, emplacements. Que souhaitez-vous promouvoir ?`,
    chips: ['Quels sont les prix ?', 'Publicité à l’aéroport', 'Écrans Korzinka', 'Rappelez-moi'],
    ph: 'Écrivez un message…', send: 'Envoyer', close: 'Fermer', tg: 'Continuer sur Telegram', manager: 'Conseiller', deck: 'PDF · présentation', open: 'Ouvrir',
    typing: (n) => `${n} écrit`, retry: 'Connexion perdue. Renvoyer', rate: 'Trop de messages. Réessayez dans une minute.', aiErr: 'Désolée, je n’ai pas pu répondre. Réessayez ou appelez le +998 93 566 45 01.',
    note: 'Opératrice virtuelle · prix HT', moved: 'La conversation continue sur Telegram', teaser: 'Une question sur les prix ou les emplacements ? Écrivez, je réponds tout de suite.',
  },
  it: {
    sub: 'Online · fai una domanda', status: 'Online · Orient Advertising', today: 'Oggi',
    hello: (n) => `Salve! Sono ${n} di Orient Advertising 👋\n\nChiedimi degli schermi in aeroporto, da Korzinka, nei ristoranti e in 11 regioni: prezzi, pubblico, location. Cosa vorresti pubblicizzare?`,
    chips: ['Quali sono i prezzi?', 'Pubblicità in aeroporto', 'Schermi Korzinka', 'Richiamatemi'],
    ph: 'Scrivi un messaggio…', send: 'Invia', close: 'Chiudi', tg: 'Continua su Telegram', manager: 'Manager', deck: 'PDF · presentazione', open: 'Apri',
    typing: (n) => `${n} sta scrivendo`, retry: 'Connessione persa. Invia di nuovo', rate: 'Troppi messaggi. Riprova tra un minuto.', aiErr: 'Spiacente, non sono riuscita a rispondere. Riprova o chiama il +998 93 566 45 01.',
    note: 'Operatrice virtuale · prezzi IVA esclusa', moved: 'La conversazione continua su Telegram', teaser: 'Una domanda su prezzi o location? Scrivi, rispondo subito.',
  },
  ko: {
    sub: '온라인 · 문의하기', status: '온라인 · Orient Advertising', today: '오늘',
    hello: (n) => `안녕하세요! Orient Advertising의 ${n}입니다 👋\n\n공항, Korzinka, 레스토랑, 11개 지역의 스크린 광고에 대해 물어보세요: 가격, 타깃, 위치. 어떤 제품을 광고하고 싶으신가요?`,
    chips: ['가격이 얼마인가요?', '공항 광고', 'Korzinka 스크린', '전화 주세요'],
    ph: '메시지를 입력하세요…', send: '보내기', close: '닫기', tg: 'Telegram에서 계속하기', manager: '매니저', deck: 'PDF · 소개 자료', open: '열기',
    typing: (n) => `${n} 입력 중`, retry: '연결이 끊겼어요. 다시 보내기', rate: '메시지가 너무 많아요. 1분 후 다시 보내주세요.', aiErr: '죄송해요, 지금은 답변할 수 없어요. 다시 시도하거나 +998 93 566 45 01로 전화해 주세요.',
    note: '가상 상담원 · 가격은 부가세 별도', moved: '대화는 Telegram에서 계속됩니다', teaser: '가격이나 위치가 궁금하신가요? 메시지를 남겨 주시면 바로 답변드려요.',
  },
};
const code = () => lang()?.code ?? 'uz';
const s = () => S[code()] ?? S.en;
const opName = () => OPERATOR[code()] ?? OPERATOR.name;
const initial = () => [...opName()][0].toUpperCase();

const ICON = {
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.2 4.3 2.9 11.4c-.9.3-.9 1.6 0 1.9l4.5 1.5 1.7 5.3c.2.7 1.1.9 1.6.4l2.6-2.6 4.6 3.4c.6.4 1.4.1 1.6-.6l3-14.6c.2-.9-.6-1.5-1.3-1.2z"/><path d="m7.4 14.8 10.5-7-8.1 8.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
  person: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 19.5c.9-3.4 3.7-5.2 7-5.2s6.1 1.8 7 5.2"/></svg>',
};

const KEY = 'oa-chat';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* The operator writes light Markdown: bold, italics, links, bullets. Escaped first, then marked up. */
function md(text) {
  const inline = (line) => {
    let h = esc(line)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/(^|[\s(])[*_](?!\s)([^*_\n]+?)[*_](?=[\s).,!?:;]|$)/g, '$1<i>$2</i>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    // bare addresses and phone numbers outside the links already made
    h = h.split(/(<a [^>]*>.*?<\/a>)/).map((part, i) => (i % 2 ? part : part
      .replace(/https?:\/\/[^\s<]+[^\s<.,!?;:)]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u.replace(/^https?:\/\//, '')}</a>`)
      .replace(/\+998[\d\s-]{8,14}\d/g, (p) => `<a href="tel:${p.replace(/[^\d+]/g, '')}">${p}</a>`))).join('');
    return h;
  };
  return String(text).split('\n').map((line) => {
    if (!line.trim()) return '<span class="oc-gap"></span>';
    const li = line.match(/^\s*(?:[•\-–*]|\d+[.)])\s+(.*)$/);
    return li ? `<span class="oc-li">${inline(li[1])}</span>` : `<span class="oc-p">${inline(line)}</span>`;
  }).join('');
}
// a message as a person sends it: paragraph by paragraph, each its own bubble (a list stays one), at most three
const parts = (text) => {
  const paras = String(text).split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return paras.length <= 3 ? paras : [...paras.slice(0, 2), paras.slice(2).join('\n\n')];
};

// a local backend for development (set in localStorage), never in a build
const API = (import.meta.env.DEV && (() => { try { return localStorage.getItem('oa-chat-api'); } catch (e) { return null; } })()) || LEAD_API;
const post = async (path, body, timeout = 15000) => {
  const r = await fetch(`${API}/api/chat/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeout) });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, ok: r.ok, ...j };
};

export function initChat() {
  if (!API || document.querySelector('.oc-fab')) return;
  const saved = load();
  const st = {
    token: saved.token || null, log: Array.isArray(saved.log) ? saved.log : [], live: !!saved.live, telegram: !!saved.telegram,
    open: false, sending: false, busy: false, unread: 0, pending: null, notice: null, poll: 0, shown: 0, active: Date.now(),
  };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify({ token: st.token, log: st.log.slice(-80), live: st.live, telegram: st.telegram })); } catch (e) { /* private mode */ } };
  const lastId = () => st.log.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0);
  st.shown = lastId();
  const touch = matchMedia('(hover: none)').matches;
  const root = document.documentElement;
  const avatar = (cls = '') => `<span class="oc-av ${cls}" aria-hidden="true">${esc(initial())}</span>`;

  /* ---------- the corner capsule, the nudge and the panel ---------- */
  const fab = document.createElement('button');
  fab.className = 'oc-fab';
  fab.type = 'button';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');

  const teaser = document.createElement('div');
  teaser.className = 'oc-teaser';
  teaser.hidden = true;

  const panel = document.createElement('section');
  panel.className = 'oc-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'ocTitle');
  panel.innerHTML = `
    <header class="oc-head">
      <span class="oc-head-av"></span>
      <div class="oc-who"><b id="ocTitle"></b><small><i class="oc-dot"></i><span class="oc-status"></span></small></div>
      <a class="oc-icon oc-tg" href="${BOT_URL}" target="_blank" rel="noopener">${ICON.tg}</a>
      <button class="oc-icon oc-x" type="button">${ICON.x}</button>
    </header>
    <div class="oc-body" data-lenis-prevent><div class="oc-list" role="log" aria-live="polite"></div></div>
    <form class="oc-form" autocomplete="off">
      <input class="oc-trap" name="website" tabindex="-1" aria-hidden="true">
      <div class="oc-input">
        <textarea rows="1" maxlength="2000"></textarea>
        <button class="oc-send" type="submit" disabled>${ICON.up}</button>
      </div>
      <p class="oc-note"></p>
    </form>`;
  document.body.append(teaser, fab, panel);
  root.classList.add('has-chat');

  const list = panel.querySelector('.oc-list');
  const body = panel.querySelector('.oc-body');
  const form = panel.querySelector('.oc-form');
  const input = form.querySelector('textarea');
  const sendBtn = form.querySelector('.oc-send');
  const trap = form.querySelector('.oc-trap');
  const tgLink = panel.querySelector('.oc-tg');

  // the explore button stands beside this one, whatever this one's width in the current language
  const measure = () => root.style.setProperty('--chat-w', `${fab.offsetWidth + 10}px`);
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(fab);

  const labels = () => {
    const L = s();
    const n = opName();
    fab.innerHTML = `${avatar('oc-av--fab')}<span class="oc-fab-t"><b>${esc(n)}</b><small>${esc(L.sub)}</small></span><b class="oc-badge" hidden></b>`;
    fab.setAttribute('aria-label', `${n} · ${L.sub}`);
    teaser.innerHTML = `<button class="oc-teaser-open" type="button">${avatar()}<span><b>${esc(n)} <em>· Orient Advertising</em></b><span>${esc(L.teaser)}</span></span></button><button class="oc-teaser-x" type="button" aria-label="${esc(L.close)}">${ICON.x}</button>`;
    panel.querySelector('.oc-head-av').innerHTML = avatar('oc-av--head');
    panel.querySelector('#ocTitle').textContent = n;
    panel.querySelector('.oc-status').textContent = L.status;
    panel.querySelector('.oc-x').setAttribute('aria-label', L.close);
    tgLink.title = L.tg;
    tgLink.setAttribute('aria-label', L.tg);
    input.placeholder = L.ph;
    sendBtn.setAttribute('aria-label', L.send);
    panel.querySelector('.oc-note').textContent = L.note;
    badge();
    measure();
  };

  /* ---------- the conversation ---------- */
  // what the list shows, in order: the operator's (and managers') messages split into bubbles, the visitor's, decks
  function items() {
    const out = [];
    const op = (text, id, fresh, extra = {}) => parts(text).forEach((p, i) => out.push({ kind: extra.kind ?? 'op', html: md(p), key: `${id}.${i}`, fresh, delay: i, ...extra }));
    op(s().hello(opName()), 'hello', false);
    st.log.forEach((m) => {
      const fresh = Number(m.id) > st.shown;
      if (m.role === 'deck') out.push({ kind: 'deck', m, fresh });
      else if (m.role === 'user') out.push({ kind: 'me', html: esc(m.text).replace(/\n/g, '<br>'), fresh, failed: m.failed });
      else op(m.text, m.id, fresh, m.role === 'manager' ? { kind: 'mgr' } : {});
    });
    if (st.pending) out.push({ kind: 'me', html: esc(st.pending.text).replace(/\n/g, '<br>'), fresh: true, tmp: true, failed: st.pending.failed });
    return out;
  }
  function draw(it, next, prev) {
    const L = s();
    const anim = it.fresh ? ` is-new" style="animation-delay:${(it.delay ?? 0) * 0.32}s` : '';
    if (it.kind === 'deck') {
      const m = it.m;
      return `<a class="oc-deck${anim}" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="oc-deck-ico">${ICON.pdf}</span><span class="oc-deck-t"><b>${esc(m.name)}</b><small>${esc(L.deck)}</small></span><span class="oc-deck-go">${ICON.go}</span></a>`;
    }
    if (it.kind === 'me') {
      const fail = it.failed ? `<button class="oc-retry" type="button">${esc(L.retry)}</button>` : '';
      return `<div class="oc-row oc-row--me${it.tmp ? ' is-tmp' : ''}${anim}"><div class="oc-bubble">${it.html}</div>${fail}</div>`;
    }
    // the operator's avatar sits by the last bubble of each run, as in a messenger
    const last = !next || next.kind !== it.kind;
    const first = !prev || prev.kind !== it.kind;
    const label = it.kind === 'mgr' && first ? `<span class="oc-from"><i></i>${esc(L.manager)}</span>` : '';
    const face = it.kind === 'mgr' ? `<span class="oc-av oc-av--mgr" aria-hidden="true">${ICON.person}</span>` : avatar();
    return `<div class="oc-row oc-row--${it.kind}${first ? ' is-first' : ''}${last ? ' is-last' : ''}${anim}">${last ? face : '<span class="oc-av-gap"></span>'}<div class="oc-col">${label}<div class="oc-bubble">${it.html}</div></div></div>`;
  }

  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 120;
  function render({ jump = false } = {}) {
    const L = s();
    const stick = jump || nearBottom();
    const all = items();
    const html = [`<p class="oc-day"><span>${esc(L.today)}</span></p>`];
    all.forEach((it, i) => {
      html.push(draw(it, all[i + 1], all[i - 1]));
      // the quick questions belong right under the greeting, until the visitor has written
      if (i === 1 && !st.log.length && !st.pending) html.push(`<div class="oc-chips">${L.chips.map((c) => `<button type="button" class="oc-chip"><i></i>${esc(c)}</button>`).join('')}</div>`);
    });
    if (st.sending || st.busy) html.push(`<div class="oc-row oc-row--op is-last oc-typing">${avatar()}<div class="oc-col"><div class="oc-bubble"><i></i><i></i><i></i></div><span class="oc-typing-t">${esc(L.typing(opName()))}</span></div></div>`);
    if (st.notice) html.push(`<p class="oc-notice">${esc(st.notice)}</p>`);
    if (st.telegram) html.push(`<a class="oc-moved" href="${BOT_URL}" target="_blank" rel="noopener">${ICON.tg}<span>${esc(L.moved)}</span></a>`);
    list.innerHTML = html.join('');
    st.shown = Math.max(st.shown, lastId());
    if (stick) requestAnimationFrame(() => body.scrollTo({ top: body.scrollHeight, behavior: jump ? 'auto' : 'smooth' }));
  }

  // the server's messages join the log (by id: a message seen twice is kept once)
  function merge(messages = []) {
    const have = new Set(st.log.map((m) => m.id));
    const fresh = messages.filter((m) => !have.has(m.id));
    if (fresh.length) st.log = [...st.log, ...fresh].sort((a, b) => a.id - b.id).slice(-80);
    return fresh;
  }
  const apply = (j) => {
    if (j.token) st.token = j.token;
    if ('live' in j) st.live = !!j.live;
    if ('telegram' in j) st.telegram = !!j.telegram;
  };

  async function send(text) {
    text = text.trim();
    if (!text || st.sending) return;
    st.notice = null;
    st.active = Date.now();
    st.pending = { id: `tmp${Date.now()}`, role: 'user', text, tmp: true };
    st.sending = true;
    render({ jump: true });
    try {
      const j = await post('send', { token: st.token, text, after: lastId(), lang: code(), page: location.href, website: trap.value }, 45000);
      if (j.status === 429) { st.pending = null; st.notice = s().rate; return; }
      if (!j.ok) throw new Error(String(j.status));
      apply(j);
      merge(j.messages);
      st.pending = null;
      if (j.error === 'rate') st.notice = s().rate;
      if (j.error === 'ai') st.notice = s().aiErr;
      st.busy = !!j.busy;
    } catch (e) {
      if (st.pending) st.pending.failed = true;
    } finally {
      st.sending = false;
      persist();
      render();
      schedule();
    }
  }

  async function sync() {
    if (!st.token) return [];
    try {
      const j = await post('history', { token: st.token, after: lastId() });
      if (j.token === null) { Object.assign(st, { token: null, log: [], live: false, telegram: false }); persist(); render(); return []; }
      apply(j);
      const fresh = merge(j.messages);
      const heard = fresh.filter((m) => m.role !== 'user');
      if (heard.length) st.busy = false;
      if (fresh.length) {
        persist();
        if (st.open) render();
        else if (heard.length) { st.unread += heard.length; badge(); }
      }
      return fresh;
    } catch (e) { return []; }
  }

  /* A person may be writing besides the operator (a manager answering the visitor, or another tab's answer on its
     way): the widget listens, quickly while the chat is open, slowly while it is closed, and less and less as the
     visit goes quiet; a hidden tab does not listen at all. */
  function schedule() {
    clearTimeout(st.poll);
    if (!st.token || !(st.live || st.busy) || document.visibilityState !== 'visible') return;
    const idleFor = Date.now() - st.active;
    const ms = st.busy ? 3000 : st.open ? (idleFor < 10 * 60_000 ? 6000 : 20000) : idleFor < 10 * 60_000 ? 20000 : 60000;
    if (!st.open && !st.busy && idleFor > 2 * 3600_000) return;
    st.poll = setTimeout(async () => { await sync(); schedule(); }, ms);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.live) sync(); schedule(); });

  function badge() {
    const b = fab.querySelector('.oc-badge');
    if (!b) return;
    b.hidden = !st.unread;
    b.textContent = st.unread > 9 ? '9+' : String(st.unread);
  }

  /* ---------- opening and closing ---------- */
  let vv = null;
  const fit = () => {
    // a phone's keyboard shrinks the visual viewport: the panel follows it so the input stays in sight
    if (!window.visualViewport || innerWidth > 700) { panel.style.removeProperty('--oc-vh'); panel.style.removeProperty('--oc-top'); return; }
    panel.style.setProperty('--oc-vh', `${visualViewport.height}px`);
    panel.style.setProperty('--oc-top', `${visualViewport.offsetTop}px`);
  };
  function open() {
    if (st.open) return;
    st.open = true;
    st.active = Date.now();
    hideTeaser(true);
    st.unread = 0;
    badge();
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    root.classList.add('chat-open');
    fit();
    if (window.visualViewport && !vv) { vv = fit; visualViewport.addEventListener('resize', vv); visualViewport.addEventListener('scroll', vv); }
    render({ jump: true });
    requestAnimationFrame(() => panel.classList.add('is-on'));
    if (!touch) setTimeout(() => input.focus({ preventScroll: true }), 260);
    sync().then(() => render());
    schedule();
  }
  function close() {
    if (!st.open) return;
    st.open = false;
    panel.classList.remove('is-on');
    fab.setAttribute('aria-expanded', 'false');
    root.classList.remove('chat-open');
    if (vv) { visualViewport.removeEventListener('resize', vv); visualViewport.removeEventListener('scroll', vv); vv = null; }
    setTimeout(() => { if (!st.open) panel.hidden = true; }, 380);
    fab.focus({ preventScroll: true });
    schedule();
  }
  fab.addEventListener('click', () => (st.open ? close() : open()));
  panel.querySelector('.oc-x').addEventListener('click', close);
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  /* ---------- typing ---------- */
  const grow = () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
    sendBtn.disabled = !input.value.trim();
  };
  input.addEventListener('input', grow);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !touch && !e.isComposing) { e.preventDefault(); form.requestSubmit(); }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value;
    if (!text.trim() || st.sending) return;
    input.value = '';
    grow();
    send(text);
  });
  list.addEventListener('click', (e) => {
    const chip = e.target.closest('.oc-chip');
    if (chip) return send(chip.textContent);
    if (e.target.closest('.oc-retry') && st.pending) { const { text } = st.pending; st.pending = null; send(text); }
  });

  // "Telegram": the conversation so far goes with the visitor (a one-time link made on the spot)
  tgLink.addEventListener('click', async (e) => {
    if (!st.token || st.telegram) return;
    e.preventDefault();
    const w = window.open('', '_blank');
    let url = BOT_URL;
    try { const j = await post('telegram', { token: st.token }); if (j.url) url = j.url; } catch (err) { /* the bot itself */ }
    if (w) { w.opener = null; w.location.href = url; } else location.href = url;
  });

  /* ---------- a gentle nudge, once in a while ---------- */
  let teaserTimer = 0;
  function hideTeaser(forGood) {
    clearTimeout(teaserTimer);
    teaser.classList.remove('is-on');
    setTimeout(() => { teaser.hidden = true; }, 400);
    if (forGood) try { localStorage.setItem(`${KEY}-nudge`, String(Date.now())); } catch (e) { /* fine */ }
  }
  teaser.addEventListener('click', (e) => {
    if (e.target.closest('.oc-teaser-x')) return hideTeaser(true);
    if (e.target.closest('.oc-teaser-open')) open();
  });
  const lastNudge = (() => { try { return Number(localStorage.getItem(`${KEY}-nudge`)) || 0; } catch (e) { return 0; } })();
  if (!st.log.length && Date.now() - lastNudge > 3 * 24 * 3600_000) {
    teaserTimer = setTimeout(() => {
      if (st.open || root.classList.contains('is-intro')) return;
      teaser.hidden = false;
      requestAnimationFrame(() => teaser.classList.add('is-on'));
      teaserTimer = setTimeout(() => hideTeaser(false), 14000);
    }, 20000);
  }

  labels();
  onLang(() => { labels(); if (st.open) render(); });
  requestAnimationFrame(() => fab.classList.add('is-in'));
  schedule();
  if (/^#chat\b/.test(location.hash) || new URLSearchParams(location.search).has('chat')) open();
  return { open, close };
}
