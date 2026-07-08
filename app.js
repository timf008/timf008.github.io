// --------------------------------------
// timf008.github.io Log In Screen
// --------------------------------------

const API = "https://collect-backend-tg58.onrender.com";


// --------------------------------------
// Log Out (GLOBAL)
// --------------------------------------
window.logout = function () {
    // Remove stored login
    localStorage.removeItem("userCode");

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
    loadUser(data);

    // ✅ Success message
    alert("Log In Successful");
}

// --------------------------------------
// PATCH: Add missing loadUser()
// --------------------------------------
function loadUser(user) {
    console.log("User loaded:", user);

    // If you have UI elements, update them here.
    // Example:
    // document.getElementById("tokenCount").textContent = user.tokens;
    // document.getElementById("dailyEarned").textContent = user.dailyEarned;

    // For now, this prevents crashes and allows login to work.
}
