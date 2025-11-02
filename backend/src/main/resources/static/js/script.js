/* ======================================================================
   MindChatBot – main client script (calendar, chat, notes)  (MOBILE-READY)
   Pencil-light theme adjustments:
   - Monochrome UI; color only for moods/submoods
   - Popup + borders use CSS variables (no hard-coded dark colors)
   - Fix: applyDayColor fallback border uses --line
   - A11y/UX: keyboard focus for calendar cells, ESC/overlay close for popup
   - Pencil “coloring” animation on submood save (.save-pulse) with final paint
   - Pastel mood palettes
   - Streak modal (gratitude/awareness) — not a chat message
   ====================================================================== */
"use strict";

/* ===== Mood palettes (PASTEL) ===== */
const CATEGORY_BASE = {
  bad:     '#FFCACA',
  poor:    '#FFE4B8',
  neutral: '#E9EDF2',
  good:    '#CFEFD9',
  best:    '#CDE2FF'
};
const MOOD_COLOR_MAP = {
  best:{
    proud:     '#AFECE6',
    grateful:  '#BDE4FF',
    energetic: '#C6D3FF',
    excited:   '#DCCBFF',
    fulfilled: '#FFC9E9'
  },
  good:{
    calm:       '#D8F6E9',
    productive: '#CFECE0',
    hopeful:    '#CFEFE7',
    motivated:  '#D6F4DD',
    friendly:   '#E3F7B8'
  },
  neutral:{
    indifferent:'#F1F3F6',
    blank:      '#E7EAF0',
    tired:      '#E3E8EE',
    bored:      '#D7DFE8',
    quiet:      '#CBD3DD'
  },
  poor:{
    frustrated:'#FFEABF',
    overwhelmed:'#FFE5B3',
    nervous:   '#FFDBAC',
    insecure:  '#FFD5A6',
    confused:  '#FFCE9F'
  },
  bad:{
    angry:   '#FFB8B8',
    sad:     '#FFABAB',
    lonely:  '#F3B4C3',
    anxious: '#E9B2B4',
    hopeless:'#D6A5A7'
  }
};
const MOOD_MAP = {
  best:["proud","grateful","energetic","excited","fulfilled"],
  good:["calm","productive","hopeful","motivated","friendly"],
  neutral:["indifferent","blank","tired","bored","quiet"],
  poor:["frustrated","overwhelmed","nervous","insecure","confused"],
  bad:["angry","sad","lonely","anxious","hopeless"]
};
/* expose to HTML helpers */
window.MOOD_COLOR_MAP = MOOD_COLOR_MAP;
window.CATEGORY_BASE = CATEGORY_BASE;
function getCsrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null; // CookieCsrfTokenRepository sets this cookie
}
/* ===== i18n ===== */
function t(key, fallback){
  return (window.I18N && typeof window.I18N[key] === 'string') ? window.I18N[key] : fallback;
}
function currentLocale(){
  const urlLang = new URLSearchParams(location.search).get('lang');
  return (urlLang || document.documentElement.lang || navigator.language || 'en').toLowerCase();
}
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function subMoodLabel(code){ return t(`mood.sub.${code}`, capitalize(code)); }
window.subMoodLabel = subMoodLabel;
function pageLang() {
  const q = new URLSearchParams(location.search).get('lang');
  const html = (document.documentElement.lang || '').toLowerCase();
  return (q || html || 'en').split('-')[0];
}
const LANG = pageLang();

/* ===== Identity & chat storage ===== */
const CHAT_NS = "chatMessages_v4_";
let IDENTITY = { key: 'initial', email: null, uid: null, token: null };
function getDeviceId() {
  let id = localStorage.getItem("deviceId");
  if (!id) {
    id = (crypto?.randomUUID?.() || Math.random().toString(36).slice(2)) + Date.now().toString(36);
    localStorage.setItem("deviceId", id);
  }
  return id;
}
function tryDecodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1];
    const json = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch { return null; }
}
function setIdentity(nextKey, email=null, uid=null, token=null) {
  const prevKey = IDENTITY.key;
  IDENTITY = { key: nextKey, email, uid, token };
  if (prevKey !== nextKey) loadLastChatMessages(true);
}
async function refreshIdentityFromProfile() {
  try {
    const r = await fetch("/user/profile", {
      method: "GET",
      headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
      credentials: "same-origin",
      cache: "no-store",
    });
    if (r.ok) {
      const p = await r.json();

      // --- THIS IS THE FIX ---
      // We must consistently use EMAIL as the unique ID for chat logs.
      const email = (p.email || "").toString().toLowerCase().trim();

      if (email) {
        // Set IDENTITY.uid to the email, not p.id
        setIdentity(`user:${email}`, p.email ?? null, p.email ?? null, localStorage.getItem("authToken") || null);
        return true;
      }
    }
  } catch {}
  return false;
}
function refreshIdentityFromToken() {
  const token = localStorage.getItem("authToken");
  if (!token) return false;
  const payload = tryDecodeJwtPayload(token);
  const uniq = (payload?.sub || payload?.email || payload?.userId || payload?.username || "")
    .toString().toLowerCase().trim();
  if (uniq) { setIdentity(`user:${uniq}`, payload?.email ?? null, payload?.userId ?? null, token); return true; }
  return false;
}
async function initIdentity() {
  if (await refreshIdentityFromProfile()) return;
  if (refreshIdentityFromToken()) return;
}
function storageKey() { return CHAT_NS + IDENTITY.key; }
function getUserIdFromToken() { return { userId: IDENTITY.key, token: IDENTITY.token }; }

