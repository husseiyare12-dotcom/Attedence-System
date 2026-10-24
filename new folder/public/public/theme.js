(function () {
    const storageKey = "attendance-theme";

    function applyTheme(theme) {
        const isDark = theme === "dark";
        document.body.classList.toggle("dark-mode", isDark);
        const toggle = document.getElementById("themeToggle");
        if (!toggle) return;
        const icon = toggle.querySelector("[data-theme-icon]");
        const label = toggle.querySelector("[data-theme-label]");
        toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
        toggle.title = isDark ? "Switch to light mode" : "Switch to dark mode";
        if (icon) icon.textContent = isDark ? "☀" : "☾";
        if (label) label.textContent = isDark ? "Light mode" : "Dark mode";
    }

    if (!document.getElementById("themeToggle")) {
        const toggle = document.createElement("button");
        toggle.id = "themeToggle";
        toggle.className = "theme-toggle theme-toggle-floating";
        toggle.type = "button";
        toggle.innerHTML = '<span data-theme-icon aria-hidden="true">☾</span><span data-theme-label>Dark mode</span>';
        const header = document.querySelector("header, .student-portal-header");
        if (header) header.appendChild(toggle);
        else document.body.appendChild(toggle);
    }

    applyTheme(localStorage.getItem(storageKey) === "dark" ? "dark" : "light");
    document.getElementById("themeToggle")?.addEventListener("click", function () {
        const nextTheme = document.body.classList.contains("dark-mode") ? "light" : "dark";
        localStorage.setItem(storageKey, nextTheme);
        applyTheme(nextTheme);
    });
})();
