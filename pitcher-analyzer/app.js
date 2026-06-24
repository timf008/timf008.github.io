// -----------------------------------------------------
// Pitcher Analyzer - app.js
// Clean, modular, single-file architecture
// -----------------------------------------------------


// -------------------------------
// Multi Season Preload
// -------------------------------
const PRELOAD_SEASONS = [2026, 2025, 2024, 2023, 2022, 2021, 2020];

const PRELOADED_PITCHING = {};
const PRELOAD_COMPLETE = {};

PRELOAD_SEASONS.forEach(season => {
  PRELOADED_PITCHING[season] = [];
  PRELOAD_COMPLETE[season] = false;
});

function loadCSV(path) {
  const request = new XMLHttpRequest();
  request.open("GET", path, false); // synchronous
  request.send(null);

  const lines = request.responseText.trim().split("\n");
  const headers = lines[0].split(",");

  return lines.slice(1).map(line => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => obj[h] = values[i]);

// 1. Convert numeric-looking fields
for (const key in obj) {
  const num = parseFloat(obj[key]);
  if (!isNaN(num)) obj[key] = num;
}

// 2. Normalize Stathead column names
if (obj["HR/9"]) obj.HR9 = obj["HR/9"];
if (obj["BB/9"]) obj.BB9 = obj["BB/9"];
if (obj["SO/9"]) obj.SO9 = obj["SO/9"];

// 3. Compute missing rate stats
if (obj.SO && obj.BF) obj.Kpct = (obj.SO / obj.BF) * 100;
if (obj.BB && obj.BF) obj.BBpct = (obj.BB / obj.BF) * 100;

// ⭐ 4. Compute KBB (K/BB ratio) — FINAL FIX
if (typeof obj.SO === "number" && typeof obj.BB === "number" && obj.BB > 0) {
    obj.KBB = obj.SO / obj.BB;
}

// 5. Convert IP from Stathead format
if (obj.IP !== undefined) {
  const ip = obj.IP;
  const whole = Math.floor(ip);
  const decimal = ip - whole;

  let converted = whole;

  if (decimal > 0 && decimal < 0.34) converted += 1/3;
  else if (decimal >= 0.34) converted += 2/3;

  obj.IP = converted;
}

// 6. Round values
const roundKeys = ["ERA", "WHIP", "HR9", "BB9", "SO9", "Kpct", "BBpct", "KBB", "IP"];
for (const key of roundKeys) {
  if (typeof obj[key] === "number") {
    obj[key] = Math.round(obj[key] * 100) / 100;
  }
}



    return obj;
  });
}

async function preloadPitcherData() {
    const overlay = document.getElementById("preloadOverlay");
    const text = document.getElementById("preloadText");
    const fill = document.getElementById("preloadFill");

    overlay.style.display = "flex";

    const totalSeasons = PRELOAD_SEASONS.length;
    let completedSeasons = 0;

    // Load each season (no row-by-row animation)
    for (const season of PRELOAD_SEASONS) {

        text.textContent = `Loading ${season}…`;

        // Load CSV for this season
        const path = `PitcherAnalyzer/stathead_pitching_${season}.csv`;
        PRELOADED_PITCHING[season] = loadCSV(path);

        PRELOAD_COMPLETE[season] = true;

        // Update progress bar based on seasons completed
        completedSeasons++;
        const pct = Math.floor((completedSeasons / totalSeasons) * 100);
        fill.style.width = pct + "%";

        // Smooth animation
        await new Promise(r => setTimeout(r, 150));
    }

    // Done
    text.textContent = "Complete!";
    fill.style.width = "100%";

    setTimeout(() => {
        overlay.style.display = "none";
    }, 400);
}



// -------------------------------
// Helpers
// -------------------------------
function getPitcherList(season) {
    if (!PRELOAD_COMPLETE[season]) return [];

    return PRELOADED_PITCHING[season]
        .filter(row => row.GS >= 10)   // ⭐ minimum 10 starts
        .map(row => row.Player);
}


function getPitcherRow(name, season) {
  if (!PRELOAD_COMPLETE[season]) return null;

  const lower = name.toLowerCase();

  return PRELOADED_PITCHING[season].find(row =>
    row.Player && row.Player.toLowerCase().includes(lower)
  );
}




