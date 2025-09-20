/* ======================================================================
   MindChatBot – main client script (calendar, chat, notes)  (MOBILE-READY)
   - Mobile tab navigation (Mood / Journal / Chat) if #mobile-tabs exists
   - Desktop three-column layout on large screens
   - No double chat replies when saving notes
   - i18n-aware UI messages via window.I18N + ?lang= + <html lang="">
   ====================================================================== */

/* ===== Mood palettes ===== */
const CATEGORY_BASE = { bad:'#FF3B30', poor:'#FF9F0A', neutral:'#D1D5DB', good:'#34C759', best:'#0A84FF' };
const MOOD_COLOR_MAP = {
  best:{ proud:'#00E6D0', grateful:'#00B8FF', energetic:'#4D7CFE', excited:'#A259FF', fulfilled:'#FF66C4' },
  good:{ calm:'#6EE7B7', productive:'#34D399', hopeful:'#10B981', motivated:'#22C55E', friendly:'#A3E635' },
  neutral:{ indifferent:'#E5E7EB', blank:'#D1D5DB', tired:'#BFC5CD', bored:'#9AA3AE', quiet:'#6B7280' },
  poor:{ frustrated:'#FFE08A', overwhelmed:'#FFD166', nervous:'#FFB020', insecure:'#FF9F0A', confused:'#FF7A00' },
  bad:{ angry:'#FF6B6B', sad:'#FF3B30', lonely:'#E11D48', anxious:'#C81E1E', hopeless:'#8B0000' }
};
const MOOD_MAP = {
  best:["proud","grateful","energetic","excited","fulfilled"],
  good:["calm","productive","hopeful","motivated","friendly"],
  neutral:["indifferent","blank","tired","bored","quiet"],
  poor:["frustrated","overwhelmed","nervous","insecure","confused"],
  bad:["angry","sad","lonely","anxious","hopeless"]
};

/* ===== i18n helper ===== */
function t(key, fallback){
  return (window.I18N && typeof window.I18N[key] === 'string') ? window.I18N[key] : fallback;
}
function currentLocale(){
  const urlLang = new URLSearchParams(location.search).get('lang');
  return (urlLang || document.documentElement.lang || navigator.language || 'en').toLowerCase();
}
function capitalize(s){ return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
function subMoodLabel(code){ return t(`mood.sub.${code}`, capitalize(code)); }
function pageLang() {
  const q = new URLSearchParams(location.search).get('lang');
  const html = (document.documentElement.lang || '').toLowerCase();
  return (q || html || 'en').split('-')[0]; // -> 'ko', 'ru', 'en'
}
const LANG = pageLang();

/* ===== Per-user chat history ===== */
const CHAT_NS = "chatMessages_v4_";
let IDENTITY = { key: `guest:${getDeviceId()}`, email: null, uid: null, token: null };

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
      const uniq = (p.id || p.email || p.username || "").toString().toLowerCase().trim();
      if (uniq) { setIdentity(`user:${uniq}`, p.email ?? null, p.id ?? null, localStorage.getItem("authToken") || null); return true; }
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
  setIdentity(`guest:${getDeviceId()}`, null, null, localStorage.getItem("authToken") || null);
}
function storageKey() { return CHAT_NS + IDENTITY.key; }
function getUserIdFromToken() { return { userId: IDENTITY.key, token: IDENTITY.token }; }

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
    el.style.borderColor = 'var(--ios-separator)';
  }else{
    el.style.backgroundColor = color;
    const text = getReadableTextColor(color);
    el.style.color = text;
    el.style.borderColor = (text === '#111') ? 'rgba(0,0,0,.08)' : 'rgba(255,255,255,.35)';
  }
  el.title = (mainMood || '') + (subMood ? (': ' + subMood) : '');
}

/* ===== Dedupe guards to avoid double requests/replies ===== */
let __noteSubmitBusy = false;
let __moodSaveBusy  = false;
let __lastMoodSig   = ""; // "YYYY-M-D:main/sub"

