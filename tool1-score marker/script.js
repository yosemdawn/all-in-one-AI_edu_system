
document.addEventListener('DOMContentLoaded', () => {
    const appContent = document.getElementById('app-content');
    const navButtons = {
        'nav-answers': 'answers.html',
        'nav-upload': 'upload.html',
        'nav-results': 'results.html',
        'nav-settings': 'settings.html'
    };

    function loadContent(page) {
        fetch(page)
            .then(response => response.text())
            .then(html => {
                appContent.innerHTML = html;
                // Re-execute scripts in the loaded HTML
                const scripts = appContent.querySelectorAll('script');
                scripts.forEach(script => {
                    const newScript = document.createElement('script');
                    Array.from(script.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
                    newScript.textContent = script.textContent;
                    script.parentNode.replaceChild(newScript, script);
                });
            })
            .catch(error => console.error('Error loading page:', error));
    }

    // Initial load
    loadContent(navButtons['nav-upload']); // Default to upload page

    // Navigation event listeners
    for (const buttonId in navButtons) {
        document.getElementById(buttonId).addEventListener('click', () => {
            loadContent(navButtons[buttonId]);
        });
    }
});


