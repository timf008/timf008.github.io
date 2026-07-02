// -----------------------------------------------------
// Pitcher Analyzer - app.js
// Backend-only, no CSV preload
// -----------------------------------------------------

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
// Utility: Fetch pitcher data
// -------------------------------
async function loadPitcher(name, season) {
    const clean = normalizeNameFrontend(name);

    const url = `https://pitcher-analyzer-backend.onrender.com/api/pitchers?name=${encodeURIComponent(clean)}&season=${season}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Pitcher fetch failed", await res.text());
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
    if (score < 3) {
        color = "#d50000";
    } else if (score < 5.5) {
        color = "#ff9800";
    } else if (score < 7.5) {
        color = "#ffb400";
    } else {
        color = "#00c853";
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
// Individual metric wrappers (5‑metric model)
// -------------------------------
function updateERA(raw, score)     { updateMetric("raw-era",  "battery-era",  "score-era",  raw, score); }
function updateWHIP(raw, score)    { updateMetric("raw-whip", "battery-whip", "score-whip", raw, score); }
function updateKpct(raw, score)    { updateMetric("raw-kpct", "battery-kpct", "score-kpct", raw, score); }
function updateBBpct(raw, score)   { updateMetric("raw-bbpct","battery-bbpct","score-bbpct",raw, score); }
function updateKBB(raw, score)     { updateMetric("raw-kbb",  "battery-kbb",  "score-kbb",  raw, score); }


// -------------------------------
// Overall score + tier
// -------------------------------
function updateOverall(score) {
    document.getElementById("overallScore").textContent = safeFixed(score, 1);
    updateBattery("battery-overall", safeScore(score));
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

function updateTier(score) {
    let tier = "—";

    if (score >= 8.5) tier = "Ace";
    else if (score >= 7.0) tier = "Top Starter";
    else if (score >= 5.5) tier = "Mid Rotation";
    else if (score >= 4.0) tier = "Back End";
    else tier = "Depth";

    document.getElementById("overallTier").innerHTML =
        `<span class="tier-badge ${getTierClass(tier)}">${tier}</span>`;
}

// -------------------------------
// Scouting note generator (5‑metric model)
// -------------------------------
function updateScoutingNote(p) {
    const strengths = [];
    const concerns = [];

    // K%
    if (p.Kpct > 28) strengths.push("impact swing‑and‑miss");
    else if (p.Kpct > 24) strengths.push("above‑average bat‑missing ability");
    else if (p.Kpct < 20) concerns.push("below‑average bat‑missing ability");

    // WHIP
    if (p.WHIP < 1.10) strengths.push("premium traffic control");
    else if (p.WHIP < 1.20) strengths.push("manageable baserunner profile");
    else if (p.WHIP > 1.30) concerns.push("inconsistent command leading to traffic");

    // K/BB
    if (p.KBB > 4) strengths.push("efficient strike‑throwing");
    else if (p.KBB > 3) strengths.push("workable command");
    else if (p.KBB < 2) concerns.push("erratic strike‑throwing");

    // BB%
    if (p.BBpct < 5) strengths.push("plus walk suppression");
    else if (p.BBpct < 7) strengths.push("solid underlying command");
    else if (p.BBpct > 9) concerns.push("elevated walk rate that may limit consistency");
    else if (p.BBpct > 11) concerns.push("high‑risk command profile with frequent free passes");

    // ⭐ FIP block removed (no longer part of the model)

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

    // W–L context stays
    if (p.W !== undefined && p.L !== undefined) {
        const wl = `${p.W}-${p.L}`;
        note += `\nW–L this season: ${wl}.`;
    }

    document.getElementById("scoutingNote").innerHTML = note;
}


// -------------------------------
// Weighted Overall Score (5‑metric model)
// -------------------------------
function computeWeightedOverall({
    eraScore,
    whipScore,
    kpctScore,
    bbpctScore,
    kbbScore
}) {
    return (
        eraScore  * 0.25 +
        whipScore * 0.25 +
        kpctScore * 0.1875 +
        bbpctScore* 0.125 +
        kbbScore  * 0.1875
    );
}

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

// ------------------------------
// Scoring functions (5‑metric model)
// ------------------------------
function scoreERA(era) {
    const score = 10 * (5.00 - era) / (5.00 - 2.00);
    return clamp(score, 0, 10);
}

function scoreWHIP(whip) {
    const score = 10 * (1.40 - whip) / (1.40 - 0.90);
    return clamp(score, 0, 10);
}

function scoreKpct(kpct) {
    const score = 10 * (kpct - 15) / (35 - 15);
    return clamp(score, 0, 10);
}

function scoreBBpct(bbpct) {
    const score = 10 * (10 - bbpct) / (10 - 3);
    return clamp(score, 0, 10);
}

function scoreKBB(kbb) {
    const score = 10 * (kbb - 1.5) / (6.0 - 1.5);
    return clamp(score, 0, 10);
}

// ⭐ Removed (no longer part of the model):
// function scoreIP(ip) { ... }
// function scoreHR9(hr9) { ... }
// function scoreFIP(fip) { ... }



// -------------------------------
// Main: Load player + update UI (backend-only)
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

        const data = await loadPitcher(name, season);

        // ⭐ Correct error handling
        if (!data || data.error || (Array.isArray(data) && data.length === 0)) {
            alert("Pitcher not found.");
            return;
        }

        // ⭐ Always normalize to object
        const p = Array.isArray(data) ? data[0] : data;

        // ⭐ Only 5 metrics now
        const eraScore   = scoreERA(p.ERA);
        const whipScore  = scoreWHIP(p.WHIP);
        const kpctScore  = scoreKpct(p.Kpct);
        const bbpctScore = scoreBBpct(p.BBpct);
        const kbbScore   = scoreKBB(p.KBB);

        updateERA(safeFixed(p.ERA, 2), eraScore);
        updateWHIP(safeFixed(p.WHIP, 2), whipScore);
        updateKpct(safeFixed(p.Kpct, 1), kpctScore);
        updateBBpct(safeFixed(p.BBpct, 1), bbpctScore);
        updateKBB(safeFixed(p.KBB, 2), kbbScore);

        const overall = computeWeightedOverall({
            eraScore,
            whipScore,
            kpctScore,
            bbpctScore,
            kbbScore
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

// -------------------------------
// Trend Handler (Season Comparison)
// -------------------------------
async function handleTrend() {
    showSpinner("spinner1");

    try {
        const rawName = document.getElementById("playerName").value.trim();
        if (!rawName) {
            alert("Enter a player name first.");
            return;
        }

        const season = Number(document.getElementById("seasonSelect").value);
        const lastSeason = season - 1;

        // Fetch both seasons using stathead.r API
        const currArr = await fetch(`https://pitcher-analyzer-backend.onrender.com/api/pitchers?name=${encodeURIComponent(rawName)}&season=${season}`)
            .then(r => r.json());

        const prevArr = await fetch(`https://pitcher-analyzer-backend.onrender.com/api/pitchers?name=${encodeURIComponent(rawName)}&season=${lastSeason}`)
            .then(r => r.json());

        const curr = Array.isArray(currArr) ? currArr[0] : currArr;
        const prev = Array.isArray(prevArr) ? prevArr[0] : prevArr;

        if (!curr || curr.error || !prev || prev.error) {
            alert("Not enough data for season comparison.");
            return;
        }

        if (curr.ERA == null || prev.ERA == null) {
            alert("Not enough data for season comparison.");
            return;
        }

        const html = buildSeasonComparison(curr, prev, season, lastSeason);

        document.getElementById("trendTitle").textContent =
            `Season Comparison (${season} vs ${lastSeason})`;

        document.getElementById("trendBody").innerHTML = html;
        document.getElementById("trendModal").style.display = "flex";

    } finally {
        hideSpinner("spinner1");
    }
}



