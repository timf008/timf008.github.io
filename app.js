// --------------------------------------
// timf008.github.io Log In Screen
// --------------------------------------

let currentUser = null;


const API = "https://collect-backend-tg58.onrender.com";


// --------------------------------------
// Log Out (GLOBAL)
// --------------------------------------
window.logout = function () {
    // Remove stored login
    localStorage.removeItem("userCode");

    // Show logout alert
    alert("Logged out");

    // Reload UI so login screen appears again
    location.reload();
};


// --------------------------------------
// Create New Account
// --------------------------------------
async function createAccount() {
    const res = await fetch(`${API}/createUser`, { method: "POST" });
    const data = await res.json();

    const userId = data.userId;

    // Populate the 6-digit code box
    document.getElementById("loginCode").value = userId;

    const password = prompt("Set a password for your new account:");

    await fetch(`${API}/setPassword`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password })
    });

    localStorage.setItem("userCode", userId);
    alert("Your account code is: " + userId);

    loadUser(await loadUserFromServer(userId));
}

// --------------------------------------
// Auto Log-In
// --------------------------------------
window.onload = async () => {
    const code = localStorage.getItem("userCode");
    if (code) {
        const user = await loadUserFromServer(code);
        loadUser(user);
    }
};

// --------------------------------------
// Helper - Load User From Server
// --------------------------------------
async function loadUserFromServer(userId) {
    const res = await fetch(`${API}/loadUser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
    });

    return await res.json();
}

// --------------------------------------
// Log-In Validation
// --------------------------------------
function showError(element, message) {
    element.textContent = message;
    element.style.display = "block";
}

function clearErrors() {
    document.querySelectorAll(".error").forEach(e => {
        e.style.display = "none";
        e.textContent = "";
    });

    document.querySelectorAll("input").forEach(i => {
        i.classList.remove("invalid");
    });
}

async function login() {
    clearErrors();

    const codeInput = document.getElementById("loginCode");
    const passInput = document.getElementById("loginPassword");

    const codeError = document.getElementById("codeError");
    const passError = document.getElementById("passwordError");

    const userId = codeInput.value.trim();
    const password = passInput.value.trim();

    let valid = true;

    // Validate code
    if (!/^\d{6}$/.test(userId)) {
        codeInput.classList.add("invalid");
        showError(codeError, "Code must be exactly 6 digits.");
        valid = false;
    }

    // Validate password
    if (password.length < 6) {
        passInput.classList.add("invalid");
        showError(passError, "Password must be at least 6 characters.");
        valid = false;
    }

    if (!valid) return;

    // Send login request
    const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password })
    });

    const data = await res.json();

    if (data.error) {
    passInput.classList.add("invalid");
    showError(passError, data.error);
    return;
}

localStorage.setItem("userCode", userId);

// ⭐ Award daily login tokens (5 tokens)
const tokenRes = await fetch(`${API}/awardTokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, amount: 5 })
});

const tokenData = await tokenRes.json();

// ⭐ Only show award message if tokens were actually given
if (tokenData.ok) {
    alert("Daily Tokens Awarded!");
} else {
    console.log("No tokens awarded:", tokenData.reason);
}

// Reload user from server so UI gets updated token count
const updatedUser = await loadUserFromServer(userId);
loadUser(updatedUser);

alert("Log In Successful");

}

// --------------------------------------
// Pitcher Analyzer Token Reward Upon Click
// --------------------------------------
const pitcherLink = document.querySelector('a[href="/pitcher-analyzer"]');
if (pitcherLink) {
    pitcherLink.addEventListener("click", async () => {
        const userId = localStorage.getItem("userCode");

        const res = await fetch(`${API}/awardPitcherTokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });

        const data = await res.json();
        if (data.ok) alert("Pitcher Analyzer Tokens Awarded!");
    });
}


// --------------------------------------
// Batter Analyzer Token Reward Upon Click
// --------------------------------------
const batterLink = document.querySelector('a[href="/batter-analyzer"]');
if (batterLink) {
    batterLink.addEventListener("click", async () => {
        const userId = localStorage.getItem("userCode");

        const res = await fetch(`${API}/awardBatterTokens`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId })
        });

        const data = await res.json();
        if (data.ok) alert("Batter Analyzer Tokens Awarded!");
    });
}

async function awardPitcherTokens() {
    const userId = localStorage.getItem("userCode");

    const res = await fetch(`${API}/awardPitcherTokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
    });

    const data = await res.json();
    if (data.ok) alert("Pitcher Analyzer Tokens Awarded!");
}

async function awardBatterTokens() {
    const userId = localStorage.getItem("userCode");

    const res = await fetch(`${API}/awardBatterTokens`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
    });

    const data = await res.json();
    if (data.ok) alert("Batter Analyzer Tokens Awarded!");
}



// --------------------------------------
// PATCH: Add missing loadUser()
// --------------------------------------
function loadUser(user) {
    console.log("User loaded:", user);
    currentUser = user;

    const pitcherLink = document.querySelector('a[href="/pitcher-analyzer"]');
    if (pitcherLink) pitcherLink.addEventListener("click", awardPitcherTokens);

    const batterLink = document.querySelector('a[href="/batter-analyzer"]');
    if (batterLink) batterLink.addEventListener("click", awardBatterTokens);
}

