/* =========================================
   RubyEngine — Page Transition
   Fade in/out + top progress bar
========================================= */
(function () {
  'use strict';

  var DUR_OUT = 260;

  function init() {
    // Top bar
    var bar = document.createElement('div');
    bar.id = 're-topbar';
    document.body.appendChild(bar);

    // Intercept link clicks
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;

      var href = link.getAttribute('href');
      if (!href) return;

      // Skip conditions
      if (href.startsWith('#')) return;
      if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('javascript:')) return;
      if (link.target === '_blank') return;
      if (link.hasAttribute('download')) return;
      if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return;

      // Skip external
      try {
        var url = new URL(href, location.href);
        if (url.origin !== location.origin) return;
      } catch (err) { return; }

      e.preventDefault();

      if (window.SFX && SFX.tap) SFX.tap();

      bar.classList.add('show');
      document.documentElement.classList.add('re-leaving');

      setTimeout(function () {
        location.href = href;
      }, DUR_OUT);
    }, true);

    // Back/forward cache
    window.addEventListener('pageshow', function (e) {
      if (e.persisted) {
        document.documentElement.classList.remove('re-leaving');
        bar.classList.remove('show');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();