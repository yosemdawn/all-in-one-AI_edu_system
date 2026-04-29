document.addEventListener('DOMContentLoaded', () => {
    // 全局状态
    let sessionId = null;
    let taskId = null;
    let promptFile = null;
    let essayFiles = [];
    let pollInterval = null;

    // 元素获取
    const steps = document.querySelectorAll('.step');
    const stepContents = document.querySelectorAll('.step-content');
    
    // 步骤1
    const promptUploadZone = document.getElementById('promptUploadZone');
    const selectPromptFileBtn = document.getElementById('selectPromptFileBtn');
    const promptFileInput = document.getElementById('promptFileInput');
    const nextToStep2Btn = document.getElementById('nextToStep2Btn');
    const removePromptFileBtn = document.getElementById('removePromptFileBtn');

    // 步骤2
    const selectEssayFilesBtn = document.getElementById('selectEssayFilesBtn');
    const essayFilesInput = document.getElementById('essayFilesInput');
    const fileListContent = document.getElementById('fileListContent');
    const fileCountEl = document.getElementById('fileCount');
    const totalSizeEl = document.getElementById('totalSize');
    const backToStep1Btn = document.getElementById('backToStep1Btn');
    const nextToStep3Btn = document.getElementById('nextToStep3Btn');

    // 步骤3
    const backToStep2Btn = document.getElementById('backToStep2Btn');
    const startProcessingBtn = document.getElementById('startProcessingBtn');
    const viewResultsBtn = document.getElementById('viewResultsBtn');
    const progressBar = document.getElementById('progressBar');
    const currentStatusEl = document.getElementById('currentStatus');
    const completedCountEl = document.getElementById('completedCount');
    const totalCountEl = document.getElementById('totalCount');
    const logContent = document.getElementById('logContent');

    // 步骤4
    const startNewBtn = document.getElementById('startNewBtn');
    const resultsTableBody = document.getElementById('resultsTableBody');
    const totalProcessedEl = document.getElementById('totalProcessed');
    const successCountEl = document.getElementById('successCount');
    const failedCountEl = document.getElementById('failedCount');
    const averageScoreEl = document.getElementById('averageScore');


    // --- 通用函数 ---
    function showNotification(message, type = 'info') {
        const notification = document.getElementById('notification');
        notification.textContent = message;
        notification.className = `alert alert-${type}`;
        notification.style.display = 'block';
        setTimeout(() => {
            notification.style.display = 'none';
        }, 5000);
    }

    function goToStep(stepNumber) {
        steps.forEach((step, index) => {
            step.classList.toggle('active', index + 1 === stepNumber);
            step.classList.toggle('completed', index + 1 < stepNumber);
        });
        stepContents.forEach((content, index) => {
            content.style.display = (index + 1 === stepNumber) ? 'block' : 'none';
        });
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // --- 步骤1: 上传作文要求 ---
    selectPromptFileBtn.addEventListener('click', () => promptFileInput.click());
    promptFileInput.addEventListener('change', (e) => handlePromptFile(e.target.files[0]));
    
    promptUploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        promptUploadZone.classList.add('dragover');
    });
    promptUploadZone.addEventListener('dragleave', () => promptUploadZone.classList.remove('dragover'));
    promptUploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        promptUploadZone.classList.remove('dragover');
        handlePromptFile(e.dataTransfer.files[0]);
    });

    async function handlePromptFile(file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showNotification('请上传图片文件', 'danger');
            return;
        }
        promptFile = file;
        
        const formData = new FormData();
        formData.append('file', promptFile);

        try {
            const response = await fetch('/api/grading/upload-prompt', { method: 'POST', body: formData });
            if (!response.ok) throw new Error('上传失败');
            const data = await response.json();
            sessionId = data.session_id;
            
            updatePromptPreview();
            nextToStep2Btn.disabled = false;
            showNotification('作文要求上传成功', 'success');
        } catch (error) {
            showNotification(`上传失败: ${error.message}`, 'danger');
            promptFile = null;
        }
    }

    function updatePromptPreview() {
        const previewArea = promptUploadZone.querySelector('.preview-area');
        const uploadArea = promptUploadZone.querySelector('.upload-area');
        if (promptFile) {
            previewArea.style.display = 'block';
            uploadArea.style.display = 'none';
            previewArea.querySelector('.preview-image').src = URL.createObjectURL(promptFile);
            previewArea.querySelector('.file-name').textContent = promptFile.name;
            previewArea.querySelector('.file-size').textContent = formatBytes(promptFile.size);
        } else {
            previewArea.style.display = 'none';
            uploadArea.style.display = 'block';
            promptFileInput.value = '';
        }
    }

    removePromptFileBtn.addEventListener('click', () => {
        promptFile = null;
        sessionId = null; // 重置会话
        nextToStep2Btn.disabled = true;
        updatePromptPreview();
    });

    nextToStep2Btn.addEventListener('click', () => goToStep(2));

    // --- 步骤2: 上传学生作文 ---
    selectEssayFilesBtn.addEventListener('click', () => essayFilesInput.click());
    essayFilesInput.addEventListener('change', (e) => handleEssayFiles(e.target.files));

    async function handleEssayFiles(files) {
        if (!files.length) return;
        essayFiles = Array.from(files);
        
        const formData = new FormData();
        essayFiles.forEach(file => formData.append('files', file));

        try {
            const response = await fetch(`/api/grading/upload-essays/${sessionId}`, { method: 'POST', body: formData });
            if (!response.ok) throw new Error('上传失败');
            await response.json();
            
            updateEssayFileList();
            nextToStep3Btn.disabled = false;
            showNotification(`${files.length}份作文上传成功`, 'success');
        } catch (error) {
            showNotification(`上传失败: ${error.message}`, 'danger');
            essayFiles = [];
        }
    }

    function updateEssayFileList() {
        fileListContent.innerHTML = '';
        let totalSize = 0;
        essayFiles.forEach((file, index) => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';
            fileItem.innerHTML = `
                <span>${file.name}</span>
                <span>${formatBytes(file.size)}</span>
                <span>已上传</span>
                <button class="btn btn-danger btn-sm" data-index="${index}">删除</button>
            `;
            fileListContent.appendChild(fileItem);
            totalSize += file.size;
        });
        
        document.getElementById('fileList').style.display = essayFiles.length ? 'block' : 'none';
        document.querySelector('.upload-summary').style.display = essayFiles.length ? 'block' : 'none';
        fileCountEl.textContent = essayFiles.length;
        totalSizeEl.textContent = formatBytes(totalSize);
    }

    backToStep1Btn.addEventListener('click', () => goToStep(1));
    nextToStep3Btn.addEventListener('click', () => {
        totalCountEl.textContent = essayFiles.length;
        goToStep(3);
    });

    // --- 步骤3: 开始处理 ---
    startProcessingBtn.addEventListener('click', async () => {
        startProcessingBtn.disabled = true;
        backToStep2Btn.disabled = true;
        
        try {
            const response = await fetch(`/api/grading/process-batch/${sessionId}`, { method: 'POST' });
            if (response.status !== 202) throw new Error('启动任务失败');
            const data = await response.json();
            taskId = data.task_id;
            
            addLog('批处理任务已启动...');
            startPolling();
        } catch (error) {
            showNotification(`任务启动失败: ${error.message}`, 'danger');
            startProcessingBtn.disabled = false;
            backToStep2Btn.disabled = false;
        }
    });

    function startPolling() {
        pollInterval = setInterval(async () => {
            if (!taskId) return;
            try {
                const response = await fetch(`/api/grading/status/${taskId}`);
                if (!response.ok) throw new Error('状态查询失败');
                const status = await response.json();
                
                console.log('轮询状态:', status); // 添加调试日志
                updateProgress(status);

                if (status.status === 'completed' || status.status === 'failed') {
                    stopPolling();
                    handleCompletion(status);
                }
            } catch (error) {
                console.error('轮询错误:', error);
                stopPolling();
                showNotification('与服务器断开连接', 'danger');
            }
        }, 2000);
    }

    function stopPolling() {
        clearInterval(pollInterval);
        pollInterval = null;
    }

    function updateProgress(status) {
        progressBar.style.width = `${status.progress || 0}%`;
        progressBar.textContent = `${status.progress || 0}%`;
        currentStatusEl.textContent = status.current_step || status.status;
        completedCountEl.textContent = status.completed_count || 0;
    }
    
    function handleCompletion(status) {
        console.log('任务完成状态:', status); // 添加调试日志
        
        if (status.status === 'completed') {
            showNotification('批阅完成！', 'success');
            viewResultsBtn.style.display = 'inline-block';
            
            if (status.result) {
                populateResults(status.result);
            } else {
                console.error('任务完成但结果为空:', status);
                showNotification('批阅完成，但未获取到结果数据', 'warning');
            }
        } else {
            showNotification(`处理失败: ${status.error}`, 'danger');
            addLog(`错误: ${status.error}`);
        }
    }

    function addLog(message) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    viewResultsBtn.addEventListener('click', () => goToStep(4));
    backToStep2Btn.addEventListener('click', () => goToStep(2));

    // --- 步骤4: 查看结果 ---
    function populateResults(report) {
        console.log('收到报告数据:', report); // 添加调试日志
        
        // 保存报告数据用于下载功能
        currentReport = report;
        
        if (!report) {
            console.error('报告数据为空:', report);
            showNotification('获取结果数据失败：数据为空', 'danger');
            return;
        }
        
        if (!report.summary) {
            console.error('报告数据格式错误，缺少summary:', report);
            showNotification('获取结果数据失败：数据格式错误', 'danger');
            return;
        }
        
        const summary = report.summary;
        totalProcessedEl.textContent = summary.total_essays || 0;
        successCountEl.textContent = summary.successful_grades || 0;
        failedCountEl.textContent = summary.failed_grades || 0;
        averageScoreEl.textContent = summary.average_score || 0;

        resultsTableBody.innerHTML = '';
        if (report.details && Array.isArray(report.details)) {
            report.details.forEach((item, index) => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${item.student_name || '未知'}</td>
                    <td>${item.grading_result ? item.grading_result.score : 'N/A'}</td>
                    <td>${item.email_sent ? '✔️ 已发送' : '❌ 未发送'}</td>
                    <td>${item.error || '无'}</td>
                    <td><button class="btn btn-sm btn-info view-detail-btn" data-index="${index}">详情</button></td>
                `;
                resultsTableBody.appendChild(row);
            });
            
            // 为详情按钮添加事件监听器
            document.querySelectorAll('.view-detail-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.dataset.index);
                    showStudentDetail(report.details[index]);
                });
            });
        } else {
            console.error('详细结果数据格式错误:', report.details);
        }
    }

    // 全局变量存储当前报告数据，用于下载功能
    let currentReport = null;

    // 修改populateResults函数，保存报告数据
    const originalPopulateResults = populateResults;
    populateResults = function(report) {
        currentReport = report; // 保存报告数据
        return originalPopulateResults(report);
    };

    // --- 步骤4: 新增功能 ---
    
    // 下载报告功能
    const downloadReportBtn = document.getElementById('downloadReportBtn');
    downloadReportBtn.addEventListener('click', () => {
        if (!currentReport) {
            showNotification('没有可下载的报告数据', 'warning');
            return;
        }
        
        try {
            downloadReport(currentReport);
            showNotification('报告下载成功', 'success');
        } catch (error) {
            console.error('下载报告失败:', error);
            showNotification('下载报告失败: ' + error.message, 'danger');
        }
    });

    // 下载报告实现
    function downloadReport(report) {
        // 生成报告内容
        const reportContent = generateReportContent(report);
        
        // 创建Blob对象
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        
        // 创建下载链接
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `作文批阅报告_${new Date().toISOString().slice(0, 10)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 生成报告内容
    function generateReportContent(report) {
        const summary = report.summary;
        let content = '';
        
        content += '='.repeat(50) + '\n';
        content += '牛逼格拉斯 - AI作文批阅系统\n';
        content += '批阅报告\n';
        content += '='.repeat(50) + '\n\n';
        
        content += '生成时间: ' + new Date().toLocaleString('zh-CN') + '\n\n';
        
        // 统计概览
        content += '【统计概览】\n';
        content += '-'.repeat(30) + '\n';
        content += `总计处理: ${summary.total_essays}份\n`;
        content += `成功批阅: ${summary.successful_grades}份\n`;
        content += `处理失败: ${summary.failed_grades}份\n`;
        content += `平均分: ${summary.average_score}分\n\n`;
        
        // 详细结果
        content += '【详细结果】\n';
        content += '-'.repeat(30) + '\n';
        
        if (report.details && Array.isArray(report.details)) {
            report.details.forEach((item, index) => {
                content += `${index + 1}. 学生: ${item.student_name || '未知'}\n`;
                content += `   分数: ${item.grading_result ? item.grading_result.score + '分' : '未评分'}\n`;
                content += `   邮件: ${item.email_sent ? '已发送' : '未发送'}\n`;
                
                if (item.grading_result && item.grading_result.suggestions) {
                    content += `   批阅建议:\n`;
                    item.grading_result.suggestions.forEach((suggestion, idx) => {
                        if (typeof suggestion === 'string') {
                            // 字符串类型，直接显示
                            content += `     ${idx + 1}) ${suggestion}\n`;
                        } else if (typeof suggestion === 'object' && suggestion !== null) {
                            // 对象类型，格式化显示
                            content += `     ${idx + 1}) `;
                            if (suggestion.original_sentence) {
                                content += `原句: ${suggestion.original_sentence}\n`;
                                content += `        `;
                            }
                            if (suggestion.revised_sentence) {
                                content += `修改后: ${suggestion.revised_sentence}\n`;
                                content += `        `;
                            }
                            if (suggestion.reason) {
                                content += `理由: ${suggestion.reason}\n`;
                            }
                        } else {
                            content += `     ${idx + 1}) ${String(suggestion)}\n`;
                        }
                    });
                }
                
                if (item.error) {
                    content += `   错误信息: ${item.error}\n`;
                }
                content += '\n';
            });
        }
        
        content += '='.repeat(50) + '\n';
        content += '报告生成完成\n';
        
        return content;
    }

    // 显示学生详情模态框
    function showStudentDetail(studentData) {
        console.log('显示学生详情:', studentData);
        
        // 创建模态框HTML
        const modalHTML = `
            <div class="modal fade" id="studentDetailModal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">学生详情 - ${studentData.student_name || '未知'}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            ${generateStudentDetailContent(studentData)}
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">关闭</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 移除已存在的模态框
        const existingModal = document.getElementById('studentDetailModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // 添加新模态框到页面
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // 显示模态框
        const modal = new bootstrap.Modal(document.getElementById('studentDetailModal'));
        modal.show();
    }

    // 生成学生详情内容
    function generateStudentDetailContent(studentData) {
        let content = '';
        
        // 基本信息
        content += '<div class="mb-4">';
        content += '<h6>基本信息</h6>';
        content += '<div class="row">';
        content += `<div class="col-md-6"><strong>学生姓名:</strong> ${studentData.student_name || '未知'}</div>`;
        content += `<div class="col-md-6"><strong>邮箱地址:</strong> ${studentData.student_email || '未找到'}</div>`;
        content += `<div class="col-md-6"><strong>邮件状态:</strong> ${studentData.email_sent ? '✔️ 已发送' : '❌ 未发送'}</div>`;
        content += `<div class="col-md-6"><strong>处理状态:</strong> ${studentData.error ? '❌ 失败' : '✅ 成功'}</div>`;
        content += '</div>';
        content += '</div>';
        
        // 批阅结果
        if (studentData.grading_result) {
            const result = studentData.grading_result;
            content += '<div class="mb-4">';
            content += '<h6>批阅结果</h6>';
            content += `<div class="alert alert-info"><strong>总分: ${result.score}分</strong></div>`;
            
            if (result.suggestions) {
                content += '<h6 class="mt-3">具体建议</h6>';
                content += '<div class="list-group">';
                
                // 处理不同的建议数据格式
                if (Array.isArray(result.suggestions)) {
                    result.suggestions.forEach((suggestion, idx) => {
                        if (typeof suggestion === 'string') {
                            // 字符串类型，直接显示
                            content += `<div class="list-group-item">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">建议 ${idx + 1}</h6>
                                </div>
                                <p class="mb-1">${suggestion}</p>
                            </div>`;
                        } else if (typeof suggestion === 'object' && suggestion !== null) {
                            // 对象类型，格式化显示
                            content += `<div class="list-group-item">
                                <div class="d-flex w-100 justify-content-between">
                                    <h6 class="mb-1">建议 ${idx + 1}</h6>
                                </div>`;
                            
                            if (suggestion.original_sentence) {
                                content += `<p class="mb-1"><strong>原句：</strong><br>${suggestion.original_sentence}</p>`;
                            }
                            if (suggestion.revised_sentence) {
                                content += `<p class="mb-1"><strong>修改后：</strong><br>${suggestion.revised_sentence}</p>`;
                            }
                            if (suggestion.reason) {
                                content += `<p class="mb-1"><strong>理由：</strong><br>${suggestion.reason}</p>`;
                            }
                            
                            content += `</div>`;
                        } else {
                            content += `<div class="list-group-item">
                                <p class="mb-1">${String(suggestion)}</p>
                            </div>`;
                        }
                    });
                } else if (typeof result.suggestions === 'object') {
                    // 如果suggestions本身是一个对象，尝试提取键值对
                    Object.entries(result.suggestions).forEach(([key, value]) => {
                        content += `<div class="list-group-item"><strong>${key}:</strong> ${value}</div>`;
                    });
                } else {
                    // 如果是字符串或其他类型，直接显示
                    content += `<div class="list-group-item">${result.suggestions}</div>`;
                }
                
                content += '</div>';
            }
            content += '</div>';
        }
        
        // 错误信息
        if (studentData.error) {
            content += '<div class="mb-4">';
            content += '<h6>错误信息</h6>';
            content += `<div class="alert alert-danger">${studentData.error}</div>`;
            content += '</div>';
        }
        
        return content;
    }

    startNewBtn.addEventListener('click', () => {
        // 重置所有状态
        sessionId = null;
        taskId = null;
        promptFile = null;
        essayFiles = [];
        stopPolling();
        
        // 重置UI
        nextToStep2Btn.disabled = true;
        nextToStep3Btn.disabled = true;
        startProcessingBtn.disabled = false;
        backToStep2Btn.disabled = false;
        viewResultsBtn.style.display = 'none';
        currentReport = null; // 清空报告数据
        updatePromptPreview();
        updateEssayFileList();
        
        goToStep(1);
    });
});