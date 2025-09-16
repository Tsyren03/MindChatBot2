/* statistics.js — monthly-first agenda, full-month line, i18n labels */
(function () {
  // ---- auth helpers ----
  const token = () => localStorage.getItem("authToken") || null;
  const auth = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

  // ---- i18n helpers ----
  const t = (k, d) => (window.I18N && typeof I18N[k] === 'string') ? I18N[k] : d;
  const L = (new URLSearchParams(location.search).get('lang')) || document.documentElement.lang || 'en';

  // ---- chart theme ----
  Chart.defaults.color = "#e9eef6";
  const gridColor = "rgba(255,255,255,.10)";
  const axisLabel = "#c7d1e3";

  const COLORS = {
    bad: "#FF3B30",
    poor: "#FF9F0A",
    neutral: "#D1D5DB",
    good: "#34C759",
    best: "#0A84FF",
  };
  const SUBCOLORS = {
    best:{ proud:"#00E6D0",grateful:"#00B8FF",energetic:"#4D7CFE",excited:"#A259FF",fulfilled:"#FF66C4" },
    good:{ calm:"#6EE7B7",productive:"#34D399",hopeful:"#10B981",motivated:"#22C55E",friendly:"#A3E635" },
    neutral:{ indifferent:"#E5E7EB",blank:"#D1D5DB",tired:"#BFC5CD",bored:"#9AA3AE",quiet:"#6B7280" },
    poor:{ frustrated:"#FFE08A",overwhelmed:"#FFD166",nervous:"#FFB020",insecure:"#FF9F0A",confused:"#FF7A00" },
    bad:{ angry:"#FF6B6B",sad:"#FF3B30",lonely:"#E11D48",anxious:"#C81E1E",hopeless:"#8B0000" }
  };

  const LEVEL = { bad:1, poor:2, neutral:3, good:4, best:5 };
  const LABELS = {
    1: t('mood_bad','Bad'),
    2: t('mood_poor','Poor'),
    3: t('mood_neutral','Neutral'),
    4: t('mood_good','Good'),
    5: t('mood_best','Best')
  };
  const MAIN_LABELS = [
    t('mood_bad','Bad'),
    t('mood_poor','Poor'),
    t('mood_neutral','Neutral'),
    t('mood_good','Good'),
    t('mood_best','Best')
  ];
  const colorByLevel = y =>
    [null, COLORS.bad, COLORS.poor, COLORS.neutral, COLORS.good, COLORS.best][y] || "#9aa3ae";

  // ---- dates ----
  const NOW = new Date();
  const THIS_MONTH = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
  const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth = d => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
  const addMonths = (d,n) => new Date(d.getFullYear(), d.getMonth()+n, 1);
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // ---- DOM ----
  const pieEl = document.getElementById("moodChart");
  const subWrap = document.getElementById("subMoodChartsContainer");
  const canvas = document.getElementById("moodMonthlyLines");
  const noDataEl = document.getElementById("monthlyNoData");
  const monthLabelEl = document.getElementById("monthLabel");
  const prevBtn = document.getElementById("prevMonth");
  const nextBtn = document.getElementById("nextMonth");
  const thisBtn = document.getElementById("thisMonth");

  let selectedMonth = startOfMonth(NOW);
  let lineChart = null;
  const MONTH_CACHE = new Map(); // "yyyy-mm" -> Map("yyyy-mm-dd" -> level 1..5)

  // ---- pies ----
  fetch("/user/moods/stats", {
    headers: { "Accept":"application/json", "Cache-Control":"no-cache", ...auth() },
    cache: "no-store", credentials: "same-origin"
  })
  .then(r=>r.json())
  .then(data=>{
    if (data?.mainMoodStats && pieEl) {
      const s = data.mainMoodStats;
      new Chart(pieEl.getContext("2d"), {
        type: "pie",
        data: {
          labels: MAIN_LABELS,
          datasets: [{
            data: [s.bad,s.poor,s.neutral,s.good,s.best],
            borderColor: "#12151f", borderWidth: 1,
            backgroundColor: [COLORS.bad,COLORS.poor,COLORS.neutral,COLORS.good,COLORS.best]
          }]
        },
        options: {
          layout: { padding: 8 },
          plugins: {
            title: { display: true, text: t('stats_mainPieTitle','Main Mood Distribution'), color: "#e9eef6", font: { size: 14, weight: "800" } },
            legend: { labels: { color: "#e9eef6", boxWidth: 14, boxHeight: 10, font: { size: 12 } }, position: 'bottom' }
          }
        }
      });
    }

    if (data?.subMoodStats && subWrap) {
      const groups = {
        best:["proud","grateful","energetic","excited","fulfilled"],
        good:["calm","productive","hopeful","motivated","friendly"],
        neutral:["indifferent","blank","tired","bored","quiet"],
        poor:["frustrated","overwhelmed","nervous","insecure","confused"],
        bad:["angry","sad","lonely","anxious","hopeless"]
      };
      subWrap.innerHTML = "";
      Object.keys(groups).forEach(main=>{
        const vals = groups[main].map(s => (data.subMoodStats[`${main}:${s}`] || 0));
        if (vals.reduce((a,b)=>a+b,0) === 0) return;
        const card = document.createElement("div");
        card.className = "mini";
        const mainTitle = ({
          bad:   t('mood_bad','Bad'),
          poor:  t('mood_poor','Poor'),
          neutral:t('mood_neutral','Neutral'),
          good:  t('mood_good','Good'),
          best:  t('mood_best','Best')
        })[main] || main;
        card.innerHTML = `<h4>${mainTitle}</h4><canvas height="200"></canvas>`;
        subWrap.appendChild(card);
        new Chart(card.querySelector("canvas").getContext("2d"), {
          type:"pie",
          data:{
            labels: groups[main].map(s=>s[0].toUpperCase()+s.slice(1)),
            datasets:[{ data: vals, backgroundColor: groups[main].map(s=>SUBCOLORS[main][s]) }]
          },
          options:{ plugins:{ legend:{ labels:{ color:"#e9eef6", font:{ size:11 } }, position:'bottom' } } }
        });
      });
    }
  })
  .catch(console.error)
  .finally(()=>{
    wireMonthButtons();
    renderMonth(selectedMonth);
  });

  // ---- monthly data ----
  async function fetchMonthMap(monthStart){
    const y = monthStart.getFullYear(), m = monthStart.getMonth()+1;
    const key = `${y}-${String(m).padStart(2,"0")}`;
    if (MONTH_CACHE.has(key)) return MONTH_CACHE.get(key);

    const map = new Map();
    try{
      const res = await fetch(`/user/moods/fetch?year=${y}&month=${m}`, {
        headers: { "Accept":"application/json", ...auth() },
        cache: "no-store", credentials: "same-origin"
      });
      if (res.ok) {
        const arr = await res.json();
        for (const it of arr) {
          const day = Number(it.day);
          const main = String(it.emoji || "").toLowerCase();
          if (!day || !LEVEL[main]) continue;
          const d = new Date(y, monthStart.getMonth(), day);
          map.set(ymd(d), LEVEL[main]);     // last one wins per day
        }
      }
    }catch(e){ console.error("fetch month failed", e); }
    MONTH_CACHE.set(key, map);
    return map;
  }

  // ---- render full-month line ----
  async function renderMonth(monthStart){
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const monthEnd = endOfMonth(monthStart);

    // every calendar day in the month
    const days = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate()+1)) {
      days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    const map = await fetchMonthMap(monthStart);
    const values = days.map(d => map.get(ymd(d)) ?? null); // null = no record
    const any = values.some(v => v != null);

    if (lineChart) lineChart.destroy();
    noDataEl.style.display = any ? "none" : "block";

    lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: days,                     // Date objects (time scale)
        datasets: [{
          label: t('stats_dailyMoodTitle','Moods by Date (selected month)'),
          data: values,
          borderWidth: 3,
          tension: .25,
          fill: false,
          spanGaps: true,                 // connect across missing days
          clip: 0,
          pointRadius: (c)=> (c.raw!=null ? 5 : 0),
          pointHoverRadius: (c)=> (c.raw!=null ? 7 : 0),
          hitRadius: 10,
          pointBackgroundColor: (c)=> colorByLevel(c.parsed.y),
          pointBorderColor: (c)=> colorByLevel(c.parsed.y),
          segment: {
            borderColor: (c)=> colorByLevel((c.p1?.parsed?.y) ?? (c.p0?.parsed?.y) ?? 3)
          }
        }]
      },
      options: {
        responsive: true,
        layout:{ padding: { left: 6, right: 6, top: 6, bottom: 6 } },
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          title: { display: false },
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => {
                const d = items[0].label;
                try {
                  return new Date(d).toLocaleDateString(L, {month:"short",day:"numeric",year:"numeric"});
                } catch { return String(d); }
              },
              label: (c) => ` ${LABELS[c.parsed.y] || "—"}`
            }
          }
        },
        scales: {
          x: {
            type: "time",
            min: monthStart,
            max: monthEnd,
            time: {
              unit: "day",
              displayFormats: { day: "MMM d" },
              tooltipFormat: "PP"
            },
            ticks: { color: axisLabel, autoSkip: true, maxRotation: 0 },
            grid: { color: gridColor }
          },
          y: {
            position: "left",
            title: { display: true, text: t('stats.yAxis','Mood'), color: "#e9eef6", font:{ weight:"800" } },
            min: 0.5, max: 5.5,
            ticks: { stepSize: 1, color: axisLabel, callback: (v)=> LABELS[v] || "" },
            grid: { color: gridColor }
          }
        }
      }
    });

    monthLabelEl.textContent = monthStart.toLocaleDateString(L,{ month:"long", year:"numeric" });
    updateNav();
  }

  // ---- controls ----
  function wireMonthButtons(){
    prevBtn?.addEventListener("click", ()=> { selectedMonth = addMonths(selectedMonth, -1); renderMonth(selectedMonth); });
    nextBtn?.addEventListener("click", ()=> { selectedMonth = addMonths(selectedMonth, 1); renderMonth(selectedMonth); });
    thisBtn?.addEventListener("click", ()=> { selectedMonth = new Date(THIS_MONTH); renderMonth(selectedMonth); });
    updateNav();
  }
  function updateNav(){
    if (!prevBtn || !nextBtn) return;
    const atMax = selectedMonth.getFullYear()===THIS_MONTH.getFullYear()
               && selectedMonth.getMonth()===THIS_MONTH.getMonth();
    nextBtn.disabled = atMax;
  }
})();
