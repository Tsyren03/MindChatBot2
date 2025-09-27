// auth.js — password reveal + lightweight validation (no password length cap)
(() => {
  const LANG = (document.documentElement.lang || 'en').split('-')[0];
  const LABELS = {
    en: ['Show password', 'Hide password'],
    ko: ['비밀번호 표시', '비밀번호 숨기기'],
    ru: ['Показать пароль', 'Скрыть пароль']
  };

  // Pencil-style SVG icons
  const ICONS = {
    show: (
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"></path>' +
        '<circle cx="12" cy="12" r="3.5"></circle>' +
      '</svg>'
    ),
    hide: (
      '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
        '<path d="M3 3l18 18"></path>' +
        '<path d="M2.5 12.5S6.5 6 12 6c1.6 0 3 .4 4.2 1"></path>' +
        '<path d="M21.5 12.5S17.5 19 12 19c-1.6 0-3-.4-4.2-1"></path>' +
        '<circle cx="12" cy="12" r="3.5"></circle>' +
      '</svg>'
    )
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Remove password length/pattern limitations (keep 'required' intact)
    document.querySelectorAll('input[type="password"]').forEach(inp => {
      ['minlength','maxlength','pattern'].forEach(a => inp.removeAttribute(a));
    });

    // Password toggle(s) with SVG icons
    document.querySelectorAll('[data-toggle="password"]').forEach(btn => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      if (!input) return;

      const setUI = (showing) => {
        // showing === true => password visible
        btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
        btn.setAttribute('aria-label', (LABELS[LANG] || LABELS.en)[showing ? 1 : 0]);
        btn.innerHTML = showing ? ICONS.hide : ICONS.show;
      };
      setUI(false);

      // Keep caret/focus steady when clicking the eye
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', e => {
        e.preventDefault();
        const showing = input.type === 'password'; // we are about to show if currently hidden
        input.type = showing ? 'text' : 'password';

        // Preserve caret position
        const s = input.selectionStart, epos = input.selectionEnd;
        input.focus({ preventScroll: true });
        try { input.setSelectionRange(s, epos); } catch {}

        setUI(showing);
      });
    });

    // Minimal validation helper (Bootstrap-style), but no length checks remain
    document.addEventListener('submit', (ev) => {
      const form = ev.target.closest('form.needs-validation');
      if (!form) return;

      // If you want to disable all HTML5 validation entirely, uncomment:
      // form.noValidate = true; return;

      if (!form.checkValidity()) {
        ev.preventDefault();
        ev.stopPropagation();
      }
      form.classList.add('was-validated');
    }, true);
  });
})();