/* ==================== Streak detection (main mood only) ==================== */
/* Trigger from the 3rd day onward and keep showing on 4,5,6,7… */
const MOOD_STREAK_THRESHOLD = 3; // >= 3 is a streak
const NEGATIVE_MOODS = new Set(['bad','poor']);
const POSITIVE_MOODS = new Set(['good','best']);
const NEUTRAL_MOODS  = new Set(['neutral']);

function ymdStr(y, m1, d){ return `${y}-${String(m1).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }
function prettyMainMood(m){
  return ({ bad:t('mood.bad','Bad'), poor:t('mood.poor','Poor'),
            neutral:t('mood.neutral','Neutral'),
            good:t('mood.good','Good'), best:t('mood.best','Best') })[m] || capitalize(m);
}
function moodHistoryKey(){ return `moodHistory_v1_${IDENTITY.key}`; }
function moodPromptKey(){ return `moodStreakPrompt_v1_${IDENTITY.key}`; }

function readMoodHistory(){
  try { return JSON.parse(localStorage.getItem(moodHistoryKey()) || '[]'); } catch { return []; }
}
function writeMoodHistory(arr){
  try { localStorage.setItem(moodHistoryKey(), JSON.stringify(arr.slice(-180))); } catch {}
}
function upsertMoodAndComputeStreak(dateStr, main){
  let hist = readMoodHistory();
  hist = hist.filter(e => e.d !== dateStr);
  hist.push({ d: dateStr, m: main });
  hist.sort((a,b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  writeMoodHistory(hist);
  let streak = 0;
  for (let i = hist.length - 1; i >= 0; i--){
    if (hist[i].m === main) streak++; else break;
  }
  return streak;
}
function seedMoodHistoryFromServer(monthItems, year, zeroBasedMonth){
  if (!Array.isArray(monthItems)) return;
  let hist = readMoodHistory();
  monthItems.forEach(it => {
    if (!it || !it.day || !it.emoji) return;
    const d = ymdStr(year, zeroBasedMonth + 1, it.day);
    hist = hist.filter(e => e.d !== d);
    hist.push({ d, m: it.emoji });
  });
  hist.sort((a,b) => (a.d < b.d ? -1 : a.d > b.d ? 1 : 0));
  writeMoodHistory(hist);
}

/* ---------- Streak modal (popup window) ---------- */
(function ensureStreakStyles(){
  if (document.getElementById("streak-popup-css")) return;
  const link = document.createElement("link");
  link.id = "streak-popup-css";
  link.rel = "stylesheet";
  link.href = "/css/streak-popup.css?v=1";
  document.head.appendChild(link);
})();

function closeStreakModal(){
  const overlay = document.getElementById("streak-modal-overlay");
  overlay?.classList.add("closing");
  setTimeout(()=> overlay?.remove(), 220);
}

function prefillJournal(dateStr, template){
  const note = document.getElementById("note-content");
  const date = document.getElementById("note-date");
  try {
    if (dateStr && date) date.value = dateStr;
    if (note) {
      const prev = (note.value || "").trim();
      note.value = prev ? (prev + "\n\n" + template) : template;
      note.focus();
      note.setSelectionRange(note.value.length, note.value.length);
    }
    const journaling = document.getElementById("journaling");
    journaling?.scrollIntoView({ behavior:"smooth", block:"start" });
  } catch {}
}

/* —— FLEXIBLE COUNT: always show current streak number on the popup —— */
function openStreakModal({ main, streak, dateStr }){
  document.getElementById("streak-modal-overlay")?.remove();

  const type = NEGATIVE_MOODS.has(main) ? "negative" :
               POSITIVE_MOODS.has(main) ? "positive" : "neutral";

  const moodLabel = prettyMainMood(main);
  const title = ({
    negative: t('streak.title.neg','Awareness Check-in'),
    positive: t('streak.title.pos','Gratitude Moment'),
    neutral:  t('streak.title.neu','Gentle Nudge')
  })[type];

  // Base subtitle text (localized, no number inside)
  const baseSub = ({
    negative: t('streak.msg.neg', `You've logged ${moodLabel} for ${streak} days in a row.`),
    positive: t('streak.msg.pos',  `Nice streak — ${moodLabel} for ${streak} days!`),
    neutral:  t('streak.msg.neu',  `You’ve been feeling ${moodLabel} for ${streak} days.`)
  })[type];

  // Neutral numeric chip that works across languages (🔥 3, 4, 5, …)
  const N = Number(streak || 0).toLocaleString(LANG || 'en');
  const countChip = `<span class="streak-count-bubble" aria-label="streak">🔥 ${N}</span>`;

  const suggestion = ({
    negative: t('streak.sugg.neg','Try a 60-second grounding: breathe in 4 • hold 4 • out 6 — and note one thing that feels safe right now.'),
    positive: t('streak.sugg.pos','Capture one thing you’re grateful for today. Tiny is perfect.'),
    neutral:  t('streak.sugg.neu','Pick a tiny action: 1 glass of water, 3 deep breaths, or a 2-minute stretch.')
  })[type];

  const overlay = document.createElement("div");
  overlay.id = "streak-modal-overlay";
  overlay.className = "streak-overlay";
  overlay.setAttribute("role","dialog");
  overlay.setAttribute("aria-modal","true");

  const card = document.createElement("div");
  card.className = `streak-card ${type}`;
  card.innerHTML = `
    <div class="streak-sketch"></div>
    <button class="streak-close" type="button" aria-label="${t('close','Close')}">×</button>
    <div class="streak-icon">${type==='positive'?'🌈': type==='negative'?'🫶':'🧭'}</div>
    <h3 class="streak-title">${title}</h3>
    <div class="streak-sub">${baseSub} ${countChip}</div>
    <div class="streak-tip">${suggestion}</div>

    <div class="streak-actions">
      ${
        type==='positive'
          ? `<button class="stylish-btn streak-primary" type="button" data-act="gratitude">${t('streak.btn.grat','Write gratitude')}</button>`
          : type==='negative'
            ? `<button class="stylish-btn streak-primary" type="button" data-act="ground">${t('streak.btn.ground','Do 60s grounding')}</button>`
            : `<button class="stylish-btn streak-primary" type="button" data-act="tiny">${t('streak.btn.tiny','Try tiny habit')}</button>`
      }
      <button class="stylish-btn" data-variant="gray" type="button" data-act="later">${t('streak.btn.later','Remind me later')}</button>
    </div>

    <div class="streak-mini hidden" id="streak-mini-exercise">
      <div class="breath-circle" aria-hidden="true"></div>
      <div class="breath-caption">${t('streak.breath.caption','Inhale 4 • Hold 4 • Exhale 6')}</div>
    </div>
  `;

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  function onOverlayClick(e){ if (e.target === overlay) closeStreakModal(); }
  function onEsc(e){ if (e.key === "Escape") { closeStreakModal(); document.removeEventListener("keydown", onEsc); } }

  overlay.addEventListener("click", onOverlayClick);
  document.addEventListener("keydown", onEsc);
  card.querySelector(".streak-close").addEventListener("click", closeStreakModal);

  const mini = card.querySelector("#streak-mini-exercise");

  card.querySelectorAll(".streak-actions .stylish-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const act = btn.getAttribute("data-act");
      if (act === "gratitude") {
        prefillJournal(dateStr, t('streak.template.grat','Today I’m grateful for: '));
        closeStreakModal();
      } else if (act === "ground") {
        mini?.classList.remove("hidden");
        mini?.scrollIntoView({ behavior:"smooth", block:"center" });
      } else if (act === "tiny") {
        prefillJournal(dateStr, t('streak.template.tiny','Tiny habit I’ll try: '));
        closeStreakModal();
      } else {
        closeStreakModal();
      }
    });
  });
}