/* ===== One-reply popup (reply happens ONLY after mood save) ===== */
function showRecognizedMoodPopup(moodObj) {
  document.getElementById("recognized-mood-popup")?.remove();

  const popup = document.createElement("div");
  popup.id = "recognized-mood-popup";
  Object.assign(popup.style, {
    position:"fixed", inset:"0", background:"rgba(0,0,0,.35)",
    display:"flex", alignItems:"center", justifyContent:"center", zIndex:"9999"
  });

  const box = document.createElement("div");
  Object.assign(box.style, {
    background:"#fff", color:"#111", padding:"24px 20px",
    borderRadius:"16px", border:"1px solid #E5E5EA",
    boxShadow:"0 4px 24px rgba(0,0,0,.18)", textAlign:"center",
    maxWidth:"420px", width:"92%"
  });

  const dateStr = `${moodObj.year}-${String(moodObj.month).padStart(2,'0')}-${String(moodObj.day).padStart(2,'0')}`;
  box.innerHTML = `
    <h3 style="margin:0 0 10px 0;font-weight:800;">${t('popup_title','AI Mood Suggestion')}</h3>
    <div style="font-size:16px;margin-bottom:8px;">${t('popup_for','AI recognized your mood for')} <b>${dateStr}</b>:</div>
    <div style="font-size:20px;font-weight:800;margin-bottom:14px;">${moodObj.main} / ${moodObj.sub}</div>
    <div style="margin-bottom:16px;color:#3A3A3C">${t('mood_popup_confirm','Save this?')}</div>
    <div style="display:flex;gap:10px;justify-content:center;">
      <button id="accept-mood-btn" class="stylish-btn" style="padding:10px 18px;border-radius:12px;">${t('popup_save','Save')}</button>
      <button id="decline-mood-btn" class="stylish-btn" data-variant="gray" style="padding:10px 18px;border-radius:12px;">${t('popup_cancel','Cancel')}</button>
    </div>
  `;
  popup.appendChild(box);
  document.body.appendChild(popup);

  const acceptBtn = document.getElementById("accept-mood-btn");
  document.getElementById("decline-mood-btn").onclick = () => popup.remove();

  acceptBtn.onclick = async () => {
    if (__moodSaveBusy) return;
    __moodSaveBusy = true;
    acceptBtn.disabled = true;

// inside acceptBtn.onclick in showRecognizedMoodPopup(...)
const payload = {
  year:  moodObj.year,
  month: moodObj.month,
  day:   moodObj.day,
  emoji: moodObj.main,
  subMood: moodObj.sub,
  lang: LANG
};

res = await fetch('/user/moods/save', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept-Language': LANG,             // 👈 force server language
    ...(token && { "Authorization": `Bearer ${token}` })
  },
  body: JSON.stringify(payload),
  credentials: 'same-origin'
});


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
      alert(t('network_note','An error occurred while saving the note.'));
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

    // paint calendar if current month
    try {
      const curYear  = parseInt(document.getElementById("current-month")?.dataset.year, 10);
      const curMonth = parseInt(document.getElementById("current-month")?.dataset.month, 10); // 0-based
      if (curYear === payload.year && (curMonth + 1) === payload.month) {
        document.querySelectorAll("#calendar .calendar-day").forEach(el => {
          if (parseInt(el.dataset.day, 10) === payload.day) {
            const clr = (MOOD_COLOR_MAP[payload.emoji]?.[payload.subMood]) ?? CATEGORY_BASE[payload.emoji] ?? '';
            applyDayColor(el, clr, payload.emoji, payload.subMood);
          }
        });
      }
    } catch {}

    // EXACTLY ONE bot reply (from mood save)
    if (data && typeof data.reply === "string" && data.reply.trim()) {
      await addBotMessageTyping(data.reply.trim());
    } else {
      await addBotMessageTyping(t('mood_saved','Your mood has been saved.'));
    }

    __moodSaveBusy = false;
    popup.remove();
  };
}