// -------------------------------
// Safe helpers
// -------------------------------
function safeFixed(value, digits = 1) {
    return (value != null && !isNaN(value))
        ? Number(value).toFixed(digits)
        : "--";
}

function safeScore(value) {
    return (value != null && !isNaN(value))
        ? Number(value)
        : 0;
}

async function loadPitcher(name, season) {
    const url = `data/pitchers_${season}.json`;
    const res = await fetch(url);

    if (!res.ok) {
        alert("Season data not found.");
        return null;
    }

    const seasonData = await res.json();

    // Find the pitcher inside the JSON
    const pitcher = seasonData.find(p =>
        p.Player.toLowerCase().includes(name.toLowerCase())
    );

    if (!pitcher) {
        alert("Pitcher not found.");
        return null;
    }

    return pitcher;
}


// -------------------------------
// Battery fill updater
// -------------------------------
function updateBattery(id, score) {
    const el = document.getElementById(id);
    if (!el) return;

    const fill = (score / 10) * 100;

    // Decide color based on score
    let color;
    if (score < 3) {
        color = "#d50000";      // red
    } else if (score < 5.5) {
        color = "#ff9800";      // orange
    } else if (score < 7.5) {
        color = "#ffb400";      // yellow-orange
    } else {
        color = "#00c853";      // green
    }

    el.style.setProperty("--fillWidth", `${fill}%`);
    el.style.setProperty("--fillColor", color);
}

// -------------------------------
// Universal metric updater
// -------------------------------
function updateMetric(rawId, batteryId, scoreId, rawValue, scoreValue) {
    document.getElementById(rawId).textContent = rawValue;
    document.getElementById(scoreId).textContent = safeFixed(scoreValue, 1);
    updateBattery(batteryId, safeScore(scoreValue));
}

// -------------------------------
// Individual metric wrappers
// -------------------------------
function updateERA(raw, score)     { updateMetric("raw-era",  "battery-era",  "score-era",  raw, score); }
function updateWHIP(raw, score)    { updateMetric("raw-whip", "battery-whip", "score-whip", raw, score); }
function updateKpct(raw, score)    { updateMetric("raw-kpct", "battery-kpct", "score-kpct", raw, score); }
function updateBBpct(raw, score)   { updateMetric("raw-bbpct","battery-bbpct","score-bbpct",raw, score); }
function updateKBB(raw, score)     { updateMetric("raw-kbb",  "battery-kbb",  "score-kbb",  raw, score); }
function updateIP(raw, score)      { updateMetric("raw-ip",   "battery-ip",   "score-ip",   raw, score); }
function updateHR9(raw, score)     { updateMetric("raw-hr9",  "battery-hr9",  "score-hr9",  raw, score); }
function updateFIP(raw, score)     { updateMetric("raw-fip",  "battery-fip",  "score-fip",  raw, score); }

// -------------------------------
// Overall score + tier
// -------------------------------
function updateOverall(score) {
    document.getElementById("overallScore").textContent = safeFixed(score, 1);
    updateBattery("battery-overall", safeScore(score));
}

function updateTier(score) {
    let tier = "—";

    if (score >= 8.5) tier = "Ace";
    else if (score >= 7.0) tier = "Top Starter";
    else if (score >= 5.5) tier = "Mid Rotation";
    else if (score >= 4.0) tier = "Back End";
    else tier = "Depth";

    // Use badge HTML instead of plain text
    document.getElementById("overallTier").innerHTML =
        `<span class="tier-badge ${getTierClass(tier)}">${tier}</span>`;
}