/* Keep prompting once per day when the streak is at/above threshold (3,4,5,…) */
async function maybePromptForStreak(main, streak, dateStr){
  if (streak < MOOD_STREAK_THRESHOLD) return;
  try { if (localStorage.getItem(moodPromptKey()) === dateStr) return; } catch {}
  openStreakModal({ main, streak, dateStr });
  try { localStorage.setItem(moodPromptKey(), dateStr); } catch {}
}
/* ================== END streak logic ================== */

/* ===== Contrast + coloring ===== */
function getReadableTextColor(hex){
  if(!hex) return '#111';
  let h = hex.replace('#','');
  if(h.length===3) h = h.split('').map(c=>c+c).join('');
  const r = parseInt(h.slice(0,2),16)/255;
  const g = parseInt(h.slice(2,4),16)/255;
  const b = parseInt(h.slice(4,6),16)/255;
  const toLin = c => (c <= 0.03928) ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
  const L = 0.2126*toLin(r) + 0.7152*toLin(g) + 0.0722*toLin(b);
  return L > 0.55 ? '#111' : '#fff';
}
function applyDayColor(el, color, mainMood, subMood){
  if(!el) return;
  if(!color){
    el.style.backgroundColor = '';
    el.style.color = '';
    el.style.borderColor = 'var(--line)';
  }else{
    el.style.backgroundColor = color;
    const text = getReadableTextColor(color);
    el.style.color = text;
    el.style.borderColor = (text === '#111') ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.35)';
  }
  const subLabel = subMood ? subMoodLabel(subMood) : '';
  el.title = (mainMood || '') + (subLabel ? (': ' + subLabel) : '');
  el.setAttribute('aria-label', el.title);
}

