// Runs in <head> before styles load to apply the saved/system theme immediately,
// preventing a light-to-dark flash and ensuring consistent initial rendering.
(() => {
    try {
        const savedTheme = localStorage.getItem('gpmo-theme');
        const theme =
            savedTheme === 'light' || savedTheme === 'dark'
                ? savedTheme
                : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

        document.documentElement.setAttribute('data-theme', theme);
        document.documentElement.style.colorScheme = theme;
    } catch (_) {
        // localStorage can throw in some privacy modes; keep default theme fallback.
    }
})();
