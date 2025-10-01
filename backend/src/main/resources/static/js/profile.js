/* Profile page logic: fetch profile + lightweight mood stats */
(() => {
  "use strict";

  // --- i18n helper (uses window.I18N if present) ---
  const LANG = (new URLSearchParams(location.search).get('lang') || document.documentElement.lang || 'en').split('-')[0].toLowerCase();
  const t = (k, f) => (window.I18N && typeof window.I18N[k] === 'string') ? window.I18N[k] : f;

  // Mood labels + colors (same palette as app)
  const CATEGORY_BASE = {
    bad:'#FFCACA', poor:'#FFE4B8', neutral:'#E9EDF2', good:'#CFEFD9', best:'#CDE2FF'
  };
  const MOOD_LABEL = {
    bad: t('mood.bad','Bad'),
    poor: t('mood.poor','Poor'),
    neutral: t('mood.neutral','Neutral'),
    good: t('mood.good','Good'),
    best: t('mood.best','Best'),
  };

  // --- DOM refs ---
  const el = (id)=>document.getElementById(id);
  const nameEl   = el('profile-name');
  const emailEl  = el('profile-email');
  const joinedEl = el('profile-joined');
  const subEl    = el('profile-sub');

  const statStreak = el('stat-streak');
  const statMost   = el('stat-most');
  const statDays   = el('stat-days');
  const heatStrip  = el('heat-strip');

  // --- Profile fetch ---
  async function loadProfile(){
    try{
      const r = await fetch('/user/profile', { credentials:'same-origin' });
      if(!r.ok) throw new Error('not ok');
      const p = await r.json();
      const display = p.name || p.username || p.email || '—';
      nameEl.textContent = display;
      emailEl.textContent = p.email || '—';
      joinedEl.textContent = (p.joined || p.createdAt || '').slice(0,10) || '—';
      nameEl.classList.remove('skeleton'); emailEl.classList.remove('skeleton'); joinedEl.classList.remove('skeleton');

      // initials in avatar
      const initials = (display||'M C').split(/\s+/).map(s=>s[0]||'').join('').slice(0,2).toUpperCase();
      const inEl = document.getElementById('profile-initials');
      if(inEl) inEl.textContent = initials;

      subEl.textContent = `${t('auth.welcome','Welcome')}, ${display}!`;
    }catch{
      nameEl.textContent = t('auth.login','Login required');
      emailEl.textContent = '—';
      joinedEl.textContent = '—';
      nameEl.classList.remove('skeleton'); emailEl.classList.remove('skeleton'); joinedEl.classList.remove('skeleton');
      subEl.textContent = t('auth.login.subtitle','Please log in to continue.');
    }
  }

  // --- Mood fetch (current & previous month) ---
  async function fetchMonth(year, monthIdx){ // monthIdx: 0..11
    const r = await fetch(`/user/moods/fetch?year=${year}&month=${monthIdx+1}`, {
      credentials:'same-origin', headers:{'Accept-Language':LANG}
    });
    if(!r.ok) return [];
    try{ return await r.json(); }catch{ return []; }
  }

  function ymd(y,m,d){ return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; }

  function buildIndex(year, monthIdx, arr){
    const map = {};
    for(const it of (arr||[])){
      if(!it || !it.day || !it.emoji) continue;
      map[ ymd(year, monthIdx+1, it.day) ] = it.emoji; // main mood only
    }
    return map;
  }

  // Compute current streak (consecutive same main mood from most recent backwards)
  function computeCurrentStreak(dateList, moodIndex){
    let streak = 0, curMood = null;
    for(const d of dateList.slice().reverse()){ // from latest to oldest
      const m = moodIndex[d] || null;
      if(!m){ if(streak===0) continue; else break; }
      if(curMood==null){ curMood = m; streak = 1; }
      else if(m===curMood){ streak++; }
      else{ break; }
    }
    return { streak, mood: curMood };
  }

  // Most frequent mood in a window
  function mostFrequent(dateList, moodIndex){
    const count = { bad:0, poor:0, neutral:0, good:0, best:0 };
    for(const d of dateList){ const m = moodIndex[d]; if(m && (m in count)) count[m]++; }
    let bestKey = null, bestVal = -1;
    for(const k in count){ if(count[k]>bestVal){ bestKey=k; bestVal=count[k]; } }
    return bestVal>0 ? bestKey : null;
  }

  function applyMoodChip(el, moodKey){
    if(!moodKey){ el.textContent = '—'; el.style.background=''; el.style.color=''; return; }
    el.textContent = MOOD_LABEL[moodKey] || moodKey;
    const bg = CATEGORY_BASE[moodKey] || '#eee';
    const text = readableText(bg);
    el.style.background = bg;
    el.style.color = text;
    el.style.borderColor = (text==='#111') ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.4)';
  }

  function readableText(hex){
    let h = (hex||'').replace('#',''); if(h.length===3) h=h.split('').map(c=>c+c).join('');
    if(h.length!==6) return '#111';
    const r=parseInt(h.slice(0,2),16)/255, g=parseInt(h.slice(2,4),16)/255, b=parseInt(h.slice(4,6),16)/255;
    const lin = v => v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4);
    const L = 0.2126*lin(r)+0.7152*lin(g)+0.0722*lin(b);
    return L>0.55 ? '#111' : '#fff';
  }

  function renderHeatStrip(dateList, moodIndex){
    heatStrip.innerHTML = '';
    for(const d of dateList){
      const cell = document.createElement('div');
      cell.className = 'heat-cell';
      const m = moodIndex[d];
      if(m){ cell.dataset.mood = m; cell.title = `${d} – ${MOOD_LABEL[m]||m}`; }
      else { cell.title = `${d} – —`; }
      heatStrip.appendChild(cell);
    }
  }

  function createConfetti(n=24){
    const layer = document.createElement('div'); layer.className = 'confetti';
    const EMOJIS = ['✨','🎉','🌟','💫','🎊','🩷','💛','💙'];
    const W = window.innerWidth;
    for(let i=0;i<n;i++){
      const span = document.createElement('i');
      span.textContent = EMOJIS[Math.floor(Math.random()*EMOJIS.length)];
      span.style.left = Math.random()*W + 'px';
      span.style.animationDelay = (Math.random()*300) + 'ms';
      layer.appendChild(span);
    }
    document.body.appendChild(layer);
    setTimeout(()=>layer.remove(), 1600);
  }

  async function loadStats(){
    // Build a rolling 30-day window
    const today = new Date();
    const dates = [];
    for(let i=29;i>=0;i--){
      const d = new Date(today); d.setDate(today.getDate()-i);
      dates.push( ymd(d.getFullYear(), d.getMonth()+1, d.getDate()) );
    }

    // Fetch current + previous month
    const y = today.getFullYear(), m = today.getMonth();
    const prevY = m===0 ? y-1 : y, prevM = m===0 ? 11 : m-1;

    const [thisMonth, prevMonth] = await Promise.all([
      fetchMonth(y, m), fetchMonth(prevY, prevM)
    ]);

    const idx = Object.assign(
      buildIndex(prevY, prevM, prevMonth),
      buildIndex(y, m, thisMonth)
    );

    // Stats
    const { streak, mood } = computeCurrentStreak(dates, idx);
    statStreak.textContent = String(streak || 0);

    const freqMood = mostFrequent(dates, idx);
    applyMoodChip(statMost, freqMood);

    const daysLoggedThisMonth = (thisMonth || []).filter(x => x && x.emoji).length;
    statDays.textContent = String(daysLoggedThisMonth);

    // Heat strip
    renderHeatStrip(dates, idx);

    // Celebrate strong streaks
    if (streak >= 7) createConfetti(36);
  }

  // Init
  window.addEventListener('DOMContentLoaded', async () => {
    await loadProfile();
    await loadStats();
  });

})();