/* ===== Set state + color + CSS var immediately ===== */
function setDayMoodState(el, mainMood, subMood, color){
  if (!el) return;
  if (mainMood) el.setAttribute('data-mood', mainMood);
  if (subMood)  el.setAttribute('data-submood', subMood);
  if (color)    el.style.setProperty('--mood-fill', color);
  applyDayColor(el, color, mainMood, subMood);
}

/* ===== Pencil-fill with “finalize paint” ===== */
function runPencilFill(el, finalColor){
  if (!el) return;
  el.classList.remove('save-pulse');
  void el.offsetWidth;
  el.classList.add('save-pulse');

  const finalize = () => {
    el.classList.remove('save-pulse');
    if (finalColor){
      el.style.removeProperty('background-image');
      el.style.backgroundColor = finalColor;
      requestAnimationFrame(() => {
        el.style.backgroundColor = finalColor;
        el.style.setProperty('--mood-fill', finalColor);
      });
      setTimeout(() => {
        el.style.backgroundColor = finalColor;
        el.style.setProperty('--mood-fill', finalColor);
      }, 60);
    }
  };

  const handler = (e) => {
    if (e.target === el && (e.animationName === 'pencil-fill-strong' || e.animationName === 'pencil-fill')){
      el.removeEventListener('animationend', handler);
      finalize();
    }
  };
  el.addEventListener('animationend', handler);
  setTimeout(finalize, 950);
}

/* ===== Dedupe guards ===== */
let __noteSubmitBusy = false;
let __moodSaveBusy  = false;
let __lastMoodSig   = "";

/* ===== Chat scroll helpers ===== */
function getMessagesEl(){
  return document.getElementById("messages") || document.querySelector(".messages");
}
function getChatScrollEl(){
  const msgs = getMessagesEl();
  if (msgs) return msgs;
  return document.querySelector(".chat-box");
}
function isNearBottom(scroller, threshold = 80){
  if (!scroller) return true;
  const distance = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
  return distance <= threshold;
}
function scrollToBottom({ force = false } = {}){
  const scroller = getChatScrollEl();
  if (!scroller) return;
  const shouldStick = force || isNearBottom(scroller);
  if (!shouldStick) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    });
  });
}

/* ===== One-reply popup (reply after mood save) ===== */
function showRecognizedMoodPopup(moodObj) {
  document.getElementById("recognized-mood-popup")?.remove();

  const popup = document.createElement("div");
  popup.id = "recognized-mood-popup";
  Object.assign(popup.style, {
    position:"fixed", inset:"0",
    background:"rgba(0,0,0,.22)",
    backdropFilter:"blur(2px)",
    WebkitBackdropFilter:"blur(2px)",
    display:"flex", alignItems:"center", justifyContent:"center", zIndex:"9999"
  });

  const box = document.createElement("div");
  box.setAttribute("role","dialog");
  box.setAttribute("aria-modal","true");
  Object.assign(box.style, {
    background:"var(--ios-card)", color:"var(--ios-text)", padding:"24px 20px",
    borderRadius:"16px", border:"2px solid var(--line)",
    boxShadow:"0 6px 14px rgba(0,0,0,.06), inset 0 1px 0 rgba(0,0,0,.06)",
    textAlign:"center",
    maxWidth:"420px", width:"92%", position:"relative", animation:"paper-pop .38s ease both"
  });

  const dateStr = `${moodObj.year}-${String(moodObj.month).padStart(2,'0')}-${String(moodObj.day).padStart(2,'0')}`;
  box.innerHTML = `
    <h3 style="margin:0 0 10px 0;font-weight:900;">${t('popup_title','AI Mood Suggestion')}</h3>
    <div style="font-size:16px;margin-bottom:8px;">${t('popup_for','AI recognized your mood for')} <b>${dateStr}</b>:</div>
    <div style="font-size:20px;font-weight:900;margin-bottom:14px;">${moodObj.main} / ${moodObj.sub}</div>
    <div style="margin-bottom:16px;color:var(--ios-subtext)">${t('mood_popup_confirm','Save this?')}</div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="accept-mood-btn" type="button" class="stylish-btn" style="padding:10px 18px;border-radius:12px;">${t('popup_save','Save')}</button>
      <button id="decline-mood-btn" type="button" class="stylish-btn" data-variant="gray" style="padding:10px 18px;border-radius:12px;">${t('popup_cancel','Cancel')}</button>
    </div>
  `;
  popup.appendChild(box);
  document.body.appendChild(popup);

  const close = () => popup.remove();
  const acceptBtn = document.getElementById("accept-mood-btn");
  document.getElementById("decline-mood-btn").onclick = close;
  popup.addEventListener("click", (e) => { if (e.target === popup) close(); });
  document.addEventListener("keydown", function esc(ev){
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", esc); }
  });

  acceptBtn.onclick = async () => {
    if (__moodSaveBusy) return;
    __moodSaveBusy = true;
    acceptBtn.disabled = true;

    const payload = {
      year:  moodObj.year,
      month: moodObj.month,
      day:   moodObj.day,
      emoji: moodObj.main,
      subMood: moodObj.sub,
      lang: LANG
    };

    const sig = `${payload.year}-${payload.month}-${payload.day}:${payload.emoji}/${payload.subMood}`;
    if (sig === __lastMoodSig) {
      __moodSaveBusy = false;
      acceptBtn.disabled = false;
      popup.remove();
      return;
    }

    const { token } = getUserIdFromToken();
    let res;
    try {
      res = await fetch('/user/moods/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept-Language': LANG,
          ...(token && { "Authorization": `Bearer ${token}` })
        },
        body: JSON.stringify(payload),
        credentials: 'same-origin'
      });
    } catch (e) {
      console.error("Network error saving mood:", e);
      alert(t('network_mood','An error occurred while saving the mood.'));
      __moodSaveBusy = false;
      acceptBtn.disabled = false;
      return;
    }

    if (!res.ok) {
      const tx = await res.text().catch(()=> '');
      console.error("Save mood failed", res.status, tx);
      alert(`Failed to save mood: ${res.status}`);
      __moodSaveBusy = false;
      acceptBtn.disabled = false;
      return;
    }

    __lastMoodSig = sig;
    const data = await res.json().catch(()=> ({}));

    // paint + animate calendar if current month
    try {
      const curYear  = parseInt(document.getElementById("current-month")?.dataset.year, 10);
      const curMonth = parseInt(document.getElementById("current-month")?.dataset.month, 10); // 0-based
      if (curYear === payload.year && (curMonth + 1) === payload.month) {
        const dayEl = document.querySelector(`#calendar .calendar-day[data-day="${payload.day}"]`);
        if (dayEl) {
          const clr = (MOOD_COLOR_MAP[payload.emoji]?.[payload.subMood]) ?? CATEGORY_BASE[payload.emoji] ?? '';
          setDayMoodState(dayEl, payload.emoji, payload.subMood, clr);
          runPencilFill(dayEl, clr);
        }
      }
    } catch {}

    await addBotMessageTyping((data && typeof data.reply === "string" && data.reply.trim()) ? data.reply.trim() : t('mood_saved','Your mood has been saved.'));

    /* streak modal after save */
    const savedDate = ymdStr(payload.year, payload.month, payload.day);
    const streakA = upsertMoodAndComputeStreak(savedDate, payload.emoji);
    await maybePromptForStreak(payload.emoji, streakA, savedDate);

    __moodSaveBusy = false;
    popup.remove();
  };
}

