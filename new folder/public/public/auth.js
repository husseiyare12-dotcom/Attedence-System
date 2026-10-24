const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const authMessage = document.getElementById("authMessage");
const resetRequestForm = document.getElementById("resetRequestForm");
const resetConfirmForm = document.getElementById("resetConfirmForm");
const isAdminLogin = window.location.pathname === "/admin-login.html";
if (isAdminLogin) {
    document.getElementById("loginEyebrow").textContent = "Admin Portal";
    document.getElementById("loginTitle").textContent = "Welcome, Admin";
    document.getElementById("loginDescription").textContent = "Sign in to manage the school attendance system.";
    document.getElementById("loginButton").textContent = "Enter admin dashboard";
    document.getElementById("email").placeholder = "Admin email address";
}

async function sendAuth(url, body) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || "Request failed.");
    return result;
}

loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const result = await sendAuth(isAdminLogin ? "/api/auth/admin-login" : "/api/auth/login", { identifier: document.getElementById("email").value, email: document.getElementById("email").value, password: document.getElementById("password").value });
        window.location.href = isAdminLogin ? "/admin-dashboard.html" : result.role === "student" ? "/student.html" : result.role === "teacher" ? "/exams.html" : "/";
    }
    catch (error) { authMessage.textContent = error.message; }
});

registerForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await sendAuth("/api/auth/register", { name: document.getElementById("name").value, email: document.getElementById("email").value, role: document.getElementById("role").value, studentId: document.getElementById("studentId").value, password: document.getElementById("password").value }); authMessage.textContent = "Account created. You can now sign in."; event.target.reset(); }
    catch (error) { authMessage.textContent = error.message; }
});

resetRequestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { const result = await sendAuth("/api/auth/password-reset/request", { email: document.getElementById("resetEmail").value }); authMessage.textContent = result.message; if (result.resetToken) authMessage.textContent += ` Token: ${result.resetToken}`; }
    catch (error) { authMessage.textContent = error.message; }
});

resetConfirmForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try { const result = await sendAuth("/api/auth/password-reset/confirm", { token: document.getElementById("resetToken").value, password: document.getElementById("resetPassword").value }); authMessage.textContent = result.message; event.target.reset(); }
    catch (error) { authMessage.textContent = error.message; }
});