// -------------------------------
// Scouting note generator
// -------------------------------
function updateScoutingNote(p) {
    const strengths = [];
    const concerns = [];

    // -------------------------
    // Strikeout traits (K%)
    // -------------------------
    if (p.Kpct > 28) strengths.push("impact swing‑and‑miss");
    else if (p.Kpct > 24) strengths.push("above‑average bat‑missing ability");
    else if (p.Kpct < 20) concerns.push("below‑average bat‑missing ability");

    // -------------------------
    // Traffic control (WHIP)
    // -------------------------
    if (p.WHIP < 1.10) strengths.push("premium traffic control");
    else if (p.WHIP < 1.20) strengths.push("manageable baserunner profile");
    else if (p.WHIP > 1.30) concerns.push("inconsistent command leading to traffic");

    // -------------------------
    // Strike‑throwing efficiency (K/BB)
    // -------------------------
    if (p.KBB > 4) strengths.push("efficient strike‑throwing");
    else if (p.KBB > 3) strengths.push("workable command");
    else if (p.KBB < 2) concerns.push("erratic strike‑throwing");

    // -------------------------
    // ⭐ NEW: Walk rate tiers (BB%)
    // -------------------------
    if (p.BBpct < 5) strengths.push("plus walk suppression");
    else if (p.BBpct < 7) strengths.push("solid underlying command");
    else if (p.BBpct > 9) concerns.push("elevated walk rate that may limit consistency");
    else if (p.BBpct > 11) concerns.push("high‑risk command profile with frequent free passes");

    // -------------------------
    // Underlying indicators (FIP)
    // -------------------------
    if (p.FIP < 3.5) strengths.push("supportive underlying metrics");
    else if (p.FIP < 4.0) strengths.push("stable underlying indicators");
    else if (p.FIP > 4.5) concerns.push("underlying indicators raise questions");

    // -------------------------
    // Build final note
    // -------------------------
    let note = "";

    if (strengths.length && !concerns.length) {
        note = "Profile built on " +
            strengths.join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
    } else if (!strengths.length && concerns.length) {
        note = "Concerns include " +
            concerns.join(", ").replace(/, ([^,]*)$/, " and $1") + ".";
    } else {
        note = "Shows " +
            strengths.join(", ").replace(/, ([^,]*)$/, " and $1") +
            " but " +
            concerns.join(", ").replace(/, ([^,]*)$/, " and $1") +
            ".";
    }

    // -------------------------
    // Add W-L Context
    // -------------------------
if (p.W !== undefined && p.L !== undefined) {
    const wl = `${p.W}-${p.L}`;
    note += `\nW–L this season: ${wl}.`;
}


    document.getElementById("scoutingNote").innerHTML = note;
}

// -------------------------------
// Main: Load player + update UI
// -------------------------------
async function handleLoad() {
    showSpinner("spinner1");

    try {
        const name = document.getElementById("playerName").value.trim();
        const season = parseInt(document.getElementById("seasonSelect").value);




        if (!name) {
            alert("Enter a player name.");
            return;
        }

        // -----------------------------------------
        // USE PRELOADED CSV DATA ONLY
        // -----------------------------------------
        const p = getPitcherRow(name, season);

        if (!p) {
            alert("Pitcher not found.");
            return;
        }

        // ---------------------------
        // SCORING
        // ---------------------------
        const eraScore  = scoreERA(p.ERA);
        const whipScore = scoreWHIP(p.WHIP);
        const kpctScore = scoreKpct(p.Kpct);
        const bbpctScore= scoreBBpct(p.BBpct);
        const kbbScore  = scoreKBB(p.KBB);
        const ipScore   = scoreIP(p.IP);
        const hr9Score  = scoreHR9(p.HR9);
        const fipScore  = scoreFIP(p.FIP);

        // ---------------------------
        // Update UI (final values)
        // ---------------------------
        updateERA(safeFixed(p.ERA, 2), eraScore);
        updateWHIP(safeFixed(p.WHIP, 2), whipScore);
        updateKpct(safeFixed(p.Kpct, 1), kpctScore);
        updateBBpct(safeFixed(p.BBpct, 1), bbpctScore);
        updateKBB(safeFixed(p.KBB, 2), kbbScore);
        updateIP(safeFixed(p.IP, 1), ipScore);
        updateHR9(safeFixed(p.HR9, 2), hr9Score);
        updateFIP(safeFixed(p.FIP, 2), fipScore);

        const overall = computeWeightedOverall({
            eraScore,
            whipScore,
            kpctScore,
            bbpctScore,
            kbbScore,
            ipScore,
            hr9Score,
            fipScore
        });

        updateOverall(overall);
        updateTier(overall);
        updateScoutingNote(p);

    } catch (err) {
        console.error("Error loading player:", err);
    } finally {
        hideSpinner("spinner1");
    }
}



//-------Weighted Overall Score-------
function computeWeightedOverall({
    eraScore,
    whipScore,
    kpctScore,
    bbpctScore,
    kbbScore,
    ipScore,
    hr9Score,
    fipScore
}) {
    return (
        eraScore  * 0.20 +
        whipScore * 0.20 +
        kpctScore * 0.15 +
        bbpctScore* 0.10 +
        kbbScore  * 0.15 +
        ipScore   * 0.10 +
        hr9Score  * 0.05 +
        fipScore  * 0.05
    );
}

