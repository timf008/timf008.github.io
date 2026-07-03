// -----------------------------------------------------
// Batter Analyzer - app.js
// Backend-only, no CSV preload
// -----------------------------------------------------

// -------------------------------
// Safe helpers
// -------------------------------
function safeFixed(value, digits = 3) {
    return (value != null && !isNaN(value))
        ? Number(value).toFixed(digits)
        : "--";
}

function safeScore(value) {
    return (value != null && !isNaN(value))
        ? Number(value)
        : 0;
}

// =====================================================
// Utility: Normalize name to match R script (First Last)
// =====================================================
function normalizeNameFrontend(x) {
    return x
        .normalize("NFKD")               // strip accents
        .replace(/[^\w\s-]/g, "")        // remove non-ASCII
        .replace(/\s+/g, " ")            // collapse spaces
        .trim();                         // keep First Last order
}

// -------------------------------
// Utility: Fetch batter data
// -------------------------------
async function loadBatter(name, season) {
    const clean = normalizeNameFrontend(name);

    const url = `https://batter-analyzer-backend.onrender.com/api/batters?name=${encodeURIComponent(clean)}&season=${season}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Batter fetch failed", await res.text());
        return null;
    }

    const data = await res.json();

    // ⭐ Normalize backend output: ALWAYS return an array
    return Array.isArray(data) ? data : [data];
}


// -------------------------------
// Battery fill updater
// -------------------------------
function updateBattery(id, score) {
    const el = document.getElementById(id);
    if (!el) return;

    const fill = (score / 10) * 100;

    let color;
    if (score < 3) color = "#d50000";
    else if (score < 5.5) color = "#ff9800";
    else if (score < 7.5) color = "#ffb400";
    else color = "#00c853";

    el.style.setProperty("--fill", `${fill}%`);
    el.style.setProperty("--color", color);
}

function updateOverall(score) {
    document.getElementById("overallScore").textContent = safeFixed(score, 1);
    updateBattery("battery-overall", safeScore(score));
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
// Individual metric wrappers (Batting 5‑metric model)
// -------------------------------
function updateBA(raw, score)      { updateMetric("raw-ba",    "battery-ba",    "score-ba",    stripZero(raw), score); }
function updateOBP(raw, score)     { updateMetric("raw-obp",   "battery-obp",   "score-obp",   stripZero(raw), score); }
function updateSLG(raw, score)     { updateMetric("raw-slg",   "battery-slg",   "score-slg",   stripZero(raw), score); }
function updateKpct(raw, score)    { updateMetric("raw-kpct",  "battery-kpct",  "score-kpct",  raw, score); }
function updateBBpct(raw, score)   { updateMetric("raw-bbpct", "battery-bbpct", "score-bbpct", raw, score); }


// -------------------------------
// Overall score + tier
// -------------------------------
function updateOverall(score) {
    document.getElementById("overallScore").textContent = safeFixed(score, 1);
    updateBattery("battery-overall", safeScore(score));
}



// -------------------------------
// Tier → CSS class mapping
// -------------------------------
function getTierClass(tier) {
    switch (tier) {
        case "Elite": return "tier-great";
        case "Impact": return "tier-good";
        case "Solid": return "tier-fair";
        case "Developing": return "tier-average";
        case "Limited": return "tier-belowavg";
        default: return "";
    }
}

// -------------------------------
// Tier assignment (batting version)
// -------------------------------
function updateTier(score) {
    let tier = "—";

    if (score >= 8.5) tier = "Elite";
    else if (score >= 7.0) tier = "Impact";
    else if (score >= 5.5) tier = "Solid";
    else if (score >= 4.0) tier = "Developing";
    else tier = "Limited";

    document.getElementById("overallTier").innerHTML =
        `<span class="tier-badge ${getTierClass(tier)}">${tier}</span>`;
}


// -------------------------------
// Scouting note generator (Batting 5‑metric model)
// -------------------------------
function updateScoutingNote(p) {
    const strengths = [];
    const concerns = [];

    // BA
    if (p.BA >= 0.300) strengths.push("premium contact ability");
    else if (p.BA >= 0.270) strengths.push("above‑average hit tool");
    else if (p.BA < 0.240) concerns.push("inconsistent contact quality");

    // OBP
    if (p.OBP >= 0.380) strengths.push("elite on‑base skill");
    else if (p.OBP >= 0.340) strengths.push("strong plate discipline");
    else if (p.OBP < 0.300) concerns.push("limited on‑base production");

    // SLG
    if (p.SLG >= 0.550) strengths.push("impact power production");
    else if (p.SLG >= 0.450) strengths.push("workable gap power");
    else if (p.SLG < 0.380) concerns.push("below‑average impact on contact");

    // K%
    if (p.Kpct <= 18) strengths.push("advanced bat‑to‑ball skill");
    else if (p.Kpct <= 24) strengths.push("manageable swing‑and‑miss profile");
    else if (p.Kpct > 30) concerns.push("high swing‑and‑miss rate that may limit consistency");

    // BB%
    if (p.BBpct >= 12) strengths.push("plus walk generation");
    else if (p.BBpct >= 8) strengths.push("solid underlying discipline");
    else if (p.BBpct < 5) concerns.push("limited walk production");

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

    document.getElementById("scoutingNote").innerHTML = note;
}

// -------------------------------
// Weighted Overall Score (Batting 5‑metric model)
// -------------------------------
function computeWeightedOverall({
    baScore,
    obpScore,
    slgScore,
    kpctScore,
    bbpctScore
}) {
    return (
        baScore   * 0.25 +   // contact
        obpScore  * 0.25 +   // discipline / on-base
        slgScore  * 0.25 +   // power
        kpctScore * 0.15 +   // bat-to-ball
        bbpctScore* 0.10     // walk skill
    );
}

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

// ------------------------------
// Scoring functions (Batting 5‑metric model)
// ------------------------------

// BA: .300 = elite, .240 = fringe
function scoreBA(ba) {
    const score = 10 * (ba - 0.240) / (0.300 - 0.240);
    return clamp(score, 0, 10);
}

// OBP: .380 = elite, .300 = fringe
function scoreOBP(obp) {
    const score = 10 * (obp - 0.300) / (0.380 - 0.300);
    return clamp(score, 0, 10);
}

// SLG: .550 = elite, .380 = fringe
function scoreSLG(slg) {
    const score = 10 * (slg - 0.380) / (0.550 - 0.380);
    return clamp(score, 0, 10);
}

// K%: lower is better (reverse scale)
function scoreKpct(kpct) {
    const score = 10 * (30 - kpct) / (30 - 15);
    return clamp(score, 0, 10);
}

// BB%: higher is better
function scoreBBpct(bbpct) {
    const score = 10 * (bbpct - 5) / (12 - 5);
    return clamp(score, 0, 10);
}

// -------------------------------
// Utility helpers
// -------------------------------
function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

function stripZero(x) {
    return String(x).replace(/^0+/, "");
}


// -------------------------------
// Main: Load player + update UI (backend-only)
// -------------------------------
async function handleLoad() {
    const spin = document.getElementById("spinner1");
    spin.classList.add("spin");

    try {
        const name = document.getElementById("playerName").value.trim();
        const season = parseInt(document.getElementById("seasonSelect").value);

        if (!name) {
            alert("Enter a player name.");
            return;
        }

        const data = await loadBatter(name, season);

        if (!data || data.error || (Array.isArray(data) && data.length === 0)) {
            alert("Batter not found.");
            return;
        }

        const p = Array.isArray(data) ? data[0] : data;

        const baScore   = scoreBA(p.BA);
        const obpScore  = scoreOBP(p.OBP);
        const slgScore  = scoreSLG(p.SLG);
        const kpctScore = scoreKpct(p.Kpct);
        const bbpctScore= scoreBBpct(p.BBpct);

        updateBA(safeFixed(p.BA, 3), baScore);
        updateOBP(safeFixed(p.OBP, 3), obpScore);
        updateSLG(safeFixed(p.SLG, 3), slgScore);
        updateKpct(safeFixed(p.Kpct, 1), kpctScore);
        updateBBpct(safeFixed(p.BBpct, 1), bbpctScore);

        const overall = computeWeightedOverall({
            baScore,
            obpScore,
            slgScore,
            kpctScore,
            bbpctScore
        });

        updateOverall(overall);
        updateTier(overall);
        updateScoutingNote(p);

    } catch (err) {
        console.error("Error loading player:", err);
    } finally {
        spin.classList.remove("spin");
    }
}


// -------------------------------
// Trend Handler (Season Comparison)
// -------------------------------
async function handleTrend() {
    const spin = document.getElementById("spinner1");
    spin.classList.add("spin");

    try {
        const rawName = document.getElementById("playerName").value.trim();
        if (!rawName) {
            alert("Enter a player name first.");
            return;
        }

        const season = Number(document.getElementById("seasonSelect").value);
        const lastSeason = season - 1;

        // Fetch both seasons using batting API
        const currArr = await fetch(
            `https://batter-analyzer-backend.onrender.com/api/batters?name=${encodeURIComponent(rawName)}&season=${season}`
        ).then(r => r.json());

        const prevArr = await fetch(
            `https://batter-analyzer-backend.onrender.com/api/batters?name=${encodeURIComponent(rawName)}&season=${lastSeason}`
        ).then(r => r.json());

        const curr = Array.isArray(currArr) ? currArr[0] : currArr;
        const prev = Array.isArray(prevArr) ? prevArr[0] : prevArr;

        if (!curr || curr.error || !prev || prev.error) {
            alert("Not enough data for season comparison.");
            return;
        }

        // Must have batting metrics
        if (curr.BA == null || prev.BA == null) {
            alert("Not enough data for season comparison.");
            return;
        }

        const html = buildSeasonComparison(curr, prev, season, lastSeason);

        document.getElementById("trendTitle").textContent =
            `Season Comparison (${season} vs ${lastSeason})`;

        document.getElementById("trendBody").innerHTML = html;
        document.getElementById("trendModal").style.display = "flex";

    } catch (err) {
        console.error("Trend error:", err);
    } finally {
        spin.classList.remove("spin");
    }
}


