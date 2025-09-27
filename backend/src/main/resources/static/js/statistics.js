/* statistics.js — app palette, legible pies (with separators), stable sizing, polished controls */
(() => {
  // ---- auth helpers ----
  const token = () => localStorage.getItem("authToken") || null;
  const auth  = () => (token() ? { Authorization: `Bearer ${token()}` } : {});

  // ---- i18n helpers ----
  const t = (k, d) => (window.I18N && typeof I18N[k] === "string") ? I18N[k] : d;
  const L = (new URLSearchParams(location.search).get("lang")) || document.documentElement.lang || "en";

  // ---- CSS var helper ----
  const css = (name, fallback) =>
    (getComputedStyle(document.documentElement).getPropertyValue(name) || "").trim() || fallback;

  // ---- chart theme (reads from CSS variables when available) ----
  const INK       = css("--ink", "#1A1A1A");
  const SUBTEXT   = css("--chart-axis", css("--ink-3", "#8A8A8A"));
  const GRID      = css("--chart-grid", css("--line-soft", "#E2E3E8"));
  const CARD_LINE = css("--line", "#9A9AA1");
  const CARD_BG   = css("--card", "#FFFFFF"); // used for pie slice separators

  Chart.defaults.color       = INK;
  Chart.defaults.borderColor = CARD_LINE;

  // Remove default arc borders globally; we'll add them explicitly where we want
  Chart.defaults.elements.arc = Chart.defaults.elements.arc || {};
  Chart.defaults.elements.arc.borderWidth = 0;
  Chart.defaults.elements.arc.borderColor = "transparent";

  // App-like mood colors (match the main UI)
  const COLORS = {
    bad:     css("--chart-bad",     "#FF3B30"), // vivid red
    poor:    css("--chart-poor",    "#FF9F0A"), // vivid orange (app-style)
    neutral: css("--chart-neutral", "#D1D5DB"), // light neutral like the app
    good:    css("--chart-good",    "#34C759"), // iOS green
    best:    css("--chart-best",    "#0A84FF"), // iOS blue
  };

  const SUBCOLORS = {
    best:   { proud:"#00E6D0", grateful:"#00B8FF", energetic:"#4D7CFE", excited:"#A259FF", fulfilled:"#FF66C4" },
    good:   { calm:"#6EE7B7", productive:"#34D399", hopeful:"#10B981", motivated:"#22C55E", friendly:"#A3E635" },
    neutral:{ indifferent:"#E5E7EB", blank:"#CBD5E1", tired:"#9CA3AF", bored:"#94A3B8", quiet:"#64748B" },
    poor:   { frustrated:"#FFE08A", overwhelmed:"#FFD166", nervous:"#FFB020", insecure:"#FF9F0A", confused:"#FF7A00" },
    bad:    { angry:"#FF6B6B", sad:"#FF3B30", lonely:"#E11D48", anxious:"#C81E1E", hopeless:"#8B0000" }
  };

  const LEVEL  = { bad:1, poor:2, neutral:3, good:4, best:5 };
  const LABELS = { 1:t("mood_bad","Bad"), 2:t("mood_poor","Poor"), 3:t("mood_neutral","Neutral"), 4:t("mood_good","Good"), 5:t("mood_best","Best") };
  const MAIN_LABELS = [t("mood_bad","Bad"), t("mood_poor","Poor"), t("mood_neutral","Neutral"), t("mood_good","Good"), t("mood_best","Best")];

  const colorByLevel = (y) => [null, COLORS.bad, COLORS.poor, COLORS.neutral, COLORS.good, COLORS.best][y] || "#9aa3ae";

  // ---- dates ----
  const NOW        = new Date();
  const THIS_MONTH = new Date(NOW.getFullYear(), NOW.getMonth(), 1);
  const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
  const endOfMonth   = (d) => new Date(d.getFullYear(), d.getMonth()+1, 0, 23,59,59,999);
  const addMonths    = (d,n) => new Date(d.getFullYear(), d.getMonth()+n, 1);
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

  // ---- DOM ----
  const pieEl        = document.getElementById("moodChart");
  const subWrap      = document.getElementById("subMoodChartsContainer");
  const canvas       = document.getElementById("moodMonthlyLines");
  const noDataEl     = document.getElementById("monthlyNoData");
  const monthLabelEl = document.getElementById("monthLabel");
  const prevBtn      = document.getElementById("prevMonth");
  const nextBtn      = document.getElementById("nextMonth");
  const thisBtn      = document.getElementById("thisMonth");

  // keep a stable height for the line chart no matter the month
  const LINE_H = 320;
  if (canvas) {
    canvas.style.height = `${LINE_H}px`;
    canvas.height = LINE_H;
  }

  let selectedMonth = startOfMonth(NOW);
  let lineChart = null;
  const MONTH_CACHE = new Map(); // "yyyy-mm" -> Map("yyyy-mm-dd" -> level 1..5)

  // ---- pies (overall stats) ----
  fetch("/user/moods/stats", {
    headers: { Accept:"application/json", "Cache-Control":"no-cache", ...auth() },
    cache: "no-store", credentials: "same-origin"
  })
  .then(r => r.json())
  .then(data => {
    // Main distribution pie — bigger, with separating borders, app colors
    if (data?.mainMoodStats && pieEl) {
      try { pieEl.width = 360; pieEl.height = 360; } catch {}

      const s = data.mainMoodStats;
      const counts = [s.bad, s.poor, s.neutral, s.good, s.best].map(n => Math.round(Number(n) || 0));
      const total  = counts.reduce((a,b)=>a+b,0) || 1;

      new Chart(pieEl.getContext("2d"), {
        type: "pie",
        data: {
          labels: MAIN_LABELS,
          datasets: [{
            data: counts,
            backgroundColor: [COLORS.bad, COLORS.poor, COLORS.neutral, COLORS.good, COLORS.best],
            // 👇 thin separators between slices, matching the card background
            borderColor: CARD_BG,
            borderWidth: 2,
            hoverBorderColor: CARD_BG,
            hoverBorderWidth: 2
          }]
        },
        options: {
          layout: { padding: 4 },
          plugins: {
            title:  { display: true, text: t("stats_mainPieTitle","Main Mood Distribution"), color: INK, font: { size: 16, weight: "800" } },
            legend: { labels: { color: SUBTEXT, boxWidth: 14, boxHeight: 10, font: { size: 12 } }, position: "bottom" },
            tooltip: {
              displayColors: false,
              callbacks: {
                title: () => "",
                label: (ctx) => {
                  const label = ctx.label || "";
                  const v = Math.round(Number(ctx.parsed) || 0);
                  const pct = Math.round((v / total) * 100);
                  return ` ${label}: ${v} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }

    // Submood pies (localized legends, label: count (pct))
    if (data?.subMoodStats && subWrap) {
      const groups = {
        best:["proud","grateful","energetic","excited","fulfilled"],
        good:["calm","productive","hopeful","motivated","friendly"],
        neutral:["indifferent","blank","tired","bored","quiet"],
        poor:["frustrated","overwhelmed","nervous","insecure","confused"],
        bad:["angry","sad","lonely","anxious","hopeless"]
      };

      subWrap.innerHTML = "";

      Object.keys(groups).forEach(main => {
        const subs  = groups[main];
        const vals  = subs.map(s => Math.round(Number(data.subMoodStats[`${main}:${s}`] || 0)));
        const total = vals.reduce((a,b)=>a+b,0);
        if (!total) return;

        const card = document.createElement("div");
        card.className = "mini";

        const mainTitle = ({
          bad: t("mood_bad","Bad"), poor: t("mood_poor","Poor"), neutral: t("mood_neutral","Neutral"),
          good: t("mood_good","Good"), best: t("mood_best","Best")
        })[main] || main;

        card.innerHTML = `<h4>${mainTitle}</h4><canvas height="210"></canvas>`;
        subWrap.appendChild(card);

        new Chart(card.querySelector("canvas").getContext("2d"), {
          type: "pie",
          data: {
            labels: subs.map(code => (window.SUBMOOD_LABELS || {})[code] || code),
            datasets: [{
              data: vals,
              backgroundColor: subs.map(s => SUBCOLORS[main][s]),
              borderColor: CARD_LINE,
              borderWidth: 1
            }]
          },
          options: {
            plugins: {
              legend:  { labels: { color: SUBTEXT, font: { size: 11 } }, position: "bottom" },
              tooltip: {
                displayColors: false,
                callbacks: {
                  title: () => "",
                  label: (ctx) => {
                    const label = ctx.label || "";
                    const v = Math.round(Number(ctx.parsed) || 0);
                    const pct = Math.round((v / total) * 100);
                    return ` ${label}: ${v} (${pct}%)`;
                  }
                }
              }
            }
          }
        });
      });
    }
  })
  .catch(console.error)
  .finally(() => {
    wireMonthButtons();
    renderMonth(selectedMonth);
  });

  // ---- monthly data (per-day line) ----
  async function fetchMonthMap(monthStart) {
    const y = monthStart.getFullYear(), m = monthStart.getMonth() + 1;
    const key = `${y}-${String(m).padStart(2,"0")}`;
    if (MONTH_CACHE.has(key)) return MONTH_CACHE.get(key);

    const map = new Map();
    try {
      const res = await fetch(`/user/moods/fetch?year=${y}&month=${m}`, {
        headers: { Accept: "application/json", ...auth() },
        cache: "no-store", credentials: "same-origin"
      });
      if (res.ok) {
        const arr = await res.json();
        for (const it of arr) {
          const day  = Number(it.day);
          const main = String(it.emoji || "").toLowerCase();
          if (!day || !LEVEL[main]) continue;
          const d = new Date(y, monthStart.getMonth(), day);
          map.set(ymd(d), LEVEL[main]); // last one wins per day
        }
      }
    } catch (e) { console.error("fetch month failed", e); }
    MONTH_CACHE.set(key, map);
    return map;
  }

  // ---- render full-month line ----
  async function renderMonth(monthStart) {
    if (!canvas) return;

    // re-pin height before (re)creating the chart
    canvas.style.height = `${LINE_H}px`;
    canvas.height = LINE_H;

    const ctx = canvas.getContext("2d");
    const monthEnd = endOfMonth(monthStart);

    // every calendar day in the month
    const days = [];
    for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    }

    const map    = await fetchMonthMap(monthStart);
    const values = days.map(d => map.get(ymd(d)) ?? null); // null = no record
    const any    = values.some(v => v != null);

    if (lineChart) lineChart.destroy();
    if (noDataEl) noDataEl.style.display = any ? "none" : "block";

    lineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: days,
        datasets: [{
          label: t("stats_dailyMoodTitle","Moods by Date (selected month)"),
          data: values,
          tension: 0.28,
          fill: false,
          spanGaps: true,
          clip: 0,
          borderWidth: 3,
          borderJoinStyle: "round",
          borderCapStyle: "round",
          borderColor: "#9aa3ae", // fallback; segments are colored below
          pointRadius: (c) => (c.raw != null ? 5 : 0),
          pointHoverRadius: (c) => (c.raw != null ? 7 : 0),
          hitRadius: 10,
          pointBackgroundColor: (c) => colorByLevel(c.parsed && c.parsed.y),
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          segment: {
            borderColor: (c) => colorByLevel((c.p1?.parsed?.y) ?? (c.p0?.parsed?.y) ?? 3)
          }
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,   // respect fixed height
        layout: { padding: { left: 6, right: 6, top: 6, bottom: 6} },
        interaction: { mode: "nearest", intersect: true },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: {
              title: (items) => {
                const d = items[0].label;
                try { return new Date(d).toLocaleDateString(L, { month:"short", day:"numeric", year:"numeric" }); }
                catch { return String(d); }
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
            time: { unit: "day", displayFormats: { day: "MMM d" }, tooltipFormat: "PP" },
            ticks: { color: SUBTEXT, autoSkip: true, maxRotation: 0 },
            grid:  { color: GRID }
          },
          y: {
            position: "left",
            title: { display: true, text: t("stats.yAxis","Mood"), color: INK, font: { weight: "800" } },
            min: 0.5, max: 5.5,
            ticks: { stepSize: 1, color: SUBTEXT, callback: (v) => LABELS[v] || "" },
            grid:  { color: GRID }
          }
        }
      }
    });

    if (monthLabelEl) monthLabelEl.textContent = monthStart.toLocaleDateString(L, { month:"long", year:"numeric" });
    updateNav();
  }

  // ---- controls ----
  function wireMonthButtons() {
    prevBtn?.addEventListener("click", () => { selectedMonth = addMonths(selectedMonth, -1); renderMonth(selectedMonth); });
    nextBtn?.addEventListener("click", () => { selectedMonth = addMonths(selectedMonth,  1); renderMonth(selectedMonth); });
    thisBtn?.addEventListener("click", () => { selectedMonth = new Date(THIS_MONTH);    renderMonth(selectedMonth); });

    // keyboard: ← → and Home jump
    window.addEventListener("keydown", (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); selectedMonth = addMonths(selectedMonth, -1); renderMonth(selectedMonth); }
      if (e.key === "ArrowRight") { e.preventDefault(); selectedMonth = addMonths(selectedMonth,  1); renderMonth(selectedMonth); }
      if (e.key === "Home")       { e.preventDefault(); selectedMonth = new Date(THIS_MONTH);       renderMonth(selectedMonth); }
    });

    updateNav();
  }

  // Never disable Next (you can browse future months too)
  function updateNav() {
    if (!prevBtn || !nextBtn || !thisBtn) return;
    prevBtn.disabled = false;
    nextBtn.disabled = false;
    const atThis = selectedMonth.getFullYear() === THIS_MONTH.getFullYear()
                && selectedMonth.getMonth()    === THIS_MONTH.getMonth();
    thisBtn.disabled = atThis;
    monthLabelEl?.setAttribute("aria-current", atThis ? "date" : "false");
  }
})();