/* ===== App boot ===== */
document.addEventListener("DOMContentLoaded", async function () {
  await initIdentity();

  const locale = currentLocale();

  /* ——— Localize weekday header (Mon-first) ——— */
  renderWeekdayHeader(locale);

  /* ——— Mobile tab navigation (if present) ——— */
  const tabsBar = document.getElementById("mobile-tabs");
  const sections = {
    mood: document.getElementById("mood-tracker"),
    journal: document.getElementById("journaling"),
    chat: document.getElementById("chat-section"),
  };
  const mq = window.matchMedia("(max-width: 860px)");

  function setActiveTab(name) {
    if (!sections[name]) return;
    Object.keys(sections).forEach(k => {
      sections[k].classList.toggle("hidden", k !== name && mq.matches);
    });
    document.querySelectorAll(".mobile-tab").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === name);
      btn.setAttribute('aria-selected', btn.dataset.tab === name ? 'true' : 'false');
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
      Object.values(sections).forEach(s => s?.classList.remove("hidden"));
    }
  }
  mq.addEventListener?.("change", handleLayoutChange);
  handleLayoutChange();

  /* ——— Inputs / chat ——— */
  document.getElementById("user-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("send-btn")?.addEventListener("click", sendMessage);

  /* === Note Form (guarded) === */
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

      // ensure date
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

        const ct = (res.headers.get("content-type") || "").toLowerCase();
        let data;
        if (ct.includes("application/json")) {
          data = JSON.parse(bodyText || "{}");
        } else {
          try { data = JSON.parse(bodyText || "{}"); }
          catch {
            console.error("Expected JSON but got:", bodyText.slice(0, 500));
            alert(t('unexpected_server','Server returned an unexpected response while saving the note.'));
            __noteSubmitBusy = false;
            return;
          }
        }

        form.reset();

        // No bot reply here; we reply after mood save only.
        if (data.mood &&
            data.mood.main && data.mood.sub &&
            data.mood.year && data.mood.month && data.mood.day) {
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
    const { token } = getUserIdFromToken();
    const url = `/user/moods/fetch?year=${year}&month=${month + 1}`;
    const res = await fetch(url, {
      headers: { 'Accept-Language': LANG, ...(token && { "Authorization": `Bearer ${token}` }) },
      cache: "no-store"
    });
    if (!res.ok) { console.error("fetchMoods failed", res.status); return []; }
    return res.json();
  }

  function clearSubMoodUI() {
    const container = document.getElementById("submood-buttons-container");
    if (container) container.style.display = 'none';
    const emotionBtns = document.getElementById("emotion-buttons");
    if (emotionBtns) emotionBtns.style.display = 'flex';
  }

  async function updateCalendar() {
    const locale = currentLocale();
    // header (localized)
    currentMonthElement.textContent = new Date(currentYear, currentMonth).toLocaleString(locale, { month: 'long', year: 'numeric' });
    currentMonthElement.dataset.year = currentYear;
    currentMonthElement.dataset.month = currentMonth;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7; // Monday-first
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const savedMoods = await fetchMoods(currentYear, currentMonth);

    const nodes = [];
    for (let i = 0; i < startDay; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.classList.add("calendar-day", "empty");
      nodes.push(emptyCell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const dayElement = document.createElement("div");
      dayElement.classList.add("calendar-day");
      dayElement.textContent = day;
      dayElement.dataset.day = day;

      const mood = savedMoods.find(m => m.day === day);
      if (mood) {
        let color = '';
        if (mood.emoji && mood.subMood && MOOD_COLOR_MAP[mood.emoji]?.[mood.subMood]) {
          color = MOOD_COLOR_MAP[mood.emoji][mood.subMood];
        } else if (mood.emoji) {
          color = CATEGORY_BASE[mood.emoji] || '';
        }
        applyDayColor(dayElement, color, mood.emoji, mood.subMood);
      }

      dayElement.addEventListener("click", () => { selectDay(dayElement); clearSubMoodUI(); });
      nodes.push(dayElement);
    }

    calendar.replaceChildren(...nodes);
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
});

/* ===== Localize weekday header (Mon-first) ===== */
function renderWeekdayHeader(locale){
  const container = document.querySelector(".calendar-weekdays");
  if (!container) return;
  // Build Monday-first labels using Intl
  const base = new Date(Date.UTC(2024, 0, 1)); // arbitrary Monday reference week
  // Find Monday (getUTCDay(): 0=Sun..6=Sat)
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
  const messagesDiv = document.getElementById("messages");
  const bubble = document.createElement("div");
  bubble.className = "message bot typing";
  const dots = document.createElement("div");
  dots.className = "typing-dots";
  dots.innerHTML = `<span class="dot"></span><span class="dot"></span><span class="dot"></span>`;
  bubble.appendChild(dots);
  messagesDiv.appendChild(bubble);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  return { el:bubble };
}
async function typewriter(targetEl, text, { min=16, max=28 } = {}){
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce){ targetEl.textContent = text; return; }
  targetEl.textContent = "";
  for (let i = 0; i < text.length; i++) {
    targetEl.textContent += text[i];
    await sleep(Math.random()*(max-min)+min);
  }
}