/* ===== App boot ===== */
document.addEventListener("DOMContentLoaded", async function () {
  await initIdentity();

  const locale = currentLocale();
  renderWeekdayHeader(locale);

  /* ——— Mobile tab navigation (if present) ——— */
  const tabsBar = document.getElementById("mobile-tabs");
  const sections = {
    mood: document.getElementById("mood-tracker"),
    journal: document.getElementById("journaling"),
    chat: document.getElementById("chat-section"),
  };
  const mq = window.matchMedia("(max-width: 860px)");

  function hide(el){ if(!el) return; el.classList.add('hidden'); el.setAttribute('aria-hidden','true'); }
  function show(el){ if(!el) return; el.classList.remove('hidden'); el.removeAttribute('aria-hidden'); }

  function setActiveTab(name) {
    if (!sections[name]) return;
    Object.keys(sections).forEach(k => {
      if (mq.matches) (k === name ? show : hide)(sections[k]); else show(sections[k]);
    });
    document.querySelectorAll(".mobile-tab").forEach(btn => {
      const active = btn.dataset.tab === name;
      btn.classList.toggle("active", active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    if (mq.matches) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabsBar?.addEventListener("click", (e) => {
    const btn = e.target.closest(".mobile-tab");
    if (!btn) return;
    setActiveTab(btn.dataset.tab);
    history.replaceState(null, "", `#${btn.dataset.tab}`);
  });

  function handleLayoutChange() {
    const hash = (location.hash || "").replace("#", "");
    const initial = (hash === "chat" || hash === "journal" || hash === "mood") ? hash : "mood";
    if (mq.matches) {
      tabsBar?.classList.remove("hidden");
      setActiveTab(initial);
    } else {
      tabsBar?.classList.add("hidden");
      Object.values(sections).forEach(s => show(s));
    }
  }
  mq.addEventListener?.("change", handleLayoutChange);
  handleLayoutChange();

  /* ——— Inputs / chat ——— */
  document.getElementById("user-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("send-btn")?.addEventListener("click", sendMessage);

  /* === Note Form === */
  const form = document.getElementById("new-note-form");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (__noteSubmitBusy) return;
      __noteSubmitBusy = true;

      const contentEl = document.getElementById("note-content");
      const dateEl = document.getElementById("note-date");
      const content = (contentEl?.value || "").trim();
      if (!content) { alert(t('write_something','Please write something first.')); __noteSubmitBusy = false; return; }

      let date = (dateEl?.value || "").trim();
      if (!date) {
        date = new Date().toISOString().slice(0, 10);
        if (dateEl) dateEl.value = date;
      }

      const { token } = getUserIdFromToken();

      try {
        const res = await fetch("/user/notes", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Accept-Language": LANG,
            ...(token && { "Authorization": `Bearer ${token}` })
          },
          body: JSON.stringify({ content, date, lang: LANG })
        });

        const bodyText = await res.text();

        if (!res.ok) {
          console.error("Save note failed:", res.status, bodyText);
          alert(res.status === 401 || res.status === 403 ? t('login_required','Please log in to save notes.') : t('failed_save_note','Failed to save note.'));
          __noteSubmitBusy = false;
          return;
        }

        let data;
        try { data = JSON.parse(bodyText || "{}"); }
        catch {
          console.error("Expected JSON but got:", bodyText.slice(0, 500));
          alert(t('unexpected_server','Server returned an unexpected response while saving the note.'));
          __noteSubmitBusy = false;
          return;
        }

        form.reset();

        if (data.mood && data.mood.main && data.mood.sub && data.mood.year && data.mood.month && data.mood.day) {
          showRecognizedMoodPopup(data.mood);
        } else {
          await addBotMessageTyping(t('note_saved','Note saved.'));
        }
      } catch (e) {
        console.error("Network/parse error saving note:", e);
        alert(t('network_note','An error occurred while saving the note.'));
      } finally {
        __noteSubmitBusy = false;
      }
    });
  }

  /* === Calendar === */
  const calendar = document.getElementById("calendar");
  const currentDateElement = document.getElementById("current-date");
  const prevMonthButton = document.getElementById("prev-month");
  const nextMonthButton = document.getElementById("next-month");
  const currentMonthElement = document.getElementById("current-month");
  let currentYear = new Date().getFullYear();
  let currentMonth = new Date().getMonth();

  async function fetchMoods(year, month) {
    try {
      const { token } = getUserIdFromToken();
      const url = `/user/moods/fetch?year=${year}&month=${month + 1}`;
      const res = await fetch(url, {
        headers: { 'Accept-Language': LANG, ...(token && { "Authorization": `Bearer ${token}` }) },
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!res.ok) { console.error("fetchMoods failed", res.status); return []; }
      return await res.json().catch(() => []);
    } catch (e) {
      console.error("fetchMoods error", e);
      return [];
    }
  }

  function clearSubMoodUI() {
    const container = document.getElementById("submood-buttons-container");
    if (container) container.style.display = 'none';
    const emotionBtns = document.getElementById("emotion-buttons");
    if (emotionBtns) emotionBtns.style.display = 'flex';
  }

  async function updateCalendar() {
    const locale = currentLocale();
    currentMonthElement.textContent = new Date(currentYear, currentMonth).toLocaleString(locale, { month: 'long', year: 'numeric' });
    currentMonthElement.dataset.year = currentYear;
    currentMonthElement.dataset.month = currentMonth;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const savedMoods = await fetchMoods(currentYear, currentMonth);

    /* seed client-side streak history */
    seedMoodHistoryFromServer(savedMoods, currentYear, currentMonth);

    const nodes = [];
    for (let i = 0; i < startDay; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.classList.add("calendar-day", "empty");
      emptyCell.setAttribute("aria-hidden","true");
      nodes.push(emptyCell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div");
      dayElement.classList.add("calendar-day");
      dayElement.textContent = day;
      dayElement.dataset.day = day;
      dayElement.tabIndex = 0;

      const mood = Array.isArray(savedMoods) ? savedMoods.find(m => m.day === day) : null;
      if (mood) {
        let color = '';
        if (mood.emoji && mood.subMood && MOOD_COLOR_MAP[mood.emoji]?.[mood.subMood]) {
          color = MOOD_COLOR_MAP[mood.emoji][mood.subMood];
        } else if (mood.emoji) {
          color = CATEGORY_BASE[mood.emoji] || '';
        }
        setDayMoodState(dayElement, mood.emoji, mood.subMood, color);
      }

      const choose = () => { selectDay(dayElement); clearSubMoodUI(); };
      dayElement.addEventListener("click", choose);
      dayElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); }
      });

      nodes.push(dayElement);
    }

    calendar.replaceChildren(...nodes);
    syncChatHeightToCalendar();
  }

  // Localize “Today: …”
  if (currentDateElement) {
    const locale = currentLocale();
    const todayStr = new Date().toLocaleDateString(locale, { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    currentDateElement.textContent = `${t('mood.today','Today:')} ${todayStr}`;
  }

  prevMonthButton?.addEventListener("click", () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    updateCalendar(); clearSubMoodUI();
  });
  nextMonthButton?.addEventListener("click", () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    updateCalendar(); clearSubMoodUI();
  });

  await updateCalendar();

  // per-identity history
  loadLastChatMessages(true);

  // keep chat stuck near bottom for any DOM changes
  ensureAutoStickAtBottom();

  // detect account switches
  window.addEventListener("focus", () => { refreshIdentityFromProfile(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshIdentityFromProfile(); });
  let __lastToken = localStorage.getItem("authToken") || null;
  setInterval(() => {
    const now = localStorage.getItem("authToken") || null;
    if (now !== __lastToken) {
      __lastToken = now;
      if (!refreshIdentityFromToken()) refreshIdentityFromProfile();
    }
  }, 800);

  // keep chat height synced with calendar on desktop (responsive)
  const calSection  = document.getElementById("mood-tracker");
  if (calSection) {
    const ro = new ResizeObserver(() => syncChatHeightToCalendar());
    ro.observe(calSection);
    window.addEventListener("resize", syncChatHeightToCalendar);
    window.addEventListener("orientationchange", syncChatHeightToCalendar);
  }
});

