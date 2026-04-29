(function() {
    const fileUploadArea = document.getElementById("fileUploadArea");
    const fileInput = document.getElementById("fileInput");
    const fileList = document.getElementById("fileList");
    const processFilesButton = document.getElementById("processFiles");
    const uploadMessage = document.getElementById("uploadMessage");
    const uploadProgress = document.getElementById("uploadProgress");
    const batchSummary = document.getElementById("batchSummary");

    const ACTIVE_TASK_KEY = "activeGradingTask";
    const RESULTS_KEY = "gradingResults";
    const SAFE_FILE_SIZE = 9 * 1024 * 1024;
    let selectedFiles = [];
    let pollingTimer = null;

    function showMessage(msg, type) {
        uploadMessage.textContent = msg;
        uploadMessage.className = `message ${type}`;
        uploadMessage.style.display = "block";
        setTimeout(() => {
            uploadMessage.style.display = "none";
        }, 5000);
    }

    function formatSize(size) {
        if (size >= 1024 * 1024) {
            return `${(size / 1024 / 1024).toFixed(2)} MB`;
        }
        return `${(size / 1024).toFixed(1)} KB`;
    }

    function renderBatchSummary() {
        if (selectedFiles.length === 0) {
            batchSummary.style.display = "none";
            batchSummary.textContent = "";
            return;
        }
        const totalSize = selectedFiles.reduce((sum, file) => sum + file.size, 0);
        batchSummary.style.display = "block";
        batchSummary.innerHTML = `已选择 <strong>${selectedFiles.length}</strong> 张图片，总大小约 <strong>${formatSize(totalSize)}</strong>。`;
    }

    function compressImage(file) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            const img = new Image();
            const objectUrl = URL.createObjectURL(file);

            img.onload = () => {
                try {
                    let { width, height } = img;
                    const maxDimension = 2000;
                    if (width > maxDimension || height > maxDimension) {
                        if (width > height) {
                            height = (height * maxDimension) / width;
                            width = maxDimension;
                        } else {
                            width = (width * maxDimension) / height;
                            height = maxDimension;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    const outputType = file.type === "image/png" ? "image/jpeg" : file.type;
                    const outputName = outputType === "image/jpeg" && file.name.toLowerCase().endsWith(".png")
                        ? file.name.replace(/\.png$/i, ".jpg")
                        : file.name;

                    canvas.toBlob((blob) => {
                        URL.revokeObjectURL(objectUrl);
                        if (!blob) {
                            reject(new Error("无法生成压缩文件"));
                            return;
                        }
                        resolve(new File([blob], outputName, {
                            type: outputType,
                            lastModified: Date.now(),
                        }));
                    }, outputType, 0.8);
                } catch (error) {
                    URL.revokeObjectURL(objectUrl);
                    reject(error);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectUrl);
                reject(new Error("图片加载失败"));
            };

            img.src = objectUrl;
        });
    }

    async function handleFiles(files) {
        for (const file of files) {
            if (file.type !== "image/jpeg" && file.type !== "image/png") {
                showMessage(`文件 ${file.name} 不是有效的图片格式 (JPG/PNG)。`, "error");
                continue;
            }

            let fileToUse = file;
            if (file.size > SAFE_FILE_SIZE) {
                showMessage(`正在压缩图片 ${file.name}...`, "info");
                try {
                    fileToUse = await compressImage(file);
                } catch (error) {
                    showMessage(`压缩图片 ${file.name} 失败: ${error.message}`, "error");
                    continue;
                }
            }

            if (fileToUse.size > SAFE_FILE_SIZE) {
                showMessage(`图片 ${fileToUse.name} 压缩后仍超过 ${formatSize(SAFE_FILE_SIZE)}，请先手动缩小后再上传。`, "error");
                continue;
            }

            selectedFiles.push(fileToUse);
        }
        renderFileList();
        renderBatchSummary();
    }

    function renderFileList() {
        fileList.innerHTML = "";
        selectedFiles.forEach((file, index) => {
            const listItem = document.createElement("li");
            listItem.textContent = `${file.name} (${formatSize(file.size)})`;
            const removeButton = document.createElement("button");
            removeButton.textContent = "X";
            removeButton.className = "remove-file";
            removeButton.onclick = () => {
                selectedFiles.splice(index, 1);
                renderFileList();
                renderBatchSummary();
            };
            listItem.appendChild(removeButton);
            fileList.appendChild(listItem);
        });
    }

    function saveTask(task) {
        localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(task));
    }

    function clearTask() {
        localStorage.removeItem(ACTIVE_TASK_KEY);
    }

    function saveResults(items) {
        localStorage.setItem(RESULTS_KEY, JSON.stringify(items));
    }

    function renderProgress(task) {
        if (!task) {
            uploadProgress.style.display = "none";
            uploadProgress.textContent = "";
            return;
        }
        uploadProgress.style.display = "block";
        uploadProgress.innerHTML = `当前任务：<strong>${task.status}</strong>，已处理 <strong>${task.processedFiles || 0}</strong> / <strong>${task.totalFiles || 0}</strong>，成功 <strong>${task.successCount || 0}</strong>，失败 <strong>${task.errorCount || 0}</strong>。`;
    }

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    }

    async function pollTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "获取任务进度失败");
            }

            const task = await response.json();
            saveTask(task);
            saveResults(task.items || []);
            renderProgress(task);

            if (task.status === "completed") {
                stopPolling();
                clearTask();
                showMessage(`批阅完成！共处理 ${task.totalFiles} 张答题卡。`, "success");
                setTimeout(() => {
                    const navResults = document.getElementById("nav-results");
                    if (navResults) navResults.click();
                }, 1200);
            } else if (task.status === "failed" && task.processedFiles >= task.totalFiles) {
                stopPolling();
                clearTask();
                showMessage(task.error || "批阅任务失败。", "error");
            }
        } catch (error) {
            stopPolling();
            showMessage(`获取进度失败: ${error.message}`, "error");
        }
    }

    function startPolling(taskId) {
        stopPolling();
        pollTask(taskId);
        pollingTimer = setInterval(() => pollTask(taskId), 1500);
    }

    function resumeTaskIfNeeded() {
        const storedTask = localStorage.getItem(ACTIVE_TASK_KEY);
        if (!storedTask) return;
        try {
            const task = JSON.parse(storedTask);
            if (task?.taskId) {
                renderProgress(task);
                startPolling(task.taskId);
            }
        } catch {
            clearTask();
        }
    }

    fileUploadArea.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (event) => handleFiles(event.target.files || []));

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
        handleFiles(event.dataTransfer.files || []);
    });

    processFilesButton.addEventListener("click", async () => {
        if (selectedFiles.length === 0) {
            showMessage("请先选择答题卡图片！", "error");
            return;
        }

        const doubaoApiKey = localStorage.getItem("doubaoApiKey");
        const doubaoSecretKey = localStorage.getItem("doubaoSecretKey");
        const standardAnswers = localStorage.getItem("standardAnswers");

        if (!doubaoApiKey) {
            showMessage("请在系统配置中设置豆包LLM API Key！", "error");
            return;
        }

        if (!standardAnswers) {
            showMessage("请先在“标准答案管理”页面录入标准答案！", "error");
            return;
        }

        processFilesButton.disabled = true;
        showMessage("正在创建批阅任务，请稍候...", "info");

        const formData = new FormData();
        selectedFiles.forEach(file => formData.append("files", file));
        formData.append("doubaoApiKey", doubaoApiKey);
        if (doubaoSecretKey) formData.append("doubaoSecretKey", doubaoSecretKey);
        formData.append("standardAnswers", standardAnswers);

        try {
            const response = await fetch("/api/process", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "批阅失败");
            }

            const task = await response.json();
            saveTask(task);
            saveResults([]);
            renderProgress(task);
            showMessage(`任务已创建，共 ${task.totalFiles} 张图片，正在后台批阅。`, "success");
            selectedFiles = [];
            renderFileList();
            renderBatchSummary();
            startPolling(task.taskId);
        } catch (error) {
            showMessage(`批阅失败: ${error.message}`, "error");
        } finally {
            processFilesButton.disabled = false;
        }
    });

    window.addEventListener("beforeunload", () => {
        stopPolling();
    });

    renderBatchSummary();
    resumeTaskIfNeeded();
})();