/* ===== Chat persistence ===== */
async function addBotMessageTyping(text){
  const typing = createTypingIndicator();
  const think = Math.min(900, 200 + Math.floor(text.length * 4));
  await sleep(think);

  const msg = document.createElement("div");
  msg.className = "message bot";
  typing.el.replaceWith(msg);
  await typewriter(msg, text);

  const key = storageKey();
  const messages = JSON.parse(localStorage.getItem(key) || "[]");
  messages.push({ sender:"bot", text, t: Date.now() });
  localStorage.setItem(key, JSON.stringify(messages.slice(-10)));
}
function addMessage(sender, text) {
  const messagesDiv = document.getElementById("messages");
  const messageElement = document.createElement("div");
  messageElement.classList.add("message", sender);
  messageElement.textContent = text;
  messagesDiv.appendChild(messageElement);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  const key = storageKey();
  const messages = JSON.parse(localStorage.getItem(key) || "[]");
  messages.push({ sender, text, t: Date.now() });
  localStorage.setItem(key, JSON.stringify(messages.slice(-10)));
}
function loadLastChatMessages(forceClear = false) {
  const messagesDiv = document.getElementById("messages");
  if (!messagesDiv) return;
  if (forceClear) messagesDiv.innerHTML = '';

  const key = storageKey();
  const messages = JSON.parse(localStorage.getItem(key) || "[]").slice(-10);
  messages.forEach(msg => {
    const el = document.createElement("div");
    el.classList.add("message", msg.sender);
    el.textContent = msg.text;
    messagesDiv.appendChild(el);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
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

/* ===== Manual submood path (localized labels) ===== */
window.showSubMoodButtons = function(mainMood) {
  const container = document.getElementById("submood-buttons-container");
  if (!container) return;
  container.innerHTML = '';
  const submoods = MOOD_MAP[mainMood];
  const colors = MOOD_COLOR_MAP[mainMood];
  submoods.forEach((subMood) => {
    const btn = document.createElement('button');
    btn.className = 'submood-btn';
    btn.textContent = subMoodLabel(subMood);   // localized label
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

  // dedupe manual saves too
  const sig = `${mood.year}-${mood.month}-${mood.day}:${mood.emoji}/${mood.subMood}`;
  if (sig === __lastMoodSig) return;
  __lastMoodSig = sig;

  // instant paint
  let color = MOOD_COLOR_MAP[emoji]?.[subMood] ?? CATEGORY_BASE[emoji] ?? '';
  applyDayColor(selectedDayElement, color, emoji, subMood);

  let res;
  try {
    res = await fetch('/user/moods/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': LANG,
        ...(token && { "Authorization": `Bearer ${token}` })
      },
      body: JSON.stringify(mood)
    });
  } catch (e) { console.error("Network error", e); alert(t('network_note','An error occurred while saving the note.')); return; }

  if (!res.ok) {
    const text = await res.text();
    console.error("Save failed", res.status, text);
    alert(t('failed_save_mood','Failed to save mood.'));
    return;
  }

  const replyData = await res.json().catch(()=> ({}));
  await addBotMessageTyping(replyData.reply || t('mood_saved','Your mood has been saved.'));
}

/* ===== Chat send ===== */
async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
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
      body: JSON.stringify({ message, userId, lang: LANG })
    });
    const data = await response.json().catch(()=> ({}));
    await addBotMessageTyping(data.response || ("⚠️ " + (data.error || "Unknown server response.")));
  } catch (err) {
    console.error("send error", err);
    await addBotMessageTyping(t('server_error','⚠️ Server error occurred.'));
  }
}