/* ===== Localize weekday header (Mon-first) ===== */
function renderWeekdayHeader(locale){
  const container = document.querySelector(".calendar-weekdays");
  if (!container) return;
  const base = new Date(Date.UTC(2024, 0, 1));
  const monday = new Date(base);
  const d = monday.getUTCDay();
  const offsetToMonday = ((1 - d) + 7) % 7;
  monday.setUTCDate(monday.getUTCDate() + offsetToMonday);

  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
  const labels = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + i);
    labels.push(fmt.format(day));
  }
  container.innerHTML = labels
    .map((lab, idx) => `<span${idx===6?' class="sunday"':''}>${lab}</span>`)
    .join('');
}

/* ===== Typing indicator + typewriter ===== */
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
function createTypingIndicator(){
  const messagesDiv = getMessagesEl();
  if (!messagesDiv) return { el: null };
  const bubble = document.createElement("div");
  bubble.className = "message bot typing";
  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  bubble.appendChild(dots);
  messagesDiv.appendChild(bubble);
  scrollToBottom({ force: true });
  return { el:bubble };
}
async function typewriter(targetEl, text, { min=16, max=28, onTick } = {}){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce){ targetEl.textContent = text; scrollToBottom({ force:true }); return; }
  targetEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    targetEl.textContent += text[i];
    if (onTick && (i % 3 === 0)) onTick(i);
    await sleep(Math.random()*(max-min)+min);
  }
  scrollToBottom({ force:true });
}function renderMessage(sender, text) {
   const messagesDiv = getMessagesEl();
   if (!messagesDiv) return null;

   const messageElement = document.createElement("div");
   messageElement.classList.add("message", sender);
   messageElement.textContent = text;
   messagesDiv.appendChild(messageElement);
   return messageElement;
 }

 async function addBotMessageTyping(text){
   const typing = createTypingIndicator();
   const think = Math.min(900, 200 + Math.floor(text.length * 4));
   await sleep(think);

   // Use the new helper to create the element
   const msg = renderMessage("bot", ""); // Start with empty text
   if (!msg) { // Guard if messagesDiv wasn't found
       typing.el?.remove();
       return;
   }

   typing.el?.replaceWith(msg);
   await typewriter(msg, text, { onTick: () => scrollToBottom() });

   // DO NOT save to localStorage here. The server already saved it.
 }

 function addMessage(sender, text) {
   // Use the new helper to render
   renderMessage(sender, text);
   scrollToBottom({ force:true });

   // DO NOT save to localStorage here. The server will save it.
 }

 async function loadLastChatMessages(forceClear = false) {
   const messagesDiv = getMessagesEl();
   if (!messagesDiv) return;

   if (forceClear) {
       messagesDiv.innerHTML = '';
   }

   // Get the current user's ID and token from our identity object
   const { uid, token } = IDENTITY;

   // Don't fetch history if we don't have a specific user ID (e.g., guest)
if (!uid || IDENTITY.key === 'initial') {
     return;
   }

   try {
     // Call the backend endpoint with the user's ID
     const res = await fetch(`/api/chat/history/${uid}`, {
       method: "GET",
       headers: {
         "Accept": "application/json",
         ...(token && { "Authorization": `Bearer ${token}` })
       },
       credentials: "same-origin",
       cache: "no-store", // Always get fresh history
     });

     if (!res.ok) {
       console.error("Failed to fetch chat history:", res.status, await res.text());
       return;
     }

     const history = await res.json(); // This is the List<ChatLog> from the server

     if (Array.isArray(history) && history.length > 0) {

       // Get only the last 5 messages from the full history
       const last5 = history.slice(-5);

       last5.forEach(msg => {
         // Render user message and bot response
         if (msg.message) {
           renderMessage("user", msg.message);
         }
         if (msg.response) {
           renderMessage("bot", msg.response);
         }
       });
     }

     scrollToBottom({ force: true }); // Scroll to bottom after loading

   } catch (e) {
     console.error("Error loading chat history:", e);
   }
 }

