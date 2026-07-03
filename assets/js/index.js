// Mobile nav toggle
(function(){
    const navToggle = document.querySelector('.nav-toggle');
    const nav = document.querySelector('.nav');
    const navBar = document.querySelector('.nav-bar');

    if (!navToggle || !navBar || !nav) return;

    navToggle.addEventListener('click', function(){
        const expanded = this.getAttribute('aria-expanded') === 'true';
        this.setAttribute('aria-expanded', String(!expanded));
        navBar.classList.toggle('open');
        nav.classList.toggle('open');
    });

    // close mobile menu if resizing above breakpoint
    window.addEventListener('resize', function(){
        if (window.innerWidth > 700) {
            navBar.classList.remove('open');
            nav.classList.remove('open');
            navToggle.setAttribute('aria-expanded', 'false');
        }
    });
})();
