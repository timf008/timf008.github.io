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

// -------------------------------
// Utility: Fetch pitcher data
// -------------------------------
async function loadPitcher(name, season) {
    const url = `https://pitcher-analyzer-backend.onrender.com/api/pitchers?name=${encodeURIComponent(name)}&season=${season}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Pitcher fetch failed", await res.text());
        alert("Pitcher not found.");
        return null;
    }

    return await res.json(); // API returns an array
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
// Scouting note generator
// -------------------------------
function updateScoutingNote(p) {
    const strengths = [];
    const concerns = [];

    if (p.Kpct > 28) strengths.push("impact swing‑and‑miss");
    else if (p.Kpct > 24) strengths.push("above‑average bat‑missing ability");
    else if (p.Kpct < 20) concerns.push("below‑average bat‑missing ability");

    if (p.WHIP < 1.10) strengths.push("premium traffic control");
    else if (p.WHIP < 1.20) strengths.push("manageable baserunner profile");
    else if (p.WHIP > 1.30) concerns.push("inconsistent command leading to traffic");

    if (p.KBB > 4) strengths.push("efficient strike‑throwing");
    else if (p.KBB > 3) strengths.push("workable command");
    else if (p.KBB < 2) concerns.push("erratic strike‑throwing");

    if (p.BBpct < 5) strengths.push("plus walk suppression");
    else if (p.BBpct < 7) strengths.push("solid underlying command");
    else if (p.BBpct > 9) concerns.push("elevated walk rate that may limit consistency");
    else if (p.BBpct > 11) concerns.push("high‑risk command profile with frequent free passes");

    if (p.FIP < 3.5) strengths.push("supportive underlying metrics");
    else if (p.FIP < 4.0) strengths.push("stable underlying indicators");
    else if (p.FIP > 4.5) concerns.push("underlying indicators raise questions");

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

    if (p.W !== undefined && p.L !== undefined) {
        const wl = `${p.W}-${p.L}`;
        note += `\nW–L this season: ${wl}.`;
    }

    document.getElementById("scoutingNote").innerHTML = note;
}

// -------------------------------
// Weighted Overall Score
// -------------------------------
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

function clamp(x, min, max) {
    return Math.max(min, Math.min(max, x));
}

// ------------------------------
// Scoring functions
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

function scoreIP(ip) {
    const score = 10 * (ip - 80) / (200 - 80);
    return clamp(score, 0, 10);
}

function scoreHR9(hr9) {
    const score = 10 * (1.8 - hr9) / (1.8 - 0.5);
    return clamp(score, 0, 10);
}

function scoreFIP(fip) {
    const score = 10 * (5.00 - fip) / (5.00 - 2.50);
    return clamp(score, 0, 10);
}

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
        if (!data || !data.length) {
            alert("Pitcher not found.");
            return;
        }

        const p = data[0];

        const eraScore  = scoreERA(p.ERA);
        const whipScore = scoreWHIP(p.WHIP);
        const kpctScore = scoreKpct(p.Kpct);
        const bbpctScore= scoreBBpct(p.BBpct);
        const kbbScore  = scoreKBB(p.KBB);
        const ipScore   = scoreIP(p.IP);
        const hr9Score  = scoreHR9(p.HR9);
        const fipScore  = scoreFIP(p.FIP);

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

    while (values.length > 0 && (values[0] === null || values[0] === undefined)) {
        values.shift();
        seasons.shift();
    }

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

    document.getElementById("trendTitle").textContent =
        `${statNames[stat] || stat} Trend`;

    renderTrendChart(seasons, values, stat);

    document.getElementById("trendModal").style.display = "flex";
}

// -------------------------------
// Show Trend Fetch (backend-only)
// -------------------------------
async function fetchTrendData(name, stat) {
    const url = `https://pitcher-analyzer-backend.onrender.com/api/pitcherTrend?name=${encodeURIComponent(name)}&stat=${stat}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Trend fetch failed", await res.text());
        return null;
    }

    return await res.json();
}

// -------------------------------
// Render Chart.js Line Graph
// -------------------------------
let trendChart = null;

function renderTrendChart(seasons, values, stat) {
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
// Compare Modal Function (backend-only)
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

        const data1Arr = await loadPitcher(p1, s1);
        const data2Arr = await loadPitcher(p2, s2);

        const data1 = data1Arr && data1Arr[0];
        const data2 = data2Arr && data2Arr[0];

        if (!data1 || !data2) {
            alert("One or both pitchers not found.");
            return;
        }

        document.getElementById("compareName1").textContent = `${p1} (${s1})`;
        document.getElementById("compareName2").textContent = `${p2} (${s2})`;

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

        const overall1 = computeWeightedOverall({
            eraScore: s1_ERA,
            whipScore: s1_WHIP,
            kpctScore: s1_Kpct,
            bbpctScore: s1_BBpct,
            kbbScore: s1_KBB,
            ipScore: s1_IP,
            hr9Score: s1_HR9,
            fipScore: s1_FIP
        });

        const overall2 = computeWeightedOverall({
            eraScore: s2_ERA,
            whipScore: s2_WHIP,
            kpctScore: s2_Kpct,
            bbpctScore: s2_BBpct,
            kbbScore: s2_KBB,
            ipScore: s2_IP,
            hr9Score: s2_HR9,
            fipScore: s2_FIP
        });

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
// Rank Button backend fetches
// -------------------------------
async function fetchPitcherList(season) {
    const url = `https://pitcher-analyzer-backend.onrender.com/api/pitcherList?season=${season}`;
    const res = await fetch(url);

    if (!res.ok) {
        console.error("Pitcher list fetch failed", await res.text());
        return [];
    }
    return await res.json(); // [{ name, id }]
}

document.getElementById("rankBtn").addEventListener("click", async () => {
    const season = document.getElementById("seasonSelect2").value;

    document.getElementById("rankTitle").textContent =
        `Top Pitcher Rankings — ${season}`;

    const list = await fetchPitcherList(season);
    if (!list || list.length === 0) {
        alert("No pitchers found for this season.");
        return;
    }

    const stats = [];

    for (const { name } of list) {
        const dataArr = await loadPitcher(name, season);
        const p = dataArr && dataArr[0];
        if (!p) continue;

        if (typeof p.GS !== "number" || p.GS < 10) continue;

        stats.push({ name, p });
    }

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

    document.getElementById("rankTitle").textContent =
        `Top Pitcher Rankings — ${season}`;

    document.getElementById("rankModal").style.display = "flex";
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
// Latest Update Timestamp
// -------------------------------
async function loadLastUpdated(season) {
    const url = `https://pitcher-analyzer-backend.onrender.com/api/last-updated/pitchers/${season}`;
    const res = await fetch(url);
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
// Wire up UI buttons
// -------------------------------
document.getElementById("loadBtn").addEventListener("click", handleLoad);
document.getElementById("resetBtn").addEventListener("click", handleReset);
document.getElementById("compareBtn").addEventListener("click", showCompareModal);
document.getElementById("rankBtn").addEventListener("click", () => {
    document.getElementById("rankModal").style.display = "flex";
});

// Trend buttons
document.querySelectorAll(".trend-btn").forEach(btn => {
    btn.addEventListener("click", () => showTrend(btn.dataset.stat));
});

// Close modals
document.getElementById("trendClose").onclick = () =>
    document.getElementById("trendModal").style.display = "none";

document.getElementById("compareClose").onclick = () =>
    document.getElementById("compareModal").style.display = "none";

document.getElementById("rankClose").onclick = () =>
    document.getElementById("rankModal").style.display = "none";

