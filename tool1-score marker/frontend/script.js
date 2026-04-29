
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
                
                // Load corresponding JavaScript file
                const scriptMap = {
                    'settings.html': 'settings.js',
                    'answers.html': 'answers.js',
                    'upload.html': 'upload.js',
                    'results.html': 'results.js'
                };
                
                const scriptFile = scriptMap[page];
                if (scriptFile) {
                    // Remove existing script if it exists
                    const existingScript = document.getElementById(scriptFile);
                    if (existingScript) {
                        existingScript.remove();
                    }
                    
                    // Load new script
                    const script = document.createElement('script');
                    script.id = scriptFile;
                    script.src = scriptFile;
                    document.body.appendChild(script);
                }
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


