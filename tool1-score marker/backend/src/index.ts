import express from 'express';
import multer from 'multer';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import http from 'http';
import { randomUUID } from 'crypto';
import { gradeStudentAnswers } from './grader';

const app = express();
const DEFAULT_PORT = 3000;
const uploadDir = path.join(os.tmpdir(), 'score-marker-uploads');
const TASK_TTL_MS = 30 * 60 * 1000;
const IMAGE_LLM_TIMEOUT_MS = 120000;
const TEXT_LLM_TIMEOUT_MS = 45000;
let server: http.Server | null = null;

fs.mkdirSync(uploadDir, { recursive: true });

function resolveFrontendDir() {
    const candidates = [
        path.join(__dirname, 'frontend'),
        path.join(__dirname, '../frontend'),
        path.join(__dirname, '../../frontend'),
        path.join(process.cwd(), 'frontend'),
        path.join(path.dirname(process.execPath), 'frontend'),
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(path.join(candidate, 'index.html'))) {
            return candidate;
        }
    }

    throw new Error(`Frontend directory not found. Checked: ${candidates.join(', ')}`);
}

function openBrowser(url: string) {
    const encodedUrl = url.replace(/&/g, '^&');
    exec(`start "" "${encodedUrl}"`);
}

const frontendDir = resolveFrontendDir();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontendDir));