/* ===== Keep scroller stuck to bottom when new nodes appear ===== */
function ensureAutoStickAtBottom(){
  const messages = getMessagesEl();
  if (!messages) return;
  const obs = new MutationObserver(() => scrollToBottom());
  obs.observe(messages, { childList: true, subtree: true, characterData: true });
  window.addEventListener("resize", () => scrollToBottom());
  window.addEventListener("orientationchange", () => scrollToBottom({ force: true }));
}

/* ===== Calendar helpers ===== */
function selectDay(dayElement) {
  document.querySelectorAll(".calendar-day").forEach(el => el.classList.remove("selected"));
  dayElement.classList.add("selected");
  const noteDateInput = document.getElementById("note-date");
  if (noteDateInput) {
    const selectedDate = new Date();
    selectedDate.setFullYear(
      parseInt(document.getElementById("current-month").dataset.year, 10),
      parseInt(document.getElementById("current-month").dataset.month, 10),
      parseInt(dayElement.dataset.day, 10)
    );
    noteDateInput.value = selectedDate.toISOString().split('T')[0];
  }
}

/* ===== Manual submood path ===== */
window.showSubMoodButtons = function(mainMood) {
  const container = document.getElementById("submood-buttons-container");
  if (!container) return;
  container.innerHTML = '';
  const submoods = MOOD_MAP[mainMood] || [];
  const colors = MOOD_COLOR_MAP[mainMood] || {};
  submoods.forEach((subMood) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'submood-btn';
    btn.setAttribute('data-tone', mainMood);
    btn.textContent = subMoodLabel(subMood);
    const chip = document.createElement('span');
    chip.style.cssText='display:inline-block;width:8px;height:8px;border-radius:50%;margin-left:8px';
    chip.style.background = colors[subMood] || '#e5e7eb';
    btn.appendChild(chip);
    btn.onclick = function() { saveMoodWithSubMoodLive(mainMood, subMood); };
    container.appendChild(btn);
  });
  container.style.display = 'flex';
};

