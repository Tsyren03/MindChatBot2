// Password reveal only (no validation logic that could block submit)
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-toggle="password"]').forEach(btn => {
    // keep caret/focus steady while clicking the eye
    btn.addEventListener('mousedown', e => e.preventDefault());

    btn.addEventListener('click', e => {
      e.preventDefault();
      const input = document.getElementById(btn.getAttribute('data-target'));
      if (!input) return;

      const show = input.type === 'password';
      // use property setter (most reliable)
      input.type = show ? 'text' : 'password';

      // Safari/iOS refresh nudge (no-op elsewhere)
      const v = input.value;
      input.value = '';
      input.value = v;

      input.focus({ preventScroll: true });

      // update icon/state
      btn.setAttribute('aria-pressed', show ? 'true' : 'false');
      btn.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 표시');
      btn.textContent = show ? '🙈' : '👁️';
    });
  });
});