const upload = multer({
    storage: multer.diskStorage({
        destination: (_req, _file, cb) => cb(null, uploadDir),
        filename: (_req, file, cb) => cb(null, `${Date.now()}-${randomUUID()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
    }),
    limits: {
        files: 100,
        fileSize: 15 * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/png') {
            cb(null, true);
            return;
        }
        cb(new Error('仅支持 JPG/PNG 图片上传。'));
    },
});

interface LLMResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

interface ParsedLLMResult {
    name: string;
    answers: { [key: string]: string };
    error?: string;
}

interface StandardAnswer {
    content: string;
    type: 'single_choice' | 'fill_in_blank';
    score?: number;
}

interface ParsedAnswerConfigItem {
    content: string;
    type: 'single_choice' | 'fill_in_blank';
    score?: number;
}

interface UploadedTaskFile {
    filename: string;
    filePath: string;
}

interface TaskItem {
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    parsed?: ParsedLLMResult;
    grading?: ReturnType<typeof gradeStudentAnswers>;
    error?: string;
}

interface GradingTask {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed';
    createdAt: number;
    updatedAt: number;
    totalFiles: number;
    processedFiles: number;
    successCount: number;
    errorCount: number;
    items: TaskItem[];
    error?: string;
}

const tasks = new Map<string, GradingTask>();

function updateTask(task: GradingTask, updater: () => void) {
    updater();
    task.updatedAt = Date.now();
}

function scheduleTaskCleanup(taskId: string) {
    setTimeout(() => {
        tasks.delete(taskId);
    }, TASK_TTL_MS);
}

function extractJsonFromContent(content: string) {
    const candidates: string[] = [];
    const jsonMatch = content.match(/```json\s*\n([\s\S]*?)\n\s*```/);
    if (jsonMatch?.[1]) candidates.push(jsonMatch[1]);

    const codeMatch = content.match(/```\s*\n([\s\S]*?)\n\s*```/);
    if (codeMatch?.[1]) candidates.push(codeMatch[1]);

    candidates.push(content);

    const objectMatch = content.match(/\{[\s\S]*\}/);
    if (objectMatch?.[0]) candidates.push(objectMatch[0]);

    for (const candidate of candidates) {
        try {
            return JSON.parse(candidate);
        } catch {
            continue;
        }
    }

    throw new Error(`无法解析LLM返回的内容: ${content.substring(0, 500)}...`);
}

async function callDoubao(prompt: string, doubaoApiKey: string, doubaoSecretKey: string, options?: { imageBase64?: string; timeoutMs?: number }) {
    const content = options?.imageBase64
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${options.imageBase64}` } },
        ]
        : prompt;

    const response = await axios.post<LLMResponse>(
        'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
        {
            model: 'doubao-seed-2-0-lite-260215',
            max_completion_tokens: 65535,
            reasoning_effort: 'medium',
            messages: [
                {
                    role: 'user',
                    content,
                },
            ],
        },
        {
            timeout: options?.timeoutMs ?? TEXT_LLM_TIMEOUT_MS,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${doubaoApiKey}`,
                ...(doubaoSecretKey && { 'X-Secret-Key': doubaoSecretKey }),
            },
        }
    );

    return response.data.choices[0]?.message?.content || '';
}

async function callDoubaoLLMFromFile(filePath: string, doubaoApiKey: string, doubaoSecretKey: string): Promise<ParsedLLMResult | { error: string }> {
    const prompt = `你是一个智能答题卡识别助手。请从提供的答题卡图片中识别学生信息和作答内容。答题卡可能是以下两种类型：

【类型1 - 涂卡式（OMR/光学标记）】：学生通过填涂选项框（●、■）来作答
【类型2 - 手写式】：学生在空白处手写填入具体答案内容

识别规则：
- 涂卡式：识别被填涂/标记的选项框对应的字母（通常A/B/C/D/E/F中的一个）
- 手写式：识别学生手写的具体文本内容
- 填空题：识别填写的文本（数字、单词、中文等）
- 如果题目既无涂卡标记也无手写内容，视为未作答（空值）

输出格式（JSON，仅输出JSON，不要任何其他文字）：
{
  "name": "学生姓名",
  "answers": {
    "1": "A",
    "2": "B",
    "3": "具体答案文本"
  }
}

关键要求：
1. 姓名：从图片中识别清晰可见的学生姓名
2. 题号与答案必须严格一一对应
3. 选择题答案通常是单个大写字母（A-F）
4. 填空题答案是具体的文本/数字内容
5. 涂卡：识别被填涂的框，返回对应字母
6. 如无法识别，在error字段说明原因
7. 只输出JSON对象，不要包含任何markdown标记或解释`;

    try {
        const imageBuffer = await fs.promises.readFile(filePath);
        const content = await callDoubao(prompt, doubaoApiKey, doubaoSecretKey, {
            imageBase64: imageBuffer.toString('base64'),
            timeoutMs: IMAGE_LLM_TIMEOUT_MS,
        });
        const parsedResult = extractJsonFromContent(content);
        return parsedResult;
    } catch (error: unknown) {
        console.error('Error calling Doubao LLM:', error);
        if (typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as any).isAxiosError && 'response' in error) {
            const axiosError = error as any;
            return { error: `LLM API Error: ${JSON.stringify(axiosError.response?.data || {})}` };
        }
        if (error instanceof Error) {
            return { error: `LLM调用失败: ${error.message}` };
        }
        return { error: 'LLM调用失败: 未知错误' };
    }
}

function normalizeParsedStudentResult(parsedResult: any): ParsedLLMResult | { error: string } {
    let name = parsedResult?.name || '';
    let answers = parsedResult?.answers || {};

    if (!name) {
        name = parsedResult?.student_name || parsedResult?.studentName || parsedResult?.姓名 || parsedResult?.学生姓名 || '未识别';
    }

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        answers = parsedResult?.student_answers || parsedResult?.studentAnswers || parsedResult?.答案 || parsedResult?.学生答案 || {};
    }

    if (!answers || typeof answers !== 'object' || Object.keys(answers).length === 0) {
        return { error: `LLM返回结果格式不正确。原始内容: ${JSON.stringify(parsedResult)}` };
    }

    const normalizedAnswers: Record<string, string> = {};
    for (const [key, value] of Object.entries(answers)) {
        if (value !== undefined && value !== null) {
            normalizedAnswers[String(key)] = String(value).trim();
        }
    }

    return { name, answers: normalizedAnswers };
}

function snapshotTask(task: GradingTask) {
    return {
        taskId: task.id,
        status: task.status,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        totalFiles: task.totalFiles,
        processedFiles: task.processedFiles,
        successCount: task.successCount,
        errorCount: task.errorCount,
        items: task.items,
        error: task.error,
    };
}

async function processTask(task: GradingTask, files: UploadedTaskFile[], standardAnswers: Record<string, StandardAnswer>, doubaoApiKey: string, doubaoSecretKey: string) {
    updateTask(task, () => {
        task.status = 'processing';
    });

    for (let index = 0; index < files.length; index++) {
        const file = files[index];
        updateTask(task, () => {
            task.items[index].status = 'processing';
        });

        try {
            const llmResult = await callDoubaoLLMFromFile(file.filePath, doubaoApiKey, doubaoSecretKey);
            if ('error' in llmResult && llmResult.error) {
                updateTask(task, () => {
                    task.items[index].status = 'failed';
                    task.items[index].error = llmResult.error;
                    task.errorCount += 1;
                    task.processedFiles += 1;
                });
            } else {
                const normalized = normalizeParsedStudentResult(llmResult);
                if ('error' in normalized) {
                    updateTask(task, () => {
                        task.items[index].status = 'failed';
                        task.items[index].error = normalized.error;
                        task.errorCount += 1;
                        task.processedFiles += 1;
                    });
                } else {
                    const grading = gradeStudentAnswers(normalized.answers, standardAnswers);
                    updateTask(task, () => {
                        task.items[index].status = 'completed';
                        task.items[index].parsed = normalized;
                        task.items[index].grading = grading;
                        task.successCount += 1;
                        task.processedFiles += 1;
                    });
                }
            }
        } catch (error: unknown) {
            updateTask(task, () => {
                task.items[index].status = 'failed';
                task.items[index].error = error instanceof Error ? `处理文件失败: ${error.message}` : '处理文件失败: 未知错误';
                task.errorCount += 1;
                task.processedFiles += 1;
            });
        } finally {
            fs.promises.unlink(file.filePath).catch(() => undefined);
        }
    }

    updateTask(task, () => {
        task.status = task.errorCount === task.totalFiles ? 'failed' : 'completed';
        if (task.status === 'failed' && !task.error) {
            task.error = '所有文件均处理失败。';
        }
    });

    scheduleTaskCleanup(task.id);
}

app.post('/api/process', upload.array('files'), async (req, res) => {
    try {
        const files = (req.files as Express.Multer.File[]) || [];
        const doubaoApiKey = req.body.doubaoApiKey || process.env.DOUBAO_API_KEY;
        const doubaoSecretKey = req.body.doubaoSecretKey || process.env.DOUBAO_SECRET_KEY || '';

        if (!doubaoApiKey) {
            files.forEach(file => fs.promises.unlink(file.path).catch(() => undefined));
            return res.status(400).json({ message: 'Doubao API Key is required.' });
        }

        if (files.length === 0) {
            return res.status(400).json({ message: '请先上传至少一张答题卡图片。' });
        }

        let standardAnswers: Record<string, StandardAnswer> = {};
        try {
            standardAnswers = JSON.parse(req.body.standardAnswers || '{}');
        } catch {
            files.forEach(file => fs.promises.unlink(file.path).catch(() => undefined));
            return res.status(400).json({ message: '标准答案数据格式不正确。' });
        }

        const taskId = `task_${Date.now()}_${randomUUID()}`;
        const uploadedFiles = files.map(file => ({ filename: file.originalname, filePath: file.path }));
        const task: GradingTask = {
            id: taskId,
            status: 'queued',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            totalFiles: uploadedFiles.length,
            processedFiles: 0,
            successCount: 0,
            errorCount: 0,
            items: uploadedFiles.map(file => ({ filename: file.filename, status: 'pending' })),
        };

        tasks.set(taskId, task);
        void processTask(task, uploadedFiles, standardAnswers, doubaoApiKey, doubaoSecretKey);

        res.json({ taskId, status: task.status, totalFiles: task.totalFiles });
    } catch (error) {
        const uploadedFiles = (req.files as Express.Multer.File[]) || [];
        uploadedFiles.forEach(file => fs.promises.unlink(file.path).catch(() => undefined));
        const message = error instanceof Error ? error.message : '创建批阅任务失败';
        res.status(500).json({ message });
    }
});

app.get('/api/tasks/:taskId', (req, res) => {
    const task = tasks.get(req.params.taskId);
    if (!task) {
        return res.status(404).json({ message: '任务不存在或已过期。' });
    }
    res.json(snapshotTask(task));
});

app.post('/api/parse-score-config', async (req, res) => {
    const { text, doubaoApiKey, doubaoSecretKey = '' } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ message: '请输入分值描述文本。' });
    }
    if (!doubaoApiKey) {
        return res.status(400).json({ message: '请先在系统配置中设置 API Key。' });
    }

    const prompt = `你是一个考试分值解析助手。用户会用自然语言描述试题的分值分配规则，请将其解析为一个JSON对象，其中key为题号（字符串），value为该题的分值（数字）。

重要规则：
1. 必须将范围展开为每一道题。例如"1-5题每题2分"要展开为 {"1":2,"2":2,"3":2,"4":2,"5":2}
2. 只输出纯JSON对象，不要包含任何解释、注释或markdown格式
3. 题号必须是字符串，分值必须是数字（支持小数如2.5）

示例输入：1到3题每题2分，4到5题每题3.5分
示例输出：{"1":2,"2":2,"3":2,"4":3.5,"5":3.5}

用户输入：${text.trim()}`;

    try {
        const content = await callDoubao(prompt, doubaoApiKey, doubaoSecretKey, { timeoutMs: TEXT_LLM_TIMEOUT_MS });
        const scoreMap = extractJsonFromContent(content);
        if (scoreMap && typeof scoreMap === 'object') {
            const validated: { [key: string]: number } = {};
            for (const key in scoreMap) {
                const val = Number(scoreMap[key]);
                if (!isNaN(val)) {
                    validated[key] = val;
                }
            }
            return res.json({ scoreMap: validated });
        }
        return res.status(500).json({ message: '无法从LLM返回中解析分值配置，请尝试更清晰的描述。' });
    } catch (error: unknown) {
        console.error('分值解析LLM调用失败:', error);
        if (typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as any).isAxiosError && 'response' in error) {
            const axiosError = error as any;
            return res.status(500).json({ message: `LLM API Error: ${JSON.stringify(axiosError.response?.data || {})}` });
        }
        if (error instanceof Error) {
            return res.status(500).json({ message: `解析失败: ${error.message}` });
        }
        return res.status(500).json({ message: '解析失败: 未知错误' });
    }
});

app.post('/api/parse-answer-config', async (req, res) => {
    const { text, doubaoApiKey, doubaoSecretKey = '' } = req.body;

    if (!text || !text.trim()) {
        return res.status(400).json({ message: '请输入标准答案描述。' });
    }
    if (!doubaoApiKey) {
        return res.status(400).json({ message: '请先在系统配置中设置 API Key。' });
    }

    const prompt = `你是一个考试标准答案解析助手。用户会用自然语言描述一批试题的标准答案，请将其解析成一个 JSON 对象。

输出格式要求：
1. 只输出纯 JSON，不要任何解释或 markdown
2. 顶层结构必须为：{"题号":{"content":"答案","type":"single_choice或fill_in_blank","score":可选数字}}
3. 必须把范围展开成逐题结果
4. 选择题 type 固定为 single_choice，答案通常是大写字母
5. 填空题 type 固定为 fill_in_blank，答案保留文本原意
6. 如用户未提到 score，就不要输出 score 字段
7. 题号必须用字符串作为 key

示例输入：1到3题选择题答案依次为A、B、C，4到5题填空题答案为北京、上海
示例输出：{"1":{"content":"A","type":"single_choice"},"2":{"content":"B","type":"single_choice"},"3":{"content":"C","type":"single_choice"},"4":{"content":"北京","type":"fill_in_blank"},"5":{"content":"上海","type":"fill_in_blank"}}

用户输入：${text.trim()}`;

    try {
        const content = await callDoubao(prompt, doubaoApiKey, doubaoSecretKey, { timeoutMs: TEXT_LLM_TIMEOUT_MS });
        const answersMap = extractJsonFromContent(content);
        if (!answersMap || typeof answersMap !== 'object') {
            return res.status(500).json({ message: '无法从LLM返回中解析标准答案配置，请尝试更清晰的描述。' });
        }

        const validated: Record<string, ParsedAnswerConfigItem> = {};
        for (const [key, rawValue] of Object.entries(answersMap)) {
            if (!rawValue || typeof rawValue !== 'object') continue;
            const item = rawValue as Record<string, unknown>;
            const contentValue = typeof item.content === 'string' ? item.content.trim() : '';
            const typeValue = item.type === 'single_choice' || item.type === 'fill_in_blank' ? item.type : undefined;
            if (!contentValue || !typeValue) continue;

            const normalized: ParsedAnswerConfigItem = {
                content: contentValue,
                type: typeValue,
            };

            const numericScore = Number(item.score);
            if (!isNaN(numericScore)) {
                normalized.score = numericScore;
            }

            validated[String(key)] = normalized;
        }

        if (Object.keys(validated).length === 0) {
            return res.status(500).json({ message: 'LLM 未能解析出有效的标准答案配置，请尝试更清晰的描述。' });
        }

        return res.json({ answersMap: validated });
    } catch (error: unknown) {
        console.error('标准答案解析LLM调用失败:', error);
        if (typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as any).isAxiosError && 'response' in error) {
            const axiosError = error as any;
            return res.status(500).json({ message: `LLM API Error: ${JSON.stringify(axiosError.response?.data || {})}` });
        }
        if (error instanceof Error) {
            return res.status(500).json({ message: `解析失败: ${error.message}` });
        }
        return res.status(500).json({ message: '解析失败: 未知错误' });
    }
});

app.post('/api/export', (req, res) => {
    const gradingResults = req.body.gradingResults;

    if (!gradingResults || !Array.isArray(gradingResults) || gradingResults.length === 0) {
        return res.status(400).json({ message: 'No grading results provided for export.' });
    }

    let csvContent = '\ufeff';
    const headers = ['文件名', '学生姓名', '总分'];
    const questionNumbers = new Set<string>();

    gradingResults.forEach((studentResult: any) => {
        if (studentResult.grading) {
            Object.keys(studentResult.grading).forEach(qNum => questionNumbers.add(qNum));
        }
    });

    const sortedQuestionNumbers = Array.from(questionNumbers).sort((a, b) => {
        const numA = parseInt(a, 10);
        const numB = parseInt(b, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
            return numA - numB;
        }
        return a.localeCompare(b);
    });

    sortedQuestionNumbers.forEach(qNum => {
        headers.push(`题号${qNum}-得分`);
        headers.push(`题号${qNum}-是否正确`);
        headers.push(`题号${qNum}-学生答案`);
        headers.push(`题号${qNum}-标准答案`);
    });

    csvContent += headers.join(',') + '\n';

    gradingResults.forEach((studentResult: any) => {
        if (studentResult.error) {
            csvContent += `${studentResult.filename},"","",${studentResult.error}\n`;
            return;
        }

        const row: (string | number)[] = [];
        row.push(studentResult.filename);
        row.push(studentResult.parsed?.name || '');

        let totalScore = 0;
        if (studentResult.grading) {
            for (const qNum in studentResult.grading) {
                totalScore += studentResult.grading[qNum].score;
            }
        }
        row.push(totalScore);

        sortedQuestionNumbers.forEach(qNum => {
            const grade = studentResult.grading ? studentResult.grading[qNum] : undefined;
            row.push(grade ? grade.score : 0);
            row.push(grade ? (grade.isCorrect ? '是' : '否') : '否');
            row.push(grade && grade.studentAnswer ? `"${grade.studentAnswer.replace(/"/g, '""')}"` : '');
            row.push(grade && grade.standardAnswer ? `"${grade.standardAnswer.replace(/"/g, '""')}"` : '');
        });
        csvContent += row.join(',') + '\n';
    });

    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.attachment('成绩报告.csv');
    res.send(csvContent);
});

export interface StartServerOptions {
    port?: number;
    openBrowser?: boolean;
}

export function startServer(options: StartServerOptions = {}) {
    if (server) {
        return server;
    }

    const port = options.port ?? DEFAULT_PORT;
    server = app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
        if (options.openBrowser ?? process.env.OPEN_BROWSER !== 'false') {
            openBrowser(`http://localhost:${port}`);
        }
    });

    return server;
}

export function stopServer() {
    if (!server) {
        return Promise.resolve();
    }

    return new Promise<void>((resolve, reject) => {
        server?.close((error?: Error) => {
            if (error) {
                reject(error);
                return;
            }
            server = null;
            resolve();
        });
    });
}

if (require.main === module) {
    startServer();
}
