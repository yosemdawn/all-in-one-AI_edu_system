(function() {
    const gradingResultsContainer = document.getElementById("gradingResultsContainer");
    const resultsMessage = document.getElementById("resultsMessage");
    const exportCsvButton = document.getElementById("exportCsvButton");
    const refreshResultsButton = document.getElementById("refreshResults");
    const resultsProgress = document.getElementById("resultsProgress");

    const ACTIVE_TASK_KEY = "activeGradingTask";
    const RESULTS_KEY = "gradingResults";
    let allGradingResults = [];
    let pollingTimer = null;

    function showMessage(msg, type) {
        resultsMessage.textContent = msg;
        resultsMessage.className = `message ${type}`;
        resultsMessage.style.display = "block";
        setTimeout(() => {
            resultsMessage.style.display = "none";
        }, 5000);
    }

    function renderTaskProgress(task) {
        if (!task) {
            resultsProgress.style.display = "none";
            resultsProgress.textContent = "";
            return;
        }
        resultsProgress.style.display = "block";
        resultsProgress.innerHTML = `批阅任务状态：<strong>${task.status}</strong>，已处理 <strong>${task.processedFiles || 0}</strong> / <strong>${task.totalFiles || 0}</strong>，成功 <strong>${task.successCount || 0}</strong>，失败 <strong>${task.errorCount || 0}</strong>。`;
    }

    function readResults() {
        const storedResults = localStorage.getItem(RESULTS_KEY);
        if (!storedResults) {
            allGradingResults = [];
            return [];
        }
        try {
            const parsed = JSON.parse(storedResults);
            allGradingResults = Array.isArray(parsed) ? parsed : [];
            return allGradingResults;
        } catch {
            allGradingResults = [];
            return [];
        }
    }

    function renderResults() {
        gradingResultsContainer.innerHTML = "";
        const storedResults = readResults();
        if (storedResults.length === 0) {
            gradingResultsContainer.innerHTML = "";
            showMessage("暂无批阅结果。请先在“答题卡处理”页面上传并批阅答题卡。", "info");
            return;
        }

        storedResults.forEach((studentResult) => {
            const studentCard = document.createElement("div");
            studentCard.className = "student-card section";

            if (studentResult.status === "pending" || studentResult.status === "processing") {
                studentCard.innerHTML = `
                    <h3>文件: ${studentResult.filename}</h3>
                    <p>状态：${studentResult.status === "pending" ? "排队中" : "处理中"}</p>
                `;
            } else if (studentResult.error) {
                studentCard.innerHTML = `
                    <h3>文件: ${studentResult.filename}</h3>
                    <p class="incorrect">错误: ${studentResult.error}</p>
                `;
            } else {
                let totalScore = 0;
                let detailHtml = `
                    <h4>得分详情 <button class="grade-detail-toggle">展开</button></h4>
                    <div class="grade-detail" style="display:none;">
                `;

                for (const qNum in studentResult.grading) {
                    const grade = studentResult.grading[qNum];
                    totalScore += grade.score;
                    detailHtml += `
                        <p>
                            题号: ${qNum} | 题型: ${grade.questionType === "single_choice" ? "选择题" : "填空题"} |
                            标准答案: ${grade.standardAnswer} | 学生答案: ${grade.studentAnswer || "未作答"} |
                            是否正确: <span class="${grade.isCorrect ? "correct" : "incorrect"}">${grade.isCorrect ? "是" : "否"}</span> |
                            得分: ${grade.score}
                        </p>
                    `;
                }
                detailHtml += "</div>";

                studentCard.innerHTML = `
                    <h3>学生: ${studentResult.parsed?.name || "未识别"} (文件: ${studentResult.filename})</h3>
                    <p>总分: <strong>${totalScore}</strong></p>
                    ${detailHtml}
                `;
            }

            gradingResultsContainer.appendChild(studentCard);
        });

        document.querySelectorAll(".grade-detail-toggle").forEach((button) => {
            button.addEventListener("click", (event) => {
                const currentButton = event.currentTarget;
                const detailDiv = currentButton.parentNode.nextElementSibling;
                const isHidden = detailDiv.style.display === "none";
                detailDiv.style.display = isHidden ? "block" : "none";
                currentButton.textContent = isHidden ? "收起" : "展开";
            });
        });
    }

    function stopPolling() {
        if (pollingTimer) {
            clearInterval(pollingTimer);
            pollingTimer = null;
        }
    }

    async function fetchTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || "获取任务进度失败");
            }
            const task = await response.json();
            localStorage.setItem(ACTIVE_TASK_KEY, JSON.stringify(task));
            localStorage.setItem(RESULTS_KEY, JSON.stringify(task.items || []));
            renderTaskProgress(task);
            renderResults();

            if (task.status === "completed") {
                stopPolling();
                localStorage.removeItem(ACTIVE_TASK_KEY);
                showMessage("批阅已完成，结果已更新。", "success");
                renderTaskProgress(null);
            } else if (task.status === "failed" && task.processedFiles >= task.totalFiles) {
                stopPolling();
                localStorage.removeItem(ACTIVE_TASK_KEY);
                showMessage(task.error || "批阅任务失败。", "error");
            }
        } catch (error) {
            stopPolling();
            showMessage(`刷新进度失败: ${error.message}`, "error");
        }
    }

    function startPolling(taskId) {
        stopPolling();
        fetchTask(taskId);
        pollingTimer = setInterval(() => fetchTask(taskId), 1500);
    }

    exportCsvButton.addEventListener("click", async () => {
        readResults();
        const exportableResults = allGradingResults.filter((item) => item.status !== "pending" && item.status !== "processing");
        if (exportableResults.length === 0) {
            showMessage("没有可导出的已完成成绩数据。", "error");
            return;
        }

        showMessage("正在导出CSV文件...", "info");

        try {
            const response = await fetch("/api/export", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ gradingResults: exportableResults }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || "CSV导出失败");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = "成绩报告.csv";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            showMessage("CSV文件已成功导出！", "success");
        } catch (error) {
            showMessage(`CSV导出失败: ${error.message}`, "error");
        }
    });

    if (refreshResultsButton) {
        refreshResultsButton.addEventListener("click", () => {
            const storedTask = localStorage.getItem(ACTIVE_TASK_KEY);
            if (storedTask) {
                try {
                    const task = JSON.parse(storedTask);
                    renderTaskProgress(task);
                    if (task?.taskId) {
                        startPolling(task.taskId);
                        return;
                    }
                } catch {
                    localStorage.removeItem(ACTIVE_TASK_KEY);
                }
            }
            renderTaskProgress(null);
            renderResults();
        });
    }

    const storedTask = localStorage.getItem(ACTIVE_TASK_KEY);
    if (storedTask) {
        try {
            const task = JSON.parse(storedTask);
            renderTaskProgress(task);
            if (task?.taskId) {
                startPolling(task.taskId);
            }
        } catch {
            localStorage.removeItem(ACTIVE_TASK_KEY);
            renderTaskProgress(null);
            renderResults();
        }
    } else {
        renderTaskProgress(null);
        renderResults();
    }
})();
