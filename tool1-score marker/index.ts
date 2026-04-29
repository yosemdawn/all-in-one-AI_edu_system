
import express from 'express';
import multer from 'multer';
import axios from 'axios'; 
import path from 'path';
import fs from 'fs';
import { gradeStudentAnswers } from './grader';

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../../frontend')));

// Multer configuration for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Define interface for LLM response
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

// Helper function to call Doubao LLM API
async function callDoubaoLLM(imageBuffer: Buffer, doubaoApiKey: string, doubaoSecretKey?: string): Promise<ParsedLLMResult | { error: string }> {
    const base64Image = imageBuffer.toString('base64');
    const prompt = `你是一个智能批改助手，请从我提供的答题卡图片中识别学生信息和作答内容。请严格按照以下JSON格式输出结果，不要包含任何额外信息或解释。如果无法识别，请在error字段中说明原因。\n\nJSON格式要求：\n{\n  "name": "学生的姓名",\n  "answers": {\n    "1": "第1题的答案",\n    "2": "第2题的答案",\n    "...": "..."\n  }\n}\n\n请注意：\n1. 提取的姓名应是图片中清晰可见的学生姓名。\n2. 答案应是学生在答题卡上填写的对应题号的答案。对于选择题，通常是单个大写字母；对于填空题，是具体的文本内容。\n3. 如果图片中没有找到有效的姓名或答案，请在相应的字段中留空或返回错误信息。`;

    const headers: { [key: string]: string } = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${doubaoApiKey}`,
    };

    if (doubaoSecretKey) {
        headers['X-Secret-Key'] = doubaoSecretKey;
    }

    try {
        const response = await axios.post<LLMResponse>(
            'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
            {
                model: 'Doubao-Lite-4k',
                messages: [
                    {
                        role: 'user',
                        content: [
                            { type: 'text', text: prompt },
                            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
                        ],
                    },
                ],
                max_tokens: 2000,
                temperature: 0.7,
            },
            {
                headers: headers,
            }
        );
        const content = response.data.choices[0].message.content;
        // Attempt to parse JSON, handle cases where LLM might return extra text
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch && jsonMatch[1]) {
            return JSON.parse(jsonMatch[1]);
        } else {
            return JSON.parse(content);
        }
    } catch (error: unknown) { 
        console.error('Error calling Doubao LLM:', error);
        // Check if it's an AxiosError by duck-typing
        if (typeof error === 'object' && error !== null && 'isAxiosError' in error && (error as any).isAxiosError && 'response' in error) {
            const axiosError = error as any;
            console.error('Doubao LLM API Error Response:', axiosError.response.data);
            return { error: `LLM API Error: ${JSON.stringify(axiosError.response.data)}` };
        }
        if (error instanceof Error) {
            return { error: `LLM调用失败: ${error.message}` };
        }
        return { error: 'LLM调用失败: 未知错误' };
    }
}

// POST /api/process endpoint
app.post('/api/process', upload.array('files'), async (req, res) => {
    const files = req.files as Express.Multer.File[];
    const doubaoApiKey = req.body.doubaoApiKey || process.env.DOUBAO_API_KEY;
    const doubaoSecretKey = req.body.doubaoSecretKey || process.env.DOUBAO_SECRET_KEY;

    if (!doubaoApiKey) {
        return res.status(400).json({ message: 'Doubao API Key is required.' });
    }

    const results = [];
    const standardAnswers = JSON.parse(req.body.standardAnswers || "{}");

    for (const file of files) {
        const filename = file.originalname;
        try {
            const llmResult = await callDoubaoLLM(file.buffer, doubaoApiKey, doubaoSecretKey);
            if (llmResult.error) {
                results.push({ filename, error: llmResult.error });
            } else {
                // Basic validation for LLM output structure
                const parsedResult = llmResult as ParsedLLMResult; // Type assertion
                if (parsedResult.name && parsedResult.answers) {
                    const grading = gradeStudentAnswers(parsedResult.answers, standardAnswers);
                    results.push({ filename, parsed: parsedResult, grading });
                } else {
                    results.push({ filename, error: 'LLM返回结果格式不正确，缺少姓名或答案信息。' });
                }
            }
        } catch (error: unknown) {
            console.error(`Error processing file ${filename}:`, error);
            if (error instanceof Error) {
                results.push({ filename, error: `处理文件失败: ${error.message}` });
            } else {
                results.push({ filename, error: '处理文件失败: 未知错误' });
            }
        }
    }
    res.json({ items: results });
});

// POST /api/export endpoint
app.post('/api/export', (req, res) => {
    const gradingResults = req.body.gradingResults;

    if (!gradingResults || !Array.isArray(gradingResults) || gradingResults.length === 0) {
        return res.status(400).json({ message: 'No grading results provided for export.' });
    }

    let csvContent = '\ufeff'; // UTF-8 BOM
    const headers = ['文件名', '学生姓名', '总分'];
    const questionNumbers = new Set<string>();

    // Collect all unique question numbers
    gradingResults.forEach((studentResult: any) => {
        if (studentResult.grading) {
            Object.keys(studentResult.grading).forEach(qNum => questionNumbers.add(qNum));
        }
    });

    const sortedQuestionNumbers = Array.from(questionNumbers).sort((a, b) => {
        // Try to sort numerically if possible, otherwise alphabetically
        const numA = parseInt(a);
        const numB = parseInt(b);
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
        row.push(studentResult.parsed.name || '');

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

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});


