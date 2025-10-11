    (() => {
      const LANG = (document.documentElement.lang || 'en').split('-')[0];
    
      const LABELS = {
        en: ['Show password', 'Hide password'],
        ko: ['비밀번호 표시', '비밀번호 숨기기'],
        ru: ['Показать пароль', 'Скрыть пароль']
      };
    
      const MESSAGES = {
        en: {
          sendingEmail: 'Sending Email...',
          resendWorking: 'Sending...',
          sent: 'New verification code sent successfully!',
          wait: s => `Please wait ${s} seconds before requesting another code.`,
          netErr: 'A network error occurred. Please try again.',
          genericErr: 'Registration failed. Please check your input.',
          noEmail: 'Email not found. Please refresh and restart the process.',
          sendingResetEmail: 'Sending reset code...',
          emailNotFound: 'We could not find an account with that email address.'
        },
        ko: {
          sendingEmail: '이메일 전송 중...',
          resendWorking: '전송 중...',
          sent: '새 인증 코드를 전송했습니다!',
          wait: s => `${s}초 후에 다시 요청하세요.`,
          netErr: '네트워크 오류가 발생했습니다. 다시 시도해주세요.',
          genericErr: '회원가입에 실패했습니다. 입력을 확인해주세요.',
          noEmail: '이메일을 찾을 수 없습니다. 새로고침 후 다시 시작하세요.',
          sendingResetEmail: '재설정 코드 전송 중...',
          emailNotFound: '해당 이메일 주소를 사용하는 계정을 찾을 수 없습니다.'
        },
        ru: {
          sendingEmail: 'Отправка письма...',
          resendWorking: 'Отправка...',
          sent: 'Новый код подтверждения отправлен!',
          wait: s => `Подождите ${s} сек. перед повторной отправкой.`,
          netErr: 'Произошла сетевая ошибка. Повторите попытку.',
          genericErr: 'Регистрация не удалась. Проверьте введённые данные.',
          noEmail: 'Email не найден. Обновите страницу и начните заново.',
          sendingResetEmail: 'Отправка кода сброса...',
          emailNotFound: 'Мы не смогли найти учетную запись с таким адресом электронной почты.'
        }
      };
      const MSG = MESSAGES[LANG] || MESSAGES.en;
    
      const ICONS = {
        show:
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3.5"></circle></svg>',
        hide:
          '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18"></path><path d="M2.5 12.5S6.5 6 12 6c1.6 0 3 .4 4.2 1"></path><path d="M21.5 12.5S17.5 19 12 19c-1.6 0-3-.4-4.2-1"></path><circle cx="12" cy="12" r="3.5"></circle></svg>'
      };
    
      document.addEventListener('DOMContentLoaded', () => {
        // Accessible password toggle
        document.querySelectorAll('[data-toggle="password"]').forEach(btn => {
          const targetId = btn.getAttribute('data-target');
          const input = document.getElementById(targetId);
          if (!input) return;
    
          const labels = LABELS[LANG] || LABELS.en;
          const setUI = showing => {
            btn.setAttribute('aria-pressed', showing ? 'true' : 'false');
            btn.setAttribute('aria-label', labels[showing ? 1 : 0]);
            btn.innerHTML = showing ? ICONS.hide : ICONS.show;
          };
          setUI(input.type !== 'password');
    
          btn.addEventListener('mousedown', e => e.preventDefault());
          btn.addEventListener('click', e => {
            e.preventDefault();
            const isPassword = input.type === 'password';
            input.type = isPassword ? 'text' : 'password';
            setUI(isPassword);
          });
        });
    
        const form = document.getElementById('signup-form');
        if (form) {
          const emailInput = document.getElementById('signup-email');
          const emailExistsWarning = document.getElementById('email-exists-warning');
          const SIGNUP_URL = new URL('/signup', location.origin).toString();
    
          form.addEventListener('submit', async ev => {
            const path = new URL(form.action, location.origin).pathname;
            if (path !== '/signup') return;
            if (!form.checkValidity()) return;
            ev.preventDefault();
    
            emailExistsWarning?.classList.add('d-none');
            emailInput?.classList.remove('is-invalid');
    
            const submitButton = document.getElementById('step-1-submit');
            const csrfToken = form.querySelector('input[name="_csrf"]')?.value || '';
            const fd = new FormData(form);
            const data = Object.fromEntries(fd.entries());
            const email = (data.email || '').toString().trim();
    
            const originalText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = MSG.sendingEmail;
    
            try {
              const res = await fetch(SIGNUP_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken},
                body: JSON.stringify(data),
                credentials: 'same-origin'
              });
    
              if (res.ok) {
                const next = new URL('/signup', location.origin);
                next.searchParams.set('email', email);
                const qlang = new URLSearchParams(location.search).get('lang') || LANG;
                next.searchParams.set('lang', qlang);
                location.assign(next.toString());
                return;
              }
    
              if (res.status === 409) {
                emailExistsWarning?.classList.remove('d-none');
                emailInput?.classList.add('is-invalid');
              } else {
                alert(MSG.genericErr);
              }
            } catch (e) {
              console.error('Network error during signup:', e);
              alert(MSG.netErr);
            } finally {
              submitButton.textContent = originalText;
              submitButton.disabled = false;
            }
          });
        }
    
        // RESEND (only on Step-2 page)
        const resendBtn = document.getElementById('resend-code');
        if (resendBtn) {
          resendBtn.addEventListener('click', async e => {
            e.preventDefault();
            const verifiedEmailInput = document.getElementById('verified-email-input');
            const email = verifiedEmailInput?.value || '';
            if (!email) return alert(MSG.noEmail);
    
            const csrfToken = document.querySelector('input[name="_csrf"]')?.value || '';
            const RESEND_URL = new URL('/resend-code', location.origin).toString();
            const original = resendBtn.textContent;
            resendBtn.disabled = true;
            resendBtn.textContent = MSG.resendWorking;
    
            try {
              const r = await fetch(RESEND_URL, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken},
                body: JSON.stringify({ email }),
                credentials: 'same-origin'
              });
              if (r.ok) {
                alert(MSG.sent);
              } else if (r.status === 429) {
                const ra = parseInt(r.headers.get('Retry-After') || '60', 10);
                alert(MSG.wait(ra));
              } else {
                alert(MSG.genericErr);
              }
            } catch {
              alert(MSG.netErr);
            } finally {
              resendBtn.textContent = original;
              resendBtn.disabled = false;
            }
          });
        }
    
        // FORGOT PASSWORD - STEP 1 (AJAX)
        const forgotPasswordForm = document.getElementById('forgot-password-form');
        if (forgotPasswordForm) {
            const FORGOT_PASSWORD_URL = new URL('/forgot-password', location.origin).toString();
    
            forgotPasswordForm.addEventListener('submit', async (ev) => {
                if (!forgotPasswordForm.checkValidity()) return;
                ev.preventDefault();
                
                const emailInput = document.getElementById('forgot-email');
                const emailNotFoundWarning = document.getElementById('email-not-found-warning');
                emailNotFoundWarning?.classList.add('d-none');
                emailInput?.classList.remove('is-invalid');
    
                const submitButton = document.getElementById('forgot-submit');
                const csrfToken = forgotPasswordForm.querySelector('input[name="_csrf"]')?.value || '';
                const email = (new FormData(forgotPasswordForm).get('email') || '').toString().trim();
                
                const originalText = submitButton.textContent;
                submitButton.disabled = true;
                submitButton.textContent = MSG.sendingResetEmail || 'Sending...';
    
                try {
                    const res = await fetch(FORGOT_PASSWORD_URL, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json', 'X-CSRF-TOKEN': csrfToken},
                        body: JSON.stringify({ email: email }),
                        credentials: 'same-origin'
                    });
    
                    if (res.ok) {
                        const next = new URL('/reset-password', location.origin);
                        next.searchParams.set('email', email);
                        const qlang = new URLSearchParams(location.search).get('lang') || LANG;
                        next.searchParams.set('lang', qlang);
                        location.assign(next.toString());
                        return;
                    }
                    
                    if (res.status === 404) { // Email not found
                        emailNotFoundWarning.textContent = MSG.emailNotFound;
                        emailNotFoundWarning?.classList.remove('d-none');
                        emailInput?.classList.add('is-invalid');
                    } else {
                        alert(MSG.genericErr);
                    }
    
                } catch (e) {
                    console.error('Error during password reset request:', e);
                    alert(MSG.netErr);
                } finally {
                    submitButton.textContent = originalText;
                    submitButton.disabled = false;
                }
            });
        }
    
        // Bootstrap-like validation
        document.addEventListener('submit', ev => {
          const f = ev.target.closest('form.needs-validation');
          if (!f) return;
          if (!f.checkValidity()) {
            ev.preventDefault();
            ev.stopPropagation();
          }
          f.classList.add('was-validated');
        }, true);
      });
    })();
    