async function saveMoodWithSubMoodLive(emoji, subMood) {
  const selectedDayElement = document.querySelector(".calendar-day.selected");
  if (!selectedDayElement) { alert(t('select_date_first','Please select a date first.')); return; }

  const { token } = getUserIdFromToken();
  const day = parseInt(selectedDayElement.dataset.day, 10);
  const year = parseInt(document.getElementById("current-month").dataset.year, 10);
  const month = parseInt(document.getElementById("current-month").dataset.month, 10);
  const mood = { year, month: month + 1, day, emoji, subMood, lang: LANG };

  const sig = `${mood.year}-${mood.month}-${mood.day}:${mood.emoji}/${mood.subMood}`;
  if (sig === __lastMoodSig) return;
  __lastMoodSig = sig;

  // instant paint + animation
  const color = MOOD_COLOR_MAP[emoji]?.[subMood] ?? CATEGORY_BASE[emoji] ?? '';
  setDayMoodState(selectedDayElement, emoji, subMood, color);
  runPencilFill(selectedDayElement, color);

  let res;
  try {
    res = await fetch('/user/moods/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': LANG,
        ...(token && { "Authorization": `Bearer ${token}` })
      },
      body: JSON.stringify(mood),
      credentials: "same-origin"
    });
  } catch (e) {
    console.error("Network error", e);
    alert(t('network_mood','An error occurred while saving the mood.'));
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(()=> '');
    console.error("Save failed", res.status, text);
    alert(t('failed_save_mood','Failed to save mood.'));
    return;
  }

  const replyData = await res.json().catch(()=> ({}));
  await addBotMessageTyping(replyData.reply || t('mood_saved','Your mood has been saved.'));

  /* streak modal after save */
  const savedDate = ymdStr(mood.year, mood.month, mood.day);
  const streakB = upsertMoodAndComputeStreak(savedDate, mood.emoji);
  await maybePromptForStreak(mood.emoji, streakB, savedDate);
}

/* ===== Chat send ===== */
async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = (input?.value || "").trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";

  const { userId, token } = getUserIdFromToken();
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept-Language": LANG,
        ...(token && { "Authorization": `Bearer ${token}` })
      },
      body: JSON.stringify({ message, lang: LANG }),
      credentials: "same-origin"
    });
    const data = await response.json().catch(()=> ({}));
    await addBotMessageTyping(data.response || ("⚠️ " + (data.error || "Unknown server response.")));
  } catch (err) {
    console.error("send error", err);
    await addBotMessageTyping(t('server_error','⚠️ Server error occurred.'));
  } finally {
    scrollToBottom({ force:true });
  }
}

/* ===== Keep chat height aligned with calendar on desktop ===== */
function syncChatHeightToCalendar(){
  const desktop = window.matchMedia("(min-width: 861px)").matches;
  const chatSection = document.getElementById("chat-section");
  const calSection  = document.getElementById("mood-tracker");
  if (!chatSection || !calSection) return;

  if (!desktop){
    chatSection.style.height = "";
    return;
  }
  const h = Math.round(calSection.getBoundingClientRect().height);
  if (chatSection.__lastH !== h){
    chatSection.style.height = h + "px";
    chatSection.__lastH = h;
  }
}