// Clamp helper
function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

// ------------------------------
// ERA (lower = better)
// ------------------------------
function scoreERA(era) {
    const score = 10 * (5.00 - era) / (5.00 - 2.00);
    return clamp(score, 0, 10);
}

// ------------------------------
// WHIP (lower = better)
// ------------------------------
function scoreWHIP(whip) {
    const score = 10 * (1.40 - whip) / (1.40 - 0.90);
    return clamp(score, 0, 10);
}

// ------------------------------
// K% (higher = better)
// ------------------------------
function scoreKpct(kpct) {
    const score = 10 * (kpct - 15) / (35 - 15);
    return clamp(score, 0, 10);
}

// ------------------------------
// BB% (lower = better)
// ------------------------------
function scoreBBpct(bbpct) {
    const score = 10 * (10 - bbpct) / (10 - 3);
    return clamp(score, 0, 10);
}

// ------------------------------
// K/BB (higher = better)
// ------------------------------
function scoreKBB(kbb) {
    const score = 10 * (kbb - 1.5) / (6.0 - 1.5);
    return clamp(score, 0, 10);
}

// ------------------------------
// IP (higher = better)
// ------------------------------
function scoreIP(ip) {
    const score = 10 * (ip - 80) / (200 - 80);
    return clamp(score, 0, 10);
}

// ------------------------------
// HR/9 (lower = better)
// ------------------------------
function scoreHR9(hr9) {
    const score = 10 * (1.8 - hr9) / (1.8 - 0.5);
    return clamp(score, 0, 10);
}

// ------------------------------
// FIP (lower = better)
// ------------------------------
function scoreFIP(fip) {
    const score = 10 * (5.00 - fip) / (5.00 - 2.50);
    return clamp(score, 0, 10);
}

// -------------------------------
// Show Trend Emoji Button
// -------------------------------
async function showTrend(stat) {
    const name = document.getElementById("playerName").value.trim();
    if (!name) return alert("Enter a player name first.");

    const trend = await fetchTrendData(name, stat);
    if (!trend || trend.length === 0) {
        alert("No trend data available.");
        return;
    }

    const statNames = {
        ERA: "Earned Run Average",
        WHIP: "Walks + Hits per Inning",
        Kpct: "Strikeout Rate",
        BBpct: "Walk Rate",
        KBB: "Strikeout-to-Walk Ratio",
        IP: "Innings Pitched",
        HR9: "Home Runs per 9",
        FIP: "Fielding Independent Pitching"
    };

    let seasons = trend.map(t => t.season);
    let values = trend.map(t => t.value);

    // Remove leading nulls
    while (values.length > 0 && (values[0] === null || values[0] === undefined)) {
        values.shift();
        seasons.shift();
    }

    // Rookie / not enough data check
    if (seasons.length < 3) {
        document.getElementById("trendTitle").textContent =
            `${statNames[stat] || stat} Trend`;

        document.getElementById("trendChartContainer").innerHTML = `
            <div class="no-data-message">
                Not enough data to generate a trend chart.<br>
                (Minimum 3 seasons required)
            </div>
        `;

        document.getElementById("trendModal").style.display = "flex";
        return;
    }

    // Correct chart title
    document.getElementById("trendTitle").textContent =
        `${statNames[stat] || stat} Trend`;

    renderTrendChart(seasons, values, stat);

    document.getElementById("trendModal").style.display = "flex";
}


// -------------------------------
// Trend from Preload
// -------------------------------
function getTrendFromPreload(name, stat) {
    const lower = name.toLowerCase();
    const trend = [];

    for (const season of PRELOAD_SEASONS) {
        const rows = PRELOADED_PITCHING[season];
        if (!rows) continue;

        const row = rows.find(r =>
            r.Player && r.Player.toLowerCase().includes(lower)
        );

        if (!row) {
            trend.push({ season, value: null });
            continue;
        }

        const raw = row[stat];
        const value = raw !== undefined ? Number(raw) : null;

        trend.push({ season, value });
    }

    return trend;
}


