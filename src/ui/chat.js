import '../styles/chat.css';
import mark from '../assets/oa-mark.svg?raw';
import { lang, onLang } from '../i18n/index.js';
import { BOT_URL, LEAD_API } from '../data/inventory.js';

/* The AI chat in the corner of the site: the same assistant as the Telegram bot (the CRM worker's /api/chat), one
   conversation per visitor, kept in their browser by a signed token. A manager's replies appear here too; "Telegram"
   moves the whole conversation into the bot. Loaded as its own chunk once the page is idle, so the chart never waits. */

const S = {
  uz: {
    fab: 'AI-yordamchi', status: 'Onlayn · 24/7',
    hello: 'Assalomu alaykum! 👋 Men Orient Advertising’ning AI-yordamchisiman. Aeroport, Korzinka, restoranlar va 11 ta hududdagi ekranlar — narxlar, auditoriya va joylar haqida so‘rang.',
    chips: ['Narxlar qancha?', 'Aeroportda reklama', 'Korzinka ekranlari', 'Menejer bilan bog‘lanish'],
    ph: 'Savolingizni yozing…', send: 'Yuborish', close: 'Yopish', tg: 'Suhbatni Telegram’da davom ettirish',
    manager: 'Menejer', deck: 'Taqdimot · PDF', open: 'Ochish', thinking: 'Javob tayyorlanmoqda…', retry: 'Aloqa uzildi. Qayta yuborish',
    rate: 'Juda ko‘p xabar. Bir daqiqadan so‘ng yozing.', aiErr: 'Kechirasiz, hozir javob bera olmadim. Qayta yozing yoki +998 93 566 45 01 raqamiga qo‘ng‘iroq qiling.',
    note: 'AI xato qilishi mumkin · narxlar QQSsiz', moved: 'Suhbat Telegram’da davom etmoqda', teaser: 'Savolingiz bormi? Narxlarni bir daqiqada aytib beraman.',
  },
  ru: {
    fab: 'AI-ассистент', status: 'Онлайн · 24/7',
    hello: 'Здравствуйте! 👋 Я AI-ассистент Orient Advertising. Спросите об экранах в аэропорту, Korzinka, ресторанах и 11 регионах — цены, аудитория, площадки.',
    chips: ['Сколько стоит?', 'Реклама в аэропорту', 'Экраны в Korzinka', 'Связаться с менеджером'],
    ph: 'Напишите вопрос…', send: 'Отправить', close: 'Закрыть', tg: 'Продолжить диалог в Telegram',
    manager: 'Менеджер', deck: 'Презентация · PDF', open: 'Открыть', thinking: 'Готовлю ответ…', retry: 'Нет связи. Отправить ещё раз',
    rate: 'Слишком много сообщений. Напишите через минуту.', aiErr: 'Извините, не получилось ответить. Напишите ещё раз или позвоните: +998 93 566 45 01.',
    note: 'AI может ошибаться · цены без НДС', moved: 'Диалог продолжается в Telegram', teaser: 'Есть вопросы? Подскажу цены за минуту.',
  },
  en: {
    fab: 'AI assistant', status: 'Online · 24/7',
    hello: 'Hello! 👋 I’m Orient Advertising’s AI assistant. Ask me about screens at the airport, in Korzinka, restaurants and 11 regions — prices, audience, venues.',
    chips: ['What are the prices?', 'Airport advertising', 'Korzinka screens', 'Talk to a manager'],
    ph: 'Type your question…', send: 'Send', close: 'Close', tg: 'Continue the chat in Telegram',
    manager: 'Manager', deck: 'Presentation · PDF', open: 'Open', thinking: 'Preparing an answer…', retry: 'Connection lost. Send again',
    rate: 'Too many messages. Please write again in a minute.', aiErr: 'Sorry, I couldn’t answer just now. Please try again or call +998 93 566 45 01.',
    note: 'AI can make mistakes · prices excl. VAT', moved: 'The conversation continues in Telegram', teaser: 'Questions? I’ll give you prices in a minute.',
  },
  ar: {
    fab: 'المساعد الذكي', status: 'متصل · 24/7',
    hello: 'مرحبًا! 👋 أنا المساعد الذكي لـ Orient Advertising. اسألني عن الشاشات في المطار وKorzinka والمطاعم و11 منطقة — الأسعار والجمهور والمواقع.',
    chips: ['ما هي الأسعار؟', 'الإعلان في المطار', 'شاشات Korzinka', 'التواصل مع مدير'],
    ph: 'اكتب سؤالك…', send: 'إرسال', close: 'إغلاق', tg: 'متابعة المحادثة في Telegram',
    manager: 'مدير', deck: 'عرض تقديمي · PDF', open: 'فتح', thinking: 'جارٍ إعداد الرد…', retry: 'انقطع الاتصال. إعادة الإرسال',
    rate: 'رسائل كثيرة جدًا. اكتب بعد دقيقة.', aiErr: 'عذرًا، لم أتمكن من الرد الآن. حاول مجددًا أو اتصل على ‎+998 93 566 45 01.',
    note: 'قد يخطئ الذكاء الاصطناعي · الأسعار بدون ضريبة', moved: 'تستمر المحادثة في Telegram', teaser: 'لديك سؤال؟ سأخبرك بالأسعار خلال دقيقة.',
  },
  zh: {
    fab: 'AI 助手', status: '在线 · 24/7',
    hello: '您好！👋 我是 Orient Advertising 的 AI 助手。欢迎咨询机场、Korzinka 超市、餐厅及 11 个地区的屏幕广告——价格、受众和点位。',
    chips: ['价格是多少？', '机场广告', 'Korzinka 屏幕', '联系经理'],
    ph: '输入您的问题…', send: '发送', close: '关闭', tg: '在 Telegram 继续对话',
    manager: '经理', deck: '介绍资料 · PDF', open: '打开', thinking: '正在准备回复…', retry: '连接中断，重新发送',
    rate: '消息过多，请一分钟后再试。', aiErr: '抱歉，暂时无法回复。请重试或致电 +998 93 566 45 01。',
    note: 'AI 可能出错 · 价格不含增值税', moved: '对话已转到 Telegram', teaser: '有问题吗？一分钟告诉您价格。',
  },
  tr: {
    fab: 'AI asistan', status: 'Çevrimiçi · 7/24',
    hello: 'Merhaba! 👋 Ben Orient Advertising’in AI asistanıyım. Havalimanı, Korzinka, restoranlar ve 11 bölgedeki ekranlar hakkında sorun — fiyatlar, kitle, lokasyonlar.',
    chips: ['Fiyatlar ne kadar?', 'Havalimanında reklam', 'Korzinka ekranları', 'Yöneticiyle görüşmek'],
    ph: 'Sorunuzu yazın…', send: 'Gönder', close: 'Kapat', tg: 'Sohbete Telegram’da devam et',
    manager: 'Yönetici', deck: 'Sunum · PDF', open: 'Aç', thinking: 'Yanıt hazırlanıyor…', retry: 'Bağlantı kesildi. Tekrar gönder',
    rate: 'Çok fazla mesaj. Bir dakika sonra yazın.', aiErr: 'Üzgünüm, şu an yanıt veremedim. Tekrar deneyin ya da +998 93 566 45 01 numarasını arayın.',
    note: 'AI hata yapabilir · fiyatlara KDV dahil değil', moved: 'Sohbet Telegram’da devam ediyor', teaser: 'Sorunuz mu var? Fiyatları bir dakikada söyleyeyim.',
  },
  fr: {
    fab: 'Assistant IA', status: 'En ligne · 24h/24',
    hello: 'Bonjour ! 👋 Je suis l’assistant IA d’Orient Advertising. Posez-moi vos questions sur les écrans à l’aéroport, chez Korzinka, dans les restaurants et 11 régions — prix, audience, emplacements.',
    chips: ['Quels sont les prix ?', 'Publicité à l’aéroport', 'Écrans Korzinka', 'Parler à un conseiller'],
    ph: 'Écrivez votre question…', send: 'Envoyer', close: 'Fermer', tg: 'Continuer la conversation sur Telegram',
    manager: 'Conseiller', deck: 'Présentation · PDF', open: 'Ouvrir', thinking: 'Je prépare la réponse…', retry: 'Connexion perdue. Renvoyer',
    rate: 'Trop de messages. Réessayez dans une minute.', aiErr: 'Désolé, je n’ai pas pu répondre. Réessayez ou appelez le +998 93 566 45 01.',
    note: 'L’IA peut se tromper · prix HT', moved: 'La conversation continue sur Telegram', teaser: 'Une question ? Les prix en une minute.',
  },
  it: {
    fab: 'Assistente IA', status: 'Online · 24 ore su 24',
    hello: 'Salve! 👋 Sono l’assistente IA di Orient Advertising. Chiedimi degli schermi in aeroporto, da Korzinka, nei ristoranti e in 11 regioni — prezzi, pubblico, location.',
    chips: ['Quali sono i prezzi?', 'Pubblicità in aeroporto', 'Schermi Korzinka', 'Parlare con un manager'],
    ph: 'Scrivi la tua domanda…', send: 'Invia', close: 'Chiudi', tg: 'Continua la chat su Telegram',
    manager: 'Manager', deck: 'Presentazione · PDF', open: 'Apri', thinking: 'Sto preparando la risposta…', retry: 'Connessione persa. Invia di nuovo',
    rate: 'Troppi messaggi. Riprova tra un minuto.', aiErr: 'Spiacente, non sono riuscito a rispondere. Riprova o chiama il +998 93 566 45 01.',
    note: 'L’IA può sbagliare · prezzi IVA esclusa', moved: 'La conversazione continua su Telegram', teaser: 'Domande? Ti dico i prezzi in un minuto.',
  },
  ko: {
    fab: 'AI 상담', status: '온라인 · 24시간',
    hello: '안녕하세요! 👋 Orient Advertising AI 상담원입니다. 공항, Korzinka, 레스토랑, 11개 지역의 스크린 광고 — 가격, 타깃, 위치를 물어보세요.',
    chips: ['가격이 얼마인가요?', '공항 광고', 'Korzinka 스크린', '매니저와 상담'],
    ph: '질문을 입력하세요…', send: '보내기', close: '닫기', tg: 'Telegram에서 대화 계속하기',
    manager: '매니저', deck: '소개 자료 · PDF', open: '열기', thinking: '답변을 준비하고 있어요…', retry: '연결이 끊겼어요. 다시 보내기',
    rate: '메시지가 너무 많아요. 1분 후 다시 보내주세요.', aiErr: '죄송해요, 지금은 답변할 수 없어요. 다시 시도하거나 +998 93 566 45 01로 전화해 주세요.',
    note: 'AI는 실수할 수 있어요 · 가격은 부가세 별도', moved: '대화는 Telegram에서 계속됩니다', teaser: '궁금한 점이 있으신가요? 1분 만에 가격을 알려드려요.',
  },
};
const s = () => S[lang()?.code] ?? S.en;