// -------------------------------
// Trend Table (Season Comparison)
// -------------------------------
function buildSeasonComparison(curr, prev, season, lastSeason) {

    const stats = [
        { key: "BA",    label: "BA",    higherIsBetter: true  },
        { key: "OBP",   label: "OBP",   higherIsBetter: true  },
        { key: "SLG",   label: "SLG",   higherIsBetter: true  },
        { key: "Kpct",  label: "K%",    higherIsBetter: false },
        { key: "BBpct", label: "BB%",   higherIsBetter: true  }
    ];

    let rows = stats.map(s => {
        const a = Number(curr[s.key]);
        const b = Number(prev[s.key]);

        const arrow =
            a === b ? "➖" :
            s.higherIsBetter
                ? (a > b ? "▲" : "▼")
                : (a < b ? "▲" : "▼");

        const arrowClass =
            arrow === "▲" ? "trend-up" :
            arrow === "▼" ? "trend-down" :
            "trend-flat";

        // ⭐ Correct formatting rules
        let dispA, dispB;

        if (s.key === "Kpct" || s.key === "BBpct") {
            dispA = isNaN(a) ? "--" : a.toFixed(1);
            dispB = isNaN(b) ? "--" : b.toFixed(1);
        } else {
            dispA = isNaN(a) ? "--" : stripZero(a.toFixed(3));
            dispB = isNaN(b) ? "--" : stripZero(b.toFixed(3));
        }

        return `
        <tr>
            <td>${s.label}</td>
            <td>${dispA}</td>
            <td>${dispB}</td>
            <td class="${arrowClass}">${arrow}</td>
        </tr>
        `;
    }).join("");

    return `
        <table class="trend-table">
            <thead>
                <tr>
                    <th>Stat</th>
                    <th>${season}</th>
                    <th>${lastSeason}</th>
                    <th>Trend</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
            </tbody>
        </table>
    `;
}