// -------------------------------
// Show Trend Fetch (Preload First)
// -------------------------------
async function fetchTrendData(name, stat) {
    // 1. Try preload first
    const preloadTrend = getTrendFromPreload(name, stat);

    const validCount = preloadTrend.filter(t => t.value !== null).length;

    // If preload has enough data, use it
    if (validCount >= 3) {
        return preloadTrend;
    }

    // 2. Fallback to backend
    const url = `/api/pitcherTrend?name=${encodeURIComponent(name)}&stat=${stat}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Trend fetch failed");
        return null;
    }

    return await res.json();
}


// -------------------------------
// Render Chart.js Line Graph
// -------------------------------
let trendChart = null;

function renderTrendChart(seasons, values, stat) {

    // ⭐ FIX: Reverse arrays so chart is oldest → newest
    seasons = [...seasons].reverse();
    values  = [...values].reverse();

    const container = document.getElementById("trendChartContainer");
    container.innerHTML = '<canvas id="trendChart"></canvas>';

    const ctx = document.getElementById("trendChart").getContext("2d");

    if (trendChart) trendChart.destroy();

    trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: seasons,
            datasets: [{
                label: stat + " Trend",
                data: values,
                borderColor: "#007bff",
                backgroundColor: "rgba(0,123,255,0.2)",
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 4
            }]
        },
        options: {
            scales: {
                y: { beginAtZero: false }
            }
        }
    });
}


// -------------------------------
// Compare Modal Function (Updated for Preload Only)
// -------------------------------
async function showCompareModal() {
    showSpinner("spinner2");
    console.log("COMPARE BUTTON CLICKED");

    try {
        const p1 = document.getElementById("playerName").value.trim();
        const s1 = document.getElementById("seasonSelect").value;

        const p2 = document.getElementById("playerName2").value.trim();
        const s2 = document.getElementById("seasonSelect2").value;

        if (!p1 || !p2) {
            alert("Enter both pitcher names.");
            return;
        }

        // -----------------------------------------
        // ⭐ 1. PRELOAD LOOKUP ONLY
        // -----------------------------------------
        const data1 = getPitcherRow(p1, s1);
        const data2 = getPitcherRow(p2, s2);

        if (!data1 || !data2) {
            alert("One or both pitchers not found.");
            return;
        }

        document.getElementById("compareName1").textContent = `${p1} (${s1})`;
        document.getElementById("compareName2").textContent = `${p2} (${s2})`;

        // -----------------------------------------
        // ⭐ 2. Compute Score Components
        // -----------------------------------------
        const s1_ERA  = scoreERA(data1.ERA);
        const s1_WHIP = scoreWHIP(data1.WHIP);
        const s1_Kpct = scoreKpct(data1.Kpct);
        const s1_BBpct = scoreBBpct(data1.BBpct);
        const s1_KBB = scoreKBB(data1.KBB);
        const s1_IP = scoreIP(data1.IP);
        const s1_HR9 = scoreHR9(data1.HR9);
        const s1_FIP = scoreFIP(data1.FIP);

        const s2_ERA  = scoreERA(data2.ERA);
        const s2_WHIP = scoreWHIP(data2.WHIP);
        const s2_Kpct = scoreKpct(data2.Kpct);
        const s2_BBpct = scoreBBpct(data2.BBpct);
        const s2_KBB = scoreKBB(data2.KBB);
        const s2_IP = scoreIP(data2.IP);
        const s2_HR9 = scoreHR9(data2.HR9);
        const s2_FIP = scoreFIP(data2.FIP);

        // -----------------------------------------
        // ⭐ 3. Weighted Overall Score
        // -----------------------------------------
        const overall1 =
            s1_ERA * 0.20 +
            s1_WHIP * 0.20 +
            s1_Kpct * 0.15 +
            s1_BBpct * 0.10 +
            s1_KBB * 0.15 +
            s1_IP * 0.10 +
            s1_HR9 * 0.05 +
            s1_FIP * 0.05;

        const overall2 =
            s2_ERA * 0.20 +
            s2_WHIP * 0.20 +
            s2_Kpct * 0.15 +
            s2_BBpct * 0.10 +
            s2_KBB * 0.15 +
            s2_IP * 0.10 +
            s2_HR9 * 0.05 +
            s2_FIP * 0.05;

        // -----------------------------------------
        // ⭐ 4. Stats Table
        // -----------------------------------------
        const stats = [
            ["ERA", data1.ERA, data2.ERA],
            ["WHIP", data1.WHIP, data2.WHIP],
            ["K%", data1.Kpct, data2.Kpct],
            ["BB%", data1.BBpct, data2.BBpct],
            ["K/BB", data1.KBB, data2.KBB],
            ["IP", data1.IP, data2.IP],
            ["HR/9", data1.HR9, data2.HR9],
            ["FIP", data1.FIP, data2.FIP],
            ["Overall Score", overall1.toFixed(2), overall2.toFixed(2)]
        ];

        const tbody = document.getElementById("compareBody");
        tbody.innerHTML = "";

        stats.forEach(([label, v1, v2]) => {
            const row = document.createElement("tr");

            let class1 = "tie";
            let class2 = "tie";

            if (v1 != null && v2 != null) {
                if (
                    label === "ERA" ||
                    label === "WHIP" ||
                    label === "BB%" ||
                    label === "HR/9" ||
                    label === "FIP"
                ) {
                    if (v1 < v2) { class1 = "win"; class2 = "lose"; }
                    else if (v2 < v1) { class1 = "lose"; class2 = "win"; }
                } else {
                    if (v1 > v2) { class1 = "win"; class2 = "lose"; }
                    else if (v2 > v1) { class1 = "lose"; class2 = "win"; }
                }
            }

            row.innerHTML = `
                <td>${label}</td>
                <td class="${class1}">${v1 ?? "—"}</td>
                <td class="${class2}">${v2 ?? "—"}</td>
            `;

            tbody.appendChild(row);
        });

        document.getElementById("compareModal").style.display = "flex";

    } catch (err) {
        console.error("Compare error:", err);
    } finally {
        hideSpinner("spinner2");
    }
}



// -------------------------------
// Pitcher Tier Assignment
// -------------------------------
function getPitcherTier(score) {
    if (score >= 8.5) return "Ace";
    if (score >= 7.0) return "Top Starter";
    if (score >= 5.5) return "Mid Rotation";
    if (score >= 4.0) return "Back End";
    return "Depth";
}

// -------------------------------
// Rank Button
// -------------------------------
async function fetchPitcherList(season) {
    const res = await fetch(`/api/pitcherList?season=${season}`);
    if (!res.ok) return [];
    return await res.json();
}

// ⭐ Batch loader to prevent resource exhaustion
async function fetchInBatches(list, season, batchSize = 10) {
    const results = [];

    for (let i = 0; i < list.length; i += batchSize) {
        const batch = list.slice(i, i + batchSize);

        const batchResults = await Promise.all(
            batch.map(p => loadPitcher(p.name, season))
        );

        results.push(...batchResults);
    }

    return results;
}

// -------------------------------
// Rank Button (Updated for Preload Only)
// -------------------------------
document.getElementById("rankBtn").addEventListener("click", async () => {
    const season = document.getElementById("seasonSelect2").value;

    document.getElementById("rankTitle").textContent =
        `Top Pitcher Rankings — ${season}`;

    // -----------------------------------------
    // ⭐ 1. Get pitcher list from PRELOAD
    // -----------------------------------------
    const list = getPitcherList(season);
    if (!list || list.length === 0) {
        alert("No pitchers found for this season.");
        return;
    }

    // -----------------------------------------
// ⭐ 2. Get pitcher rows directly from PRELOAD (with GS filter)
// -----------------------------------------
const stats = [];

for (const name of list) {
    const p = getPitcherRow(name, season);   // ⭐ use preloaded data only
    if (!p) continue;

    // ⭐ FILTER: Only include real starters
    if (typeof p.GS !== "number" || p.GS < 10) continue;

    stats.push({ name, p });
}


    // -----------------------------------------
    // ⭐ 3. Compute weighted scores
    // -----------------------------------------
    const scored = stats
        .map(({ name, p }) => {
            const score = computeWeightedOverall({
                eraScore:   scoreERA(p.ERA),
                whipScore:  scoreWHIP(p.WHIP),
                kpctScore:  scoreKpct(p.Kpct),
                bbpctScore: scoreBBpct(p.BBpct),
                kbbScore:   scoreKBB(p.KBB),
                ipScore:    scoreIP(p.IP),
                hr9Score:   scoreHR9(p.HR9),
                fipScore:   scoreFIP(p.FIP)
            });

            return {
                name,
                score,
                tier: getPitcherTier(score)
            };
        })
        .filter(x => x && !Number.isNaN(x.score));

    // -----------------------------------------
    // ⭐ 4. Sort + Render
    // -----------------------------------------
    scored.sort((a, b) => b.score - a.score);

    renderPitcherRankModal(scored.slice(0, 40), season);
});




// -------------------------------
// Render Rank Modal
// -------------------------------
function renderPitcherRankModal(list, season) {
    const tbody = document.getElementById("rankBody");
    tbody.innerHTML = "";

    list.forEach((p, i) => {
        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${i + 1}</td>
            <td>${p.name}</td>
            <td>${p.score.toFixed(1)}</td>
            <td><span class="tier-badge ${getTierClass(p.tier)}">${p.tier}</span></td>
        `;

        tbody.appendChild(tr);
    });

    // Update modal title
    document.getElementById("rankTitle").textContent =
        `Top Pitcher Rankings — ${season}`;

    // Show modal
    document.getElementById("rankModal").style.display = "flex";
}

