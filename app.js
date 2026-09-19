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

loginTab.onclick = () => {
    loginForm.hidden = false;
    signupForm.hidden = true;

    loginTab.classList.add("active");
    signupTab.classList.remove("active");
};

signupTab.onclick = () => {
    loginForm.hidden = true;
    signupForm.hidden = false;

    signupTab.classList.add("active");
    loginTab.classList.remove("active");
};

// ==================================
// TimBaseball Authentication
// ==================================

const AUTH_API = "https://timbaseball-auth.onrender.com";

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
