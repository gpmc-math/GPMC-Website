(() => {
    const root = document.documentElement;
    const storageKey = 'gpmo-theme';

    function getInitialTheme() {
        const savedTheme = localStorage.getItem(storageKey);
        if (savedTheme === 'light' || savedTheme === 'dark') {
            return savedTheme;
        }

        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    function applyTheme(theme) {
        root.setAttribute('data-theme', theme);
    }

    function updateThemeButton(button, theme) {
        const isDark = theme === 'dark';
        button.setAttribute('aria-pressed', String(isDark));
        button.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');

        const label = button.querySelector('.theme-toggle-text');
        if (label) {
            label.textContent = isDark ? 'Light Mode' : 'Dark Mode';
        }
    }

    function setupThemeToggle() {
        const themeButtons = document.querySelectorAll('.theme-toggle');
        if (!themeButtons.length) {
            return;
        }

        let currentTheme = getInitialTheme();
        applyTheme(currentTheme);

        themeButtons.forEach((button) => {
            updateThemeButton(button, currentTheme);
            button.addEventListener('click', () => {
                currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(currentTheme);
                localStorage.setItem(storageKey, currentTheme);
                themeButtons.forEach((otherButton) => updateThemeButton(otherButton, currentTheme));
            });
        });
    }

    function setupMobileNav() {
        const navToggle = document.querySelector('.nav-toggle');
        const nav = document.querySelector('.nav');
        const navBar = document.querySelector('.nav-bar');

        if (!navToggle || !navBar || !nav) {
            return;
        }

        navToggle.addEventListener('click', () => {
            const expanded = navToggle.getAttribute('aria-expanded') === 'true';
            navToggle.setAttribute('aria-expanded', String(!expanded));
            navBar.classList.toggle('open');
            nav.classList.toggle('open');
        });

        navBar.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', () => {
                navBar.classList.remove('open');
                nav.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });

        window.addEventListener('resize', () => {
            if (window.innerWidth > 700) {
                navBar.classList.remove('open');
                nav.classList.remove('open');
                navToggle.setAttribute('aria-expanded', 'false');
            }
        });
    }

    setupThemeToggle();
    setupMobileNav();
})();
