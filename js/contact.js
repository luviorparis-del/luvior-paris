/* Contact Form Validation */
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const success = document.getElementById('form-success');
    if (!form) return;

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        let valid = true;

        form.querySelectorAll('.contact-form__group').forEach(group => {
            group.classList.remove('error');
        });

        const required = form.querySelectorAll('[required]');
        required.forEach(input => {
            const group = input.closest('.contact-form__group');
            if (!input.value.trim()) {
                group.classList.add('error');
                valid = false;
            }
            if (input.type === 'email' && input.value.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input.value.trim())) {
                    group.classList.add('error');
                    valid = false;
                }
            }
        });

        if (valid) sendMessage();
    });

    // Sends to the contact-message Edge Function, which posts to Slack and keeps a copy.
    async function sendMessage() {
        const btn = form.querySelector('button[type="submit"]');
        const status = document.getElementById('form-status');
        const label = btn.innerHTML;
        const val = name => (form.elements[name]?.value || '').trim();
        btn.disabled = true;
        btn.textContent = 'Sending…';
        status.hidden = true;
        try {
            const res = await fetch(`${SUPABASE_URL}/functions/v1/contact-message`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
                body: JSON.stringify({
                    firstName: val('firstName'), lastName: val('lastName'), email: val('email'), phone: val('phone'),
                    reason: val('reason'), orderNumber: val('orderNumber'), message: val('message'), website: val('website')
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                (data.fields || []).forEach(n => form.elements[n]?.closest('.contact-form__group')?.classList.add('error'));
                throw new Error(data.error || 'We couldn\'t send your message right now.');
            }
            form.style.display = 'none';
            success.style.display = 'block';
            success.classList.add('visible');
            success.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (err) {
            console.error('Contact form send failed:', err);
            const msg = err instanceof TypeError ? 'We couldn\'t send your message right now. Please try again in a moment.' : (err.message || 'Something went wrong.');
            status.textContent = `${msg} You can also email us at luviorparis@gmail.com.`;
            status.hidden = false;
        } finally {
            btn.disabled = false;
            btn.innerHTML = label;
        }
    }

    form.querySelectorAll('.contact-form__input, .contact-form__select, .contact-form__textarea').forEach(input => {
        input.addEventListener('input', () => {
            input.closest('.contact-form__group')?.classList.remove('error');
        });
    });
});