function getTierClass(tier) {
    switch (tier) {
        case "Ace": return "tier-great";
        case "Top Starter": return "tier-good";
        case "Mid Rotation": return "tier-fair";
        case "Back End": return "tier-average";
        case "Depth": return "tier-belowavg";
        default: return "";
    }
}




// -------------------------------
// Swap Button
// -------------------------------
document.getElementById("swapBtn").onclick = function () {
    const name1 = document.getElementById("playerName");
    const season1 = document.getElementById("seasonSelect");

    const name2 = document.getElementById("playerName2");
    const season2 = document.getElementById("seasonSelect2");

    // Swap values
    const tempName = name1.value;
    const tempSeason = season1.value;

    name1.value = name2.value;
    season1.value = season2.value;

    name2.value = tempName;
    season2.value = tempSeason;

    // Trigger your existing update logic
    document.getElementById("btnGenerate").click();
};

// -------------------------------
// Spinner Helpers
// -------------------------------
function showSpinner(id) {
    document.getElementById(id).style.display = "inline-block";
}

function hideSpinner(id) {
    document.getElementById(id).style.display = "none";
}

// -------------------------------
// Reset UI
// -------------------------------
function handleReset() {
    // Reset text
    document.querySelectorAll(".metric-raw").forEach(el => el.textContent = "--");
    document.querySelectorAll(".metric-score").forEach(el => el.textContent = "--");

    // Reset batteries visually
    document.querySelectorAll(".battery").forEach(el => {
        el.style.setProperty("--fillWidth", "0%");
        el.style.setProperty("--fillColor", "#d50000"); // default low score color
    });

    // Reset overall
    document.getElementById("overallScore").textContent = "--";
    document.getElementById("overallTier").textContent = "--";
    document.getElementById("scoutingNote").textContent = "--";
}

