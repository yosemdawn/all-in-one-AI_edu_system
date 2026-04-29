(function() {
    const questionNumberInput = document.getElementById("questionNumber");
    const answerContentInput = document.getElementById("answerContent");
    const questionTypeSelect = document.getElementById("questionType");
    const questionScoreInput = document.getElementById("questionScore");
    const addAnswerButton = document.getElementById("addAnswer");
    const answersMessage = document.getElementById("answersMessage");
    const answersTableBody = document.querySelector("#answersTable tbody");
    const parseScoreConfigButton = document.getElementById("parseScoreConfig");
    const scoreDescriptionInput = document.getElementById("scoreDescription");
    const parseAnswerConfigButton = document.getElementById("parseAnswerConfig");
    const answerDescriptionInput = document.getElementById("answerDescription");

    let standardAnswers = JSON.parse(localStorage.getItem("standardAnswers") || "{}");

    function saveAnswers() {
        localStorage.setItem("standardAnswers", JSON.stringify(standardAnswers));
        renderAnswers();
    }

    function renderAnswers() {
        answersTableBody.innerHTML = "";

        const sortedKeys = Object.keys(standardAnswers).sort((a, b) => {
            const numA = parseFloat(a);
            const numB = parseFloat(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return a.localeCompare(b);
        });

        for (const qNum of sortedKeys) {
            const answer = standardAnswers[qNum];
            const row = answersTableBody.insertRow();
            row.insertCell(0).textContent = qNum;
            row.insertCell(1).textContent = answer.type === "single_choice" ? "单项选择题" : "填空题";
            row.insertCell(2).textContent = answer.content;
            const scoreCell = row.insertCell(3);
            scoreCell.textContent = answer.score !== undefined ? `${answer.score} 分` : "未设置";
            scoreCell.style.color = answer.score !== undefined ? "#333" : "#999";

            const actionsCell = row.insertCell(4);
            const deleteButton = document.createElement("button");
            deleteButton.textContent = "删除";
            deleteButton.className = "button-group secondary";
            deleteButton.onclick = () => {
                delete standardAnswers[qNum];
                saveAnswers();
                showMessage("答案已删除！", "success");
            };
            actionsCell.appendChild(deleteButton);
        }

        updateTotalScore();
    }

    function updateTotalScore() {
        let existing = document.getElementById("totalScoreSummary");
        if (!existing) {
            existing = document.createElement("p");
            existing.id = "totalScoreSummary";
            existing.style.cssText = "margin-top:12px; font-weight:bold; color:#2c3e50;";
            answersTableBody.closest("table").insertAdjacentElement("afterend", existing);
        }
        const totalQuestions = Object.keys(standardAnswers).length;
        const totalScore = Object.values(standardAnswers).reduce((sum, answer) => sum + (Number(answer.score) || 0), 0);
        existing.textContent = `共 ${totalQuestions} 题，满分合计：${totalScore} 分`;
    }

    function showMessage(msg, type) {
        answersMessage.textContent = msg;
        answersMessage.className = `message ${type}`;
        answersMessage.style.display = "block";
        setTimeout(() => {
            answersMessage.style.display = "none";
        }, 4000);
    }

    addAnswerButton.addEventListener("click", () => {
        const qNum = questionNumberInput.value.trim();
        const content = answerContentInput.value.trim();
        const type = questionTypeSelect.value;
        const scoreRaw = questionScoreInput.value.trim();
        const score = scoreRaw !== "" ? parseFloat(scoreRaw) : undefined;

        if (!qNum || !content) {
            showMessage("题号和答案内容不能为空！", "error");
            return;
        }
        if (scoreRaw !== "" && (isNaN(score) || score < 0)) {
            showMessage("分值必须是大于等于 0 的数字！", "error");
            return;
        }

        standardAnswers[qNum] = { content, type, score };
        saveAnswers();
        showMessage("答案已添加/更新！", "success");
        questionNumberInput.value = "";
        answerContentInput.value = "";
        questionScoreInput.value = "1";
    });

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.message || "请求失败");
        }

        return response.json();
    }

    function getApiCredentials() {
        const doubaoApiKey = localStorage.getItem("doubaoApiKey");
        const doubaoSecretKey = localStorage.getItem("doubaoSecretKey");
        if (!doubaoApiKey) {
            throw new Error("请先在系统配置中设置 API Key！");
        }
        return { doubaoApiKey, doubaoSecretKey };
    }

    if (parseScoreConfigButton && scoreDescriptionInput) {
        parseScoreConfigButton.addEventListener("click", async () => {
            const text = scoreDescriptionInput.value.trim();
            if (!text) {
                showMessage("请输入分值描述！", "error");
                return;
            }

            let credentials;
            try {
                credentials = getApiCredentials();
            } catch (error) {
                showMessage(error.message, "error");
                return;
            }

            parseScoreConfigButton.disabled = true;
            parseScoreConfigButton.textContent = "正在解析分值...";

            try {
                const result = await postJson("/api/parse-score-config", {
                    text,
                    ...credentials,
                });
                const scoreMap = result.scoreMap || {};

                let updatedCount = 0;
                const skippedKeys = [];
                for (const qNum in scoreMap) {
                    if (standardAnswers[qNum]) {
                        standardAnswers[qNum].score = scoreMap[qNum];
                        updatedCount += 1;
                    } else {
                        skippedKeys.push(qNum);
                    }
                }

                if (updatedCount > 0) {
                    saveAnswers();
                    let msg = `成功更新 ${updatedCount} 道题的分值！`;
                    if (skippedKeys.length > 0) {
                        msg += ` 已跳过 ${skippedKeys.length} 个未录入题号。`;
                    }
                    showMessage(msg, "success");
                } else {
                    showMessage("解析出的题号与已录入答案不匹配。", "error");
                }
            } catch (error) {
                showMessage(`解析失败: ${error.message}`, "error");
            } finally {
                parseScoreConfigButton.disabled = false;
                parseScoreConfigButton.textContent = "智能解析并应用分值";
            }
        });
    }

    if (parseAnswerConfigButton && answerDescriptionInput) {
        parseAnswerConfigButton.addEventListener("click", async () => {
            const text = answerDescriptionInput.value.trim();
            if (!text) {
                showMessage("请输入标准答案描述！", "error");
                return;
            }

            let credentials;
            try {
                credentials = getApiCredentials();
            } catch (error) {
                showMessage(error.message, "error");
                return;
            }

            parseAnswerConfigButton.disabled = true;
            parseAnswerConfigButton.textContent = "正在解析答案...";

            try {
                const result = await postJson("/api/parse-answer-config", {
                    text,
                    ...credentials,
                });
                const answersMap = result.answersMap || {};
                const keys = Object.keys(answersMap);
                if (keys.length === 0) {
                    throw new Error("LLM 未解析出有效标准答案。");
                }

                let createdCount = 0;
                let updatedCount = 0;
                keys.forEach((qNum) => {
                    const parsedAnswer = answersMap[qNum];
                    const existing = standardAnswers[qNum];
                    standardAnswers[qNum] = {
                        content: parsedAnswer.content,
                        type: parsedAnswer.type,
                        score: parsedAnswer.score !== undefined ? parsedAnswer.score : existing?.score,
                    };
                    if (existing) {
                        updatedCount += 1;
                    } else {
                        createdCount += 1;
                    }
                });

                saveAnswers();
                showMessage(`成功应用标准答案：新增 ${createdCount} 题，更新 ${updatedCount} 题。`, "success");
            } catch (error) {
                showMessage(`解析失败: ${error.message}`, "error");
            } finally {
                parseAnswerConfigButton.disabled = false;
                parseAnswerConfigButton.textContent = "智能解析并应用答案";
            }
        });
    }

    renderAnswers();
})();
