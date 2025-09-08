/* ===== STRICT per-user chat history (5 exchanges = 10 messages) ===== */

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
  if (prevKey !== nextKey) {
    // Swap UI to this user's last 5 exchanges right away
    loadLastChatMessages(true);
  }
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
      // Prefer DB id if you have it; else email/username
      const uniq = (p.id || p.email || p.username || "").toString().toLowerCase().trim();
      if (uniq) {
        setIdentity(`user:${uniq}`, p.email ?? null, p.id ?? null, localStorage.getItem("authToken") || null);
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
  if (uniq) {
    setIdentity(`user:${uniq}`, payload?.email ?? null, payload?.userId ?? null, token);
    return true;
  }
  return false;
}

async function initIdentity() {
  // 1) Prefer session /user/profile (form login paths)
  if (await refreshIdentityFromProfile()) return;
  // 2) Fallback to JWT if you use token auth
  if (refreshIdentityFromToken()) return;
  // 3) Guest per device
  setIdentity(`guest:${getDeviceId()}`, null, null, localStorage.getItem("authToken") || null);
}

function storageKey() { return CHAT_NS + IDENTITY.key; }
function getUserIdFromToken() { return { userId: IDENTITY.key, token: IDENTITY.token }; }

/* ===== Contrast helpers (unchanged) ===== */
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

/* ===== App boot ===== */
document.addEventListener("DOMContentLoaded", async function () {
  // Resolve identity BEFORE touching chat history
  await initIdentity();

  // Inputs
  document.getElementById("user-input")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
  document.getElementById("send-btn")?.addEventListener("click", sendMessage);

  // === Note form (unchanged) ===
  const form = document.getElementById("new-note-form");
  if (form) {
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const content = document.getElementById("note-content").value;
      const date = document.getElementById("note-date").value;
      const { token } = getUserIdFromToken();
      try {
        const response = await fetch("/user/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token && { "Authorization": `Bearer ${token}` }) },
          body: JSON.stringify({ content, date })
        });
        if (response.ok) {
          const replyData = await response.json();
          form.reset();
          if (replyData.mood && replyData.mood.main && replyData.mood.sub && replyData.mood.year && replyData.mood.month && replyData.mood.day) {
            showRecognizedMoodPopup(replyData.mood);
          }
        } else { alert("Failed to save note."); }
      } catch (error) { console.error("Error:", error); alert("An error occurred while saving the note."); }
    });
  }

  // === Calendar (unchanged except using getUserIdFromToken for auth) ===
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
    const res = await fetch(url, { headers: { ...(token && { "Authorization": `Bearer ${token}` }) }, cache: "no-store" });
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
    calendar.innerHTML = "";
    currentMonthElement.textContent = new Date(currentYear, currentMonth).toLocaleString('en-US', { month: 'long', year: 'numeric' });
    currentMonthElement.dataset.year = currentYear;
    currentMonthElement.dataset.month = currentMonth;

    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const startDay = (firstDayOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const savedMoods = await fetchMoods(currentYear, currentMonth);

    for (let i = 0; i < startDay; i++) {
      const emptyCell = document.createElement("div");
      emptyCell.classList.add("calendar-day", "empty");
      calendar.appendChild(emptyCell);
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
      calendar.appendChild(dayElement);
    }
  }

  prevMonthButton?.addEventListener("click", () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } updateCalendar(); clearSubMoodUI(); });
  nextMonthButton?.addEventListener("click", () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } updateCalendar(); clearSubMoodUI(); });

  currentDateElement && (currentDateElement.textContent = `Today: ${new Date().toDateString()}`);
  updateCalendar();

  // Load this identity's history
  loadLastChatMessages(true);

  // Detect account switches quickly
  window.addEventListener("focus", () => { refreshIdentityFromProfile(); });
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshIdentityFromProfile(); });
  // Watch JWT changes too
  let __lastToken = localStorage.getItem("authToken") || null;
  setInterval(() => {
    const now = localStorage.getItem("authToken") || null;
    if (now !== __lastToken) {
      __lastToken = now;
      if (!refreshIdentityFromToken()) refreshIdentityFromProfile();
    }
  }, 800);
});

/* ===== Typing indicator + typewriter (unchanged) ===== */
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

/* ===== Chat persistence (per-identity) ===== */
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
  localStorage.setItem(key, JSON.stringify(messages.slice(-10))); // keep 5 exchanges
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
  messagesDiv.innerHTML = "";
  messages.forEach(msg => {
    const el = document.createElement("div");
    el.classList.add("message", msg.sender);
    el.textContent = msg.text;
    messagesDiv.appendChild(el);
  });
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/* ===== Calendar helpers (unchanged) ===== */
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

/* Palettes (unchanged) */
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

window.showSubMoodButtons = function(mainMood) {
  const container = document.getElementById("submood-buttons-container");
  if (!container) return;
  container.innerHTML = '';
  const submoods = MOOD_MAP[mainMood];
  const colors = MOOD_COLOR_MAP[mainMood];
  submoods.forEach((subMood) => {
    const btn = document.createElement('button');
    btn.className = 'submood-btn';
    btn.textContent = subMood.charAt(0).toUpperCase() + subMood.slice(1);
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
  if (!selectedDayElement) { alert("Please select a date first."); return; }

  const { token } = getUserIdFromToken();
  const day = parseInt(selectedDayElement.dataset.day, 10);
  const year = parseInt(document.getElementById("current-month").dataset.year, 10);
  const month = parseInt(document.getElementById("current-month").dataset.month, 10);
  const mood = { year, month: month + 1, day, emoji, subMood };

  let color = MOOD_COLOR_MAP[emoji]?.[subMood] ?? CATEGORY_BASE[emoji] ?? '';
  applyDayColor(selectedDayElement, color, emoji, subMood);

  let res;
  try {
    res = await fetch('/user/moods/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token && { "Authorization": `Bearer ${token}` }) },
      body: JSON.stringify(mood)
    });
  } catch (e) { console.error("Network error", e); alert("Network error while saving mood."); return; }

  if (!res.ok) {
    const text = await res.text();
    console.error("Save failed", res.status, text);
    alert(`Failed to save mood: ${res.status} ${text}`);
    return;
  }

  const replyData = await res.json();
  await addBotMessageTyping(replyData.reply || "Your mood has been saved.");
}

/* Send message (passes stable per-user id to server too) */
async function sendMessage() {
  const input = document.getElementById("user-input");
  const message = input.value.trim();
  if (!message) return;
  addMessage("user", message);
  input.value = "";

  const { userId, token } = getUserIdFromToken(); // userId === IDENTITY.key (e.g., user:email or guest:device)
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token && { "Authorization": `Bearer ${token}` }) },
      body: JSON.stringify({ message, userId })
    });
    const data = await response.json();
    await addBotMessageTyping(data.response || ("⚠️ " + (data.error || "Unknown server response.")));
  } catch (err) {
    console.error("send error", err);
    await addBotMessageTyping("⚠️ Server error occurred.");
  }
}

/* ===== END ===== */
