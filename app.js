// --------------------------------------
// timf008.github.io Log In Screen
// --------------------------------------



// --------------------------------------
// Log-In
// --------------------------------------
async function login() {
    const userId = document.getElementById("loginCode").value;
    const password = document.getElementById("loginPassword").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, password })
    });

    const data = await res.json();

    if (data.error) {
        alert(data.error);
        return;
    }

    localStorage.setItem("userCode", userId);
    loadUser(data);
}


// --------------------------------------
// Create New Account
// --------------------------------------
async function createAccount() {
    const res = await fetch("/createUser", { method: "POST" });
    const data = await res.json();

    const userId = data.userId;
    const password = prompt("Set a password for your new account:");

    await fetch("/setPassword", {
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
    const res = await fetch("/loadUser", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId })
    });

    return await res.json();
}