// -------------------------------
// Trend Table (Season Comparison)
// -------------------------------
function buildSeasonComparison(curr, prev, season, lastSeason) {

    const stats = [
        { key: "ERA",   label: "ERA",   higherIsBetter: false },
        { key: "WHIP",  label: "WHIP",  higherIsBetter: false },
        { key: "Kpct",  label: "K%",    higherIsBetter: true  },
        { key: "BBpct", label: "BB%",   higherIsBetter: false },
        { key: "KBB",   label: "K/BB",  higherIsBetter: true  }
    ];

    let rows = stats.map(s => {
        const a = Number(curr[s.key]);
        const b = Number(prev[s.key]);

        // Determine arrow
        const arrow =
            a === b ? "➖" :
            s.higherIsBetter
                ? (a > b ? "▲" : "▼")
                : (a < b ? "▲" : "▼");

        // Determine CSS class
        const arrowClass =
            arrow === "▲" ? "trend-up" :
            arrow === "▼" ? "trend-down" :
            "trend-flat";

        return `
    <tr>
        <td>${s.label}</td>
        <td>${isNaN(a) ? "--" : a.toFixed(2)}</td>
        <td>${isNaN(b) ? "--" : b.toFixed(2)}</td>
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
// Compare Button
// -------------------------------

async function showCompareModal() {
    showSpinner("spinner1");
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
            alert("Enter both pitcher names.");
            return;
        }

        const data1Arr = await loadPitcher(p1_raw, s1);
        const data2Arr = await loadPitcher(p2_raw, s2);

        const data1 = Array.isArray(data1Arr) ? data1Arr[0] : data1Arr;
        const data2 = Array.isArray(data2Arr) ? data2Arr[0] : data2Arr;

        if (!data1 || data1.error || !data2 || data2.error) {
            alert("One or both pitchers not found.");
            return;
        }

        if (data1.ERA == null || data2.ERA == null) {
            alert("Not enough data for comparison.");
            return;
        }

        const p1_display = formatName(data1.Name || p1_raw);
        const p2_display = formatName(data2.Name || p2_raw);

        document.getElementById("compareName1").textContent = `${p1_display} (${s1})`;
        document.getElementById("compareName2").textContent = `${p2_display} (${s2})`;

        const s1_ERA   = scoreERA(data1.ERA);
        const s1_WHIP  = scoreWHIP(data1.WHIP);
        const s1_Kpct  = scoreKpct(data1.Kpct);
        const s1_BBpct = scoreBBpct(data1.BBpct);
        const s1_KBB   = scoreKBB(data1.KBB);

        const s2_ERA   = scoreERA(data2.ERA);
        const s2_WHIP  = scoreWHIP(data2.WHIP);
        const s2_Kpct  = scoreKpct(data2.Kpct);
        const s2_BBpct = scoreBBpct(data2.BBpct);
        const s2_KBB   = scoreKBB(data2.KBB);

        const overall1 = computeWeightedOverall({
            eraScore: s1_ERA,
            whipScore: s1_WHIP,
            kpctScore: s1_Kpct,
            bbpctScore: s1_BBpct,
            kbbScore: s1_KBB
        });

        const overall2 = computeWeightedOverall({
            eraScore: s2_ERA,
            whipScore: s2_WHIP,
            kpctScore: s2_Kpct,
            bbpctScore: s2_BBpct,
            kbbScore: s2_KBB
        });

        // ⭐ RAW + FORMATTED VALUES
        const stats = [
    ["ERA",  Number(data1.ERA),  Number(data2.ERA),  Number(data1.ERA).toFixed(2),  Number(data2.ERA).toFixed(2)],
    ["WHIP", Number(data1.WHIP), Number(data2.WHIP), Number(data1.WHIP).toFixed(2), Number(data2.WHIP).toFixed(2)],
    ["K%",   Number(data1.Kpct), Number(data2.Kpct), Number(data1.Kpct).toFixed(2), Number(data2.Kpct).toFixed(2)],
    ["BB%",  Number(data1.BBpct),Number(data2.BBpct),Number(data1.BBpct).toFixed(2),Number(data2.BBpct).toFixed(2)],
    ["K/BB", Number(data1.KBB),  Number(data2.KBB),  Number(data1.KBB).toFixed(2),  Number(data2.KBB).toFixed(2)],
    ["Overall Score", Number(overall1), Number(overall2), Number(overall1).toFixed(2), Number(overall2).toFixed(2)]
];


        const tbody = document.getElementById("compareBody");
        tbody.innerHTML = "";

        stats.forEach(([label, raw1, raw2, disp1, disp2]) => {
            const row = document.createElement("tr");

            let class1 = "tie";
            let class2 = "tie";

            if (raw1 != null && raw2 != null) {
                if (label === "ERA" || label === "WHIP" || label === "BB%") {
                    if (raw1 < raw2) { class1 = "win"; class2 = "lose"; }
                    else if (raw2 < raw1) { class1 = "lose"; class2 = "win"; }
                } else {
                    if (raw1 > raw2) { class1 = "win"; class2 = "lose"; }
                    else if (raw2 > raw1) { class1 = "lose"; class2 = "win"; }
                }
            }

            // ⭐ DISPLAY FORMATTED VALUES ONLY
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
        hideSpinner("spinner1");
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

    // FIXED: Trigger the correct load button
    document.getElementById("loadBtn").click();
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
    document.querySelectorAll(".metric-raw").forEach(el => el.textContent = "--");
    document.querySelectorAll(".metric-score").forEach(el => el.textContent = "--");

    document.querySelectorAll(".battery").forEach(el => {
        el.style.setProperty("--fillWidth", "0%");
        el.style.setProperty("--fillColor", "#d50000");
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
    const url = `https://pitcher-analyzer-backend.onrender.com/api/last-updated/pitchers/${season}`;

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
    document.getElementById("loadBtn").addEventListener("click", handleLoad);
    document.getElementById("resetBtn").addEventListener("click", handleReset);
    document.getElementById("compareBtn").addEventListener("click", showCompareModal);

loadLastUpdated(currentSeason)


    // Single Trend button
    document.getElementById("trendBtn").addEventListener("click", handleTrend);



    // Close modals
    document.getElementById("trendClose").onclick = () =>
        document.getElementById("trendModal").style.display = "none";

    document.getElementById("compareClose").onclick = () =>
        document.getElementById("compareModal").style.display = "none";

});


