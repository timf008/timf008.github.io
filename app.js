// --------------------------------------
// timbaseball.com
// --------------------------------------


// --------------------------------------
// Open Login/Create Account Modal
// --------------------------------------

const modal = document.getElementById("authModal");

document.getElementById("openAuth").onclick = () => {
    modal.classList.add("open");
};

document.getElementById("closeAuth").onclick = () => {
    modal.classList.remove("open");
};

modal.addEventListener("click", (event) => {
    if (event.target === modal) {
        modal.classList.remove("open");
    }
});

// --------------------------------------
// Switch Between Login and Signup in Modal
// --------------------------------------

const loginForm = document.getElementById("loginForm");
const signupForm = document.getElementById("signupForm");

const loginTab = document.getElementById("loginTab");
const signupTab = document.getElementById("signupTab");

const accountView =
    document.getElementById("accountView");

const accountEmail =
    document.getElementById("accountEmail");

const accountPlan =
    document.getElementById("accountPlan");

const logoutButton =
    document.getElementById("logoutButton");

const authTabs =
    document.querySelector(".auth-tabs");

loginTab.onclick = () => {

    // Do nothing if user is already logged in
    if (!accountView.hidden) {
        return;
    }

    loginForm.hidden = false;
    signupForm.hidden = true;

    loginTab.classList.add("active");
    signupTab.classList.remove("active");
};


signupTab.onclick = () => {

    // Do nothing if user is already logged in
    if (!accountView.hidden) {
        return;
    }

    loginForm.hidden = true;
    signupForm.hidden = false;

    signupTab.classList.add("active");
    loginTab.classList.remove("active");
};

// ==================================
// TimBaseball Authentication
// ==================================

const AUTH_API = "https://auth.timbaseball.com";

// ------------------------------
// Create Account
// ------------------------------

signupForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("signupEmail").value.trim();

    const password =
        document.getElementById("signupPassword").value;

    const confirmPassword =
        document.getElementById("signupConfirm").value;

    authMessage.textContent = "";

    // Make sure passwords match
    if (password !== confirmPassword) {
        authMessage.textContent =
            "Passwords do not match.";
        return;
    }

    try {

        authMessage.textContent =
            "Creating account...";

        const response = await fetch(
            `${AUTH_API}/api/auth/register`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to create account."
            );
        }

        authMessage.textContent =
            "Account created!";

        console.log(
            "TimBaseball user:",
            data.user
        );

    } catch (error) {

        console.error(
            "Registration error:",
            error
        );

        authMessage.textContent =
            error.message;
    }

});

// ------------------------------
// Log In
// ------------------------------

loginForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    const email =
        document.getElementById("loginEmail").value.trim();

    const password =
        document.getElementById("loginPassword").value;

    authMessage.textContent = "";

    try {

        authMessage.textContent =
            "Logging in...";

        const response = await fetch(
            `${AUTH_API}/api/auth/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                credentials: "include",

                body: JSON.stringify({
                    email,
                    password
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to log in."
            );
        }

        authMessage.textContent =
            "Logged in!";

        console.log(
            "TimBaseball user:",
            data.user
        );

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        authMessage.textContent =
            error.message;
    }

});

// ------------------------------
// Check Current Login
// ------------------------------

async function checkCurrentUser() {

    try {

        const response = await fetch(
            `${AUTH_API}/api/auth/me`,
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (data.loggedIn) {

            console.log(
                "Logged in as:",
                data.user
            );

            // Navigation
            document.getElementById("openAuth").textContent =
                "My Account";

            // Hide login/create-account interface
            authTabs.hidden = true;
            loginForm.hidden = true;
            signupForm.hidden = true;

            // Populate account information
            accountEmail.textContent =
                data.user.email;

            accountPlan.textContent =
                data.user.subscriptionStatus === "free"
                    ? "Free"
                    : data.user.subscriptionStatus;

            // Show account interface
            accountView.hidden = false;

            authMessage.textContent = "";

        } else {

            console.log(
                "No active TimBaseball session."
            );

            // Navigation
            document.getElementById("openAuth").textContent =
                "Log In / Create Account";

            // Restore login interface
            authTabs.hidden = false;
            loginForm.hidden = false;
            signupForm.hidden = true;
            accountView.hidden = true;

            loginTab.classList.add("active");
            signupTab.classList.remove("active");

            authMessage.textContent = "";
        }

    } catch (error) {

        console.error(
            "Session check error:",
            error
        );
    }
}

checkCurrentUser();

// ------------------------------
// Log Out
// ------------------------------

logoutButton.addEventListener("click", async () => {

    try {

        authMessage.textContent =
            "Logging out...";

        const response = await fetch(
            `${AUTH_API}/api/auth/logout`,
            {
                method: "POST",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(
                data.error || "Unable to log out."
            );
        }

        // Re-check session and rebuild UI
        await checkCurrentUser();

        authMessage.textContent =
            "Logged out.";

    } catch (error) {

        console.error(
            "Logout error:",
            error
        );

        authMessage.textContent =
            error.message;
    }
});