const ICON = {
  chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5z"/><path class="oc-spark" d="M12.4 7.6l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>',
  tg: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21.2 4.3 2.9 11.4c-.9.3-.9 1.6 0 1.9l4.5 1.5 1.7 5.3c.2.7 1.1.9 1.6.4l2.6-2.6 4.6 3.4c.6.4 1.4.1 1.6-.6l3-14.6c.2-.9-.6-1.5-1.3-1.2z"/><path d="m7.4 14.8 10.5-7-8.1 8.6"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  go: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>',
};

const KEY = 'oa-chat';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || {}; } catch (e) { return {}; } };
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/* The assistant writes light Markdown: bold, italics, links, bullets. Escaped first, then marked up. */
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

  /* ---------- the corner button, the nudge and the panel ---------- */
  const fab = document.createElement('button');
  fab.className = 'oc-fab';
  fab.type = 'button';
  fab.setAttribute('aria-haspopup', 'dialog');
  fab.setAttribute('aria-expanded', 'false');
  fab.innerHTML = `<span class="oc-fab-ico">${ICON.chat}<i class="oc-online"></i></span><span class="oc-fab-label"></span><b class="oc-badge" hidden></b>`;

  const teaser = document.createElement('div');
  teaser.className = 'oc-teaser';
  teaser.hidden = true;
  teaser.innerHTML = '<button class="oc-teaser-open" type="button"><span class="oc-ava oc-ava--sm"></span><span class="oc-teaser-text"></span></button><button class="oc-teaser-x" type="button"></button>';
  teaser.querySelector('.oc-ava').innerHTML = mark;
  teaser.querySelector('.oc-teaser-x').innerHTML = ICON.x;

  const panel = document.createElement('section');
  panel.className = 'oc-panel';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-labelledby', 'ocTitle');
  panel.innerHTML = `
    <header class="oc-head">
      <span class="oc-ava">${mark}</span>
      <div class="oc-who"><b id="ocTitle">Orient AI</b><small><i class="oc-online"></i><span class="oc-status"></span></small></div>
      <a class="oc-tg" href="${BOT_URL}" target="_blank" rel="noopener">${ICON.tg}<span>Telegram</span></a>
      <button class="oc-x" type="button">${ICON.x}</button>
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
    fab.querySelector('.oc-fab-label').textContent = L.fab;
    fab.setAttribute('aria-label', L.fab);
    teaser.querySelector('.oc-teaser-text').textContent = L.teaser;
    teaser.querySelector('.oc-teaser-x').setAttribute('aria-label', L.close);
    panel.querySelector('.oc-status').textContent = L.status;
    panel.querySelector('.oc-x').setAttribute('aria-label', L.close);
    tgLink.title = L.tg;
    tgLink.setAttribute('aria-label', L.tg);
    input.placeholder = L.ph;
    sendBtn.setAttribute('aria-label', L.send);
    panel.querySelector('.oc-note').textContent = L.note;
    measure();
  };

  /* ---------- the conversation ---------- */
  const bubble = (m, fresh) => {
    const cls = fresh ? ' is-new' : '';
    if (m.role === 'deck') {
      return `<a class="oc-deck${cls}" href="${esc(m.url)}" target="_blank" rel="noopener"><span class="oc-deck-ico">${ICON.pdf}</span><span class="oc-deck-t"><b>${esc(m.name)}</b><small>${esc(s().deck)}</small></span><span class="oc-deck-go">${esc(s().open)}${ICON.go}</span></a>`;
    }
    if (m.role === 'user') {
      const fail = m.failed ? `<button class="oc-retry" type="button">${esc(s().retry)}</button>` : '';
      return `<div class="oc-msg oc-msg--me${m.tmp ? ' is-tmp' : ''}${cls}"><div class="oc-bubble">${esc(m.text).replace(/\n/g, '<br>')}</div>${fail}</div>`;
    }
    const who = m.role === 'manager' ? `<span class="oc-from">${esc(s().manager)}</span>` : '';
    return `<div class="oc-msg oc-msg--${m.role === 'manager' ? 'mgr' : 'ai'}${cls}">${who}<div class="oc-bubble">${md(m.text)}</div></div>`;
  };

  const nearBottom = () => body.scrollHeight - body.scrollTop - body.clientHeight < 120;
  function render({ jump = false } = {}) {
    const L = s();
    const stick = jump || nearBottom();
    const parts = [`<div class="oc-msg oc-msg--ai oc-hello"><div class="oc-bubble">${md(L.hello)}</div></div>`];
    if (!st.log.length && !st.pending) parts.push(`<div class="oc-chips">${L.chips.map((c) => `<button type="button" class="oc-chip">${esc(c)}</button>`).join('')}</div>`);
    st.log.forEach((m) => parts.push(bubble(m, Number(m.id) > st.shown)));
    if (st.pending) parts.push(bubble(st.pending, true));
    if (st.sending || st.busy) parts.push(`<div class="oc-msg oc-msg--ai oc-typing"><div class="oc-bubble"><i></i><i></i><i></i><span>${esc(L.thinking)}</span></div></div>`);
    if (st.notice) parts.push(`<p class="oc-notice">${esc(st.notice)}</p>`);
    if (st.telegram) parts.push(`<a class="oc-moved" href="${BOT_URL}" target="_blank" rel="noopener">${ICON.tg}<span>${esc(L.moved)}</span></a>`);
    list.innerHTML = parts.join('');
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
      const j = await post('send', { token: st.token, text, after: lastId(), lang: lang()?.code, page: location.href, website: trap.value }, 45000);
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

  /* A person may be writing besides the AI (a manager answering the visitor, or another tab's answer on its way):
     the widget listens, quickly while the chat is open, slowly while it is closed, and less and less as the visit goes
     quiet; a hidden tab does not listen at all. */
  function schedule() {
    clearTimeout(st.poll);
    if (!st.token || !(st.live || st.busy) || document.visibilityState !== 'visible') return;
    const idleFor = Date.now() - st.active;
    let ms = st.busy ? 3000 : st.open ? (idleFor < 10 * 60_000 ? 6000 : 20000) : idleFor < 10 * 60_000 ? 20000 : 60000;
    if (!st.open && !st.busy && idleFor > 2 * 3600_000) return;
    st.poll = setTimeout(async () => { await sync(); schedule(); }, ms);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && st.live) sync(); schedule(); });

  const badge = () => {
    const b = fab.querySelector('.oc-badge');
    b.hidden = !st.unread;
    b.textContent = st.unread > 9 ? '9+' : String(st.unread);
  };

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
  teaser.querySelector('.oc-teaser-open').addEventListener('click', open);
  teaser.querySelector('.oc-teaser-x').addEventListener('click', () => hideTeaser(true));
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
  badge();
  onLang(() => { labels(); if (st.open) render(); });
  requestAnimationFrame(() => fab.classList.add('is-in'));
  schedule();
  if (/^#chat\b/.test(location.hash) || new URLSearchParams(location.search).has('chat')) open();
  return { open, close };
}
