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

        if (valid) {
            form.style.display = 'none';
            success.style.display = 'block';
            success.classList.add('visible');
        }
    });

    form.querySelectorAll('.contact-form__input, .contact-form__select, .contact-form__textarea').forEach(input => {
        input.addEventListener('input', () => {
            input.closest('.contact-form__group')?.classList.remove('error');
        });
    });
});
