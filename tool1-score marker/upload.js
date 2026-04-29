
document.addEventListener("DOMContentLoaded", () => {
    const fileUploadArea = document.getElementById("fileUploadArea");
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const processFilesButton = document.getElementById("processFiles");
    const uploadMessage = document.getElementById("uploadMessage");

    let selectedFiles = [];

    // Helper to show messages
    function showMessage(msg, type) {
        uploadMessage.textContent = msg;
        uploadMessage.className = `message ${type}`;
        uploadMessage.style.display = "block";
        setTimeout(() => {
            uploadMessage.style.display = "none";
        }, 5000);
    }

    // Handle file selection
    function handleFiles(files) {
        for (const file of files) {
            if (file.type === "image/jpeg" || file.type === "image/png") {
                selectedFiles.push(file);
            } else {
                showMessage(`文件 ${file.name} 不是有效的图片格式 (JPG/PNG)。`, "error");
            }
        }
        renderFileList();
    }

    // Render file list
    function renderFileList() {
        fileList.innerHTML = "";
        selectedFiles.forEach((file, index) => {
            const listItem = document.createElement("li");
            listItem.textContent = file.name;
            const removeButton = document.createElement("button");
            removeButton.textContent = "X";
            removeButton.className = "remove-file";
            removeButton.onclick = () => {
                selectedFiles.splice(index, 1);
                renderFileList();
            };
            listItem.appendChild(removeButton);
            fileList.appendChild(listItem);
        });
    }

    // Drag and drop functionality
    fileUploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (event) => handleFiles(event.target.files));

    fileUploadArea.addEventListener("dragover", (event) => {
        event.preventDefault();
        fileUploadArea.classList.add("drag-over");
    });

    fileUploadArea.addEventListener("dragleave", (event) => {
        event.preventDefault();
        fileUploadArea.classList.remove("drag-over");
    });

    fileUploadArea.addEventListener("drop", (event) => {
        event.preventDefault();
        fileUploadArea.classList.remove("drag-over");
        handleFiles(event.dataTransfer.files);
    });

    // Process files
    processFilesButton.addEventListener("click", async () => {
        if (selectedFiles.length === 0) {
            showMessage("请先选择答题卡图片！", "error");
            return;
        }

        showMessage("正在上传并批阅答题卡，请稍候...", "success");

        const formData = new FormData();
        selectedFiles.forEach(file => {
            formData.append("files", file);
        });

        const doubaoApiKey = localStorage.getItem("doubaoApiKey");
        const doubaoSecretKey = localStorage.getItem("doubaoSecretKey");
        const standardAnswers = localStorage.getItem("standardAnswers");

        if (doubaoApiKey && doubaoSecretKey) {
            formData.append("doubaoApiKey", doubaoApiKey);
            formData.append("doubaoSecretKey", doubaoSecretKey);
        } else {
            showMessage("请在系统配置中设置豆包LLM API Key和Secret Key！", "error");
            return;
        }

        if (standardAnswers) {
            formData.append("standardAnswers", standardAnswers);
        } else {
            showMessage("请先在'标准答案管理'页面录入标准答案！", "error");
            return;
        }

        try {
            const response = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "批阅失败");
            }

            const result = await response.json();
            localStorage.setItem("gradingResults", JSON.stringify(result.items));
            showMessage("批阅完成！请前往成绩展示页面查看结果。", "success");
            selectedFiles = []; // Clear files after processing
            renderFileList();
            // Optionally navigate to results page
            // document.getElementById('nav-results').click();

        } catch (error) {
            console.error("Error processing files:", error);
            showMessage(`批阅失败: ${error.message}`, "error");
        }
    });
});