// -------------------------------
// Latest Update Timestamp
// -------------------------------
async function loadLastUpdated(season) {
    const res = await fetch(`/api/last-updated/pitchers/${season}`);
    const data = await res.json();

    const date = new Date(data.lastUpdated);
    const formatted = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    document.getElementById('lastUpdated').textContent =
        `Last updated on ${formatted}`;
}




// -------------------------------
// Event listeners
// -------------------------------
document.getElementById("loadBtn").addEventListener("click", handleLoad);
document.getElementById("resetBtn").addEventListener("click", handleReset);

document.querySelectorAll(".trend-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        const stat = btn.dataset.stat;
        showTrend(stat);
    });
});


// ------------------------------
// Trend Modal Close Button
// ------------------------------
document.getElementById("trendClose").addEventListener("click", () => {
    document.getElementById("trendModal").style.display = "none";
});


// ------------------------------
// Compare Modal Close Button
// ------------------------------
document.getElementById("compareBtn").addEventListener("click", () => {
    showCompareModal();
});

document.getElementById("compareClose").addEventListener("click", () => {
    document.getElementById("compareModal").style.display = "none";
});

// ------------------------------
// Rank Modal Close Button
// ------------------------------
document.getElementById("rankClose").addEventListener("click", () => {
    document.getElementById("rankModal").style.display = "none";
});

// ------------------------------
// Latest Updated CSV Timestamp
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
    const seasonSelect = document.getElementById("seasonSelect");
    const defaultSeason = seasonSelect.value;
    loadLastUpdated(defaultSeason);
});


window.addEventListener("load", preloadPitcherData);
