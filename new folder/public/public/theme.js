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

    function addAnimatedTopbar() {
        const header = document.querySelector("main > header, .student-portal-header");
        if (!header || document.querySelector(".animated-topbar")) return;
        const banner = document.createElement("div");
        banner.className = "animated-topbar";
        banner.setAttribute("role", "status");
        banner.setAttribute("aria-live", "polite");
        banner.innerHTML = '<span class="motion-spark" aria-hidden="true">✦</span><span class="motion-copy"></span><span class="motion-count">01</span>';
        header.insertAdjacentElement("beforebegin", banner);

        const messages = [
            "Track attendance with clarity",
            "Build better student progress",
            "Your school dashboard is live",
            "Every record, organized beautifully"
        ];
        let index = 0;
        let timer;
        const copy = banner.querySelector(".motion-copy");
        const count = banner.querySelector(".motion-count");

        function showMessage(nextIndex) {
            index = (nextIndex + messages.length) % messages.length;
            copy.classList.remove("motion-change");
            void copy.offsetWidth;
            copy.textContent = messages[index];
            count.textContent = String(index + 1).padStart(2, "0");
            copy.classList.add("motion-change");
        }
        function start() { clearInterval(timer); timer = setInterval(() => showMessage(index + 1), 4200); }
        showMessage(0);
        start();
    banner.addEventListener("mouseenter", () => { clearInterval(timer); showMessage(index + 1); });
    banner.addEventListener("mouseleave", start);
    }

    addAnimatedTopbar();

    document.addEventListener("click", (event) => {
        const button = event.target.closest("button");
        if (!button) return;
        button.classList.remove("button-clicked");
        void button.offsetWidth;
        button.classList.add("button-clicked");
        window.setTimeout(() => button.classList.remove("button-clicked"), 420);
    });
})();