// -------------------------------
// Compare Button (Batting Version)
// -------------------------------
async function showCompareModal() {
    const spin = document.getElementById("spinner1");
    spin.classList.add("spin");
    console.log("COMPARE BUTTON CLICKED");

    function formatName(name) {
        return name
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    try {
        const p1_raw = document.getElementById("playerName").value.trim();
        const s1 = document.getElementById("seasonSelect").value;

        const p2_raw = document.getElementById("playerName2").value.trim();
        const s2 = document.getElementById("seasonSelect2").value;

        if (!p1_raw || !p2_raw) {
            alert("Enter both batter names.");
            return;
        }

        const data1Arr = await loadBatter(p1_raw, s1);
        const data2Arr = await loadBatter(p2_raw, s2);

        const data1 = Array.isArray(data1Arr) ? data1Arr[0] : data1Arr;
        const data2 = Array.isArray(data2Arr) ? data2Arr[0] : data2Arr;

        if (!data1 || data1.error || !data2 || data2.error) {
            alert("One or both batters not found.");
            return;
        }

        if (data1.BA == null || data2.BA == null) {
            alert("Not enough data for comparison.");
            return;
        }

        const p1_display = formatName(data1.Name || p1_raw);
        const p2_display = formatName(data2.Name || p2_raw);

        document.getElementById("compareName1").textContent = `${p1_display} (${s1})`;
        document.getElementById("compareName2").textContent = `${p2_display} (${s2})`;

        // ⭐ Batting scores
        const s1_BA    = scoreBA(data1.BA);
        const s1_OBP   = scoreOBP(data1.OBP);
        const s1_SLG   = scoreSLG(data1.SLG);
        const s1_Kpct  = scoreKpct(data1.Kpct);
        const s1_BBpct = scoreBBpct(data1.BBpct);

        const s2_BA    = scoreBA(data2.BA);
        const s2_OBP   = scoreOBP(data2.OBP);
        const s2_SLG   = scoreSLG(data2.SLG);
        const s2_Kpct  = scoreKpct(data2.Kpct);
        const s2_BBpct = scoreBBpct(data2.BBpct);

        const overall1 = computeWeightedOverall({
            baScore: s1_BA,
            obpScore: s1_OBP,
            slgScore: s1_SLG,
            kpctScore: s1_Kpct,
            bbpctScore: s1_BBpct
        });

        const overall2 = computeWeightedOverall({
            baScore: s2_BA,
            obpScore: s2_OBP,
            slgScore: s2_SLG,
            kpctScore: s2_Kpct,
            bbpctScore: s2_BBpct
        });

        // ⭐ RAW + FORMATTED VALUES (Batting)
        const stats = [
            ["BA",   data1.BA,    data2.BA,    stripZero(data1.BA.toFixed(3)),    stripZero(data2.BA.toFixed(3))],
            ["OBP",  data1.OBP,   data2.OBP,   stripZero(data1.OBP.toFixed(3)),   stripZero(data2.OBP.toFixed(3))],
            ["SLG",  data1.SLG,   data2.SLG,   stripZero(data1.SLG.toFixed(3)),   stripZero(data2.SLG.toFixed(3))],
            ["K%",   data1.Kpct,  data2.Kpct,  data1.Kpct.toFixed(1),             data2.Kpct.toFixed(1)],
            ["BB%",  data1.BBpct, data2.BBpct, data1.BBpct.toFixed(1),            data2.BBpct.toFixed(1)],
            ["Overall Score", overall1, overall2, overall1.toFixed(1),            overall2.toFixed(1)]
        ];

        const tbody = document.getElementById("compareBody");
        tbody.innerHTML = "";

        stats.forEach(([label, raw1, raw2, disp1, disp2]) => {
            const row = document.createElement("tr");

            let class1 = "tie";
            let class2 = "tie";

            if (raw1 != null && raw2 != null) {
                // Lower is better for K%
                if (label === "K%") {
                    if (raw1 < raw2) { class1 = "win"; class2 = "lose"; }
                    else if (raw2 < raw1) { class1 = "lose"; class2 = "win"; }
                }
                // Higher is better for everything else
                else {
                    if (raw1 > raw2) { class1 = "win"; class2 = "lose"; }
                    else if (raw2 > raw1) { class1 = "lose"; class2 = "win"; }
                }
            }

            row.innerHTML = `
                <td>${label}</td>
                <td class="${class1}">${disp1}</td>
                <td class="${class2}">${disp2}</td>
            `;

            tbody.appendChild(row);
        });

        document.getElementById("compareModal").style.display = "flex";

    } catch (err) {
        console.error("Compare error:", err);
    } finally {
        spin.classList.remove("spin");
    }
}


// -------------------------------
// Leaders Button
// -------------------------------
async function loadLeaders() {
    const spin = document.getElementById("spinner1");
    spin.classList.add("spin");

    try {
        const season = document.getElementById("seasonSelect").value;

        const data = await fetch(
            `https://batter-analyzer-backend.onrender.com/api/leaders?season=${season}`
        ).then(r => r.json());

        if (!Array.isArray(data)) {
            alert("No leaderboard data available.");
            return;
        }

        buildLeadersTable(data);

    } catch (err) {
        console.error("Leaders error:", err);
        alert("Error loading leaderboard.");
    } finally {
        spin.classList.remove("spin");
    }
}

// -------------------------------
// Leaders Table
// -------------------------------
function buildLeadersTable(arr) {
    const tbody = document.getElementById("leadersBody");
    tbody.innerHTML = "";

    // Compute score
    arr.forEach(p => {
        p.Score =
            (p.BA * 1000) +
            (p.OBP * 1000) +
            (p.SLG * 1000) +
            (p.BBpct * 2) -
            (p.Kpct * 1.5);
    });

    // Top 10
    const top10 = [...arr]
        .sort((a, b) => b.Score - a.Score)
        .slice(0, 10);

    // Assign badges
    top10.forEach((p, i) => {
        if (i === 0) {
            p.Badge = "🔥 #1";
        } else if (i === 1) {
            p.Badge = "⭐ #2";
        } else if (i === 2) {
            p.Badge = "⭐ #3";
        } else {
            p.Badge = "🏅 Top 10";
        }
    });

    // Build table
    top10.forEach(p => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${p.Player}</td>
            <td>${p.Score.toFixed(0)}</td>
            <td>${p.Badge}</td>
        `;

        tbody.appendChild(row);
    });

    document.getElementById("leadersModal").style.display = "flex";
}





// -------------------------------
// Batter Tier Assignment
// -------------------------------
function getBatterTier(score) {
    if (score >= 8.5) return "Elite";
    if (score >= 7.0) return "Impact";
    if (score >= 5.5) return "Solid";
    if (score >= 4.0) return "Developing";
    return "Limited";
}


// -------------------------------
// Swap Button
// -------------------------------
document.getElementById("swapBtn").onclick = function () {
    const name1 = document.getElementById("playerName");
    const season1 = document.getElementById("seasonSelect");

    const name2 = document.getElementById("playerName2");
    const season2 = document.getElementById("seasonSelect2");

    const tempName = name1.value;
    const tempSeason = season1.value;

    name1.value = name2.value;
    season1.value = season2.value;

    name2.value = tempName;
    season2.value = tempSeason;

    // Trigger the correct load button
    document.getElementById("loadBtn").click();
};


// -------------------------------
// Reset UI
// -------------------------------
function handleReset() {
    document.querySelectorAll(".metric-raw").forEach(el => el.textContent = "--");
    document.querySelectorAll(".metric-score").forEach(el => el.textContent = "--");

    document.querySelectorAll(".battery").forEach(el => {
    el.style.setProperty("--fill", "0%");
    el.style.setProperty("--color", "#d50000");
});


    document.getElementById("overallScore").textContent = "--";
    document.getElementById("overallTier").innerHTML = "";
    document.getElementById("scoutingNote").innerHTML = "";
}

// -------------------------------
// Latest Update Timestamp Defined
// -------------------------------
const currentSeason = document.getElementById("seasonSelect").value;

// -------------------------------
// Latest Update Timestamp (Improved)
// -------------------------------
async function loadLastUpdated(season) {
    const url = `https://batter-analyzer-backend.onrender.com/api/last-updated/batters/${season}`;

    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error("Network error");

        const data = await res.json();
        const raw = data?.lastUpdated;

        const el = document.getElementById('lastUpdated');

        // Handle missing or invalid date
        if (!raw) {
            el.textContent = "Last updated: unavailable";
            return;
        }

        const date = new Date(raw);
        if (isNaN(date.getTime())) {
            el.textContent = "Last updated: invalid date";
            return;
        }

        const formatted = new Intl.DateTimeFormat("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
        }).format(date);

        el.textContent = `Last updated on ${formatted}`;

    } catch (err) {
        document.getElementById('lastUpdated').textContent =
            "Last updated: error loading timestamp";
    }
}


// -------------------------------
// Wire up UI buttons
// -------------------------------
document.addEventListener("DOMContentLoaded", () => {

    // Main buttons
    document.getElementById("loadBtn").addEventListener("click", handleLoad);
    document.getElementById("resetBtn").addEventListener("click", handleReset);
    document.getElementById("compareBtn").addEventListener("click", showCompareModal);
    document.getElementById("leadersBtn").addEventListener("click", loadLeaders);
    document.getElementById("trendBtn").addEventListener("click", handleTrend);

    // Timestamp
    loadLastUpdated(currentSeason);

    // Close modals
    document.getElementById("trendClose").onclick = () =>
        document.getElementById("trendModal").style.display = "none";

    document.getElementById("leadersClose").onclick = () =>
        document.getElementById("leadersModal").style.display = "none";

    document.getElementById("compareClose").onclick = () =>
        document.getElementById("compareModal").style.display = "none";

    // Click outside to close Leaders
    window.addEventListener("click", (e) => {
        const modal = document.getElementById("leadersModal");
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
});




