
document.addEventListener("DOMContentLoaded", () => {
    const doubaoApiKeyInput = document.getElementById("doubaoApiKey");
    const doubaoSecretKeyInput = document.getElementById("doubaoSecretKey");
    const saveSettingsButton = document.getElementById("saveSettings");
    const settingsMessage = document.getElementById("settingsMessage");

    // Load existing settings
    const savedApiKey = localStorage.getItem("doubaoApiKey");
    const savedSecretKey = localStorage.getItem("doubaoSecretKey");

    if (savedApiKey) {
        doubaoApiKeyInput.value = savedApiKey;
    }
    if (savedSecretKey) {
        doubaoSecretKeyInput.value = savedSecretKey;
    }

    saveSettingsButton.addEventListener("click", () => {
        const apiKey = doubaoApiKeyInput.value.trim();
        const secretKey = doubaoSecretKeyInput.value.trim(); // Secret Key is now optional

        if (apiKey) {
            localStorage.setItem("doubaoApiKey", apiKey);
            if (secretKey) {
                localStorage.setItem("doubaoSecretKey", secretKey);
            } else {
                localStorage.removeItem("doubaoSecretKey"); // Remove if empty
            }
            settingsMessage.textContent = "配置已保存！";
            settingsMessage.className = "message success";
            settingsMessage.style.display = "block";
        } else {
            settingsMessage.textContent = "API Key 不能为空！";
            settingsMessage.className = "message error";
            settingsMessage.style.display = "block";
        }
        setTimeout(() => {
            settingsMessage.style.display = "none";
        }, 3000);
    });
});


