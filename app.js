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
