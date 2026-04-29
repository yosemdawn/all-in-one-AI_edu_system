
document.addEventListener("DOMContentLoaded", () => {
    const questionNumberInput = document.getElementById("questionNumber");
    const answerContentInput = document.getElementById("answerContent");
    const questionTypeSelect = document.getElementById("questionType");
    const addAnswerButton = document.getElementById("addAnswer");
    const answersMessage = document.getElementById("answersMessage");
    const answersTableBody = document.querySelector("#answersTable tbody");

    let standardAnswers = JSON.parse(localStorage.getItem("standardAnswers")) || {};

    function saveAnswers() {
        localStorage.setItem("standardAnswers", JSON.stringify(standardAnswers));
        renderAnswers();
    }

    function renderAnswers() {
        answersTableBody.innerHTML = "";
        for (const qNum in standardAnswers) {
            const answer = standardAnswers[qNum];
            const row = answersTableBody.insertRow();
            row.insertCell(0).textContent = qNum;
            row.insertCell(1).textContent = answer.type === "single_choice" ? "单项选择题" : "填空题";
            row.insertCell(2).textContent = answer.content;
            const actionsCell = row.insertCell(3);
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
    }

    function showMessage(msg, type) {
        answersMessage.textContent = msg;
        answersMessage.className = `message ${type}`;
        answersMessage.style.display = "block";
        setTimeout(() => {
            answersMessage.style.display = "none";
        }, 3000);
    }

    addAnswerButton.addEventListener("click", () => {
        const qNum = questionNumberInput.value.trim();
        const content = answerContentInput.value.trim();
        const type = questionTypeSelect.value;

        if (qNum && content) {
            standardAnswers[qNum] = { content, type };
            saveAnswers();
            showMessage("答案已添加/更新！", "success");
            questionNumberInput.value = "";
            answerContentInput.value = "";
        } else {
            showMessage("题号和答案内容不能为空！", "error");
        }
    });

    renderAnswers(); // Initial render
});


