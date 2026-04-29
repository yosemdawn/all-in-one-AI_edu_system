
interface StandardAnswer {
    content: string;
    type: 'single_choice' | 'fill_in_blank';
    score?: number; // 可选字段：前端录入的每题分值，未设置时由后端 defaultScoreConfig 兜底
}

interface StudentAnswer {
    [questionNumber: string]: string;
}

interface GradingResult {
    questionType: 'single_choice' | 'fill_in_blank';
    standardAnswer: string;
    studentAnswer: string | null;
    isCorrect: boolean;
    score: number;
}

interface QuestionScoreConfig {
    [questionNumber: string]: number; // e.g., { '1': 3, '2': 3, '16': 1 }
}

// Default score configuration
// 1~20题：每题1分
// 21~40题：每题2.5分
// 41~55题：每题1分
// 56~65题：每题1.5分
// 66~75题：每题1分
const defaultScoreConfig: QuestionScoreConfig = {};
for (let i = 1; i <= 20; i++) {
    defaultScoreConfig[String(i)] = 1;
}
for (let i = 21; i <= 40; i++) {
    defaultScoreConfig[String(i)] = 2.5;
}
for (let i = 41; i <= 55; i++) {
    defaultScoreConfig[String(i)] = 1;
}
for (let i = 56; i <= 65; i++) {
    defaultScoreConfig[String(i)] = 1.5;
}
for (let i = 66; i <= 75; i++) {
    defaultScoreConfig[String(i)] = 1;
}

export function gradeStudentAnswers(
    studentAnswers: StudentAnswer,
    standardAnswers: { [qNum: string]: StandardAnswer },
    scoreConfig: QuestionScoreConfig = defaultScoreConfig
): { [qNum: string]: GradingResult } {
    const detailedGrading: { [qNum: string]: GradingResult } = {};

    for (const qNum in standardAnswers) {
        const stdAns = standardAnswers[qNum];
        const stuAns = studentAnswers[qNum] ? studentAnswers[qNum].trim() : null;
        let isCorrect = false;
        let score = 0;

        if (stuAns !== null && stuAns !== '') {
            if (stdAns.type === 'single_choice') {
                // Strict case-sensitive match for single choice
                isCorrect = (stuAns === stdAns.content);
            } else if (stdAns.type === 'fill_in_blank') {
                // Strict matching for fill-in-the-blank: exact case match, only space differences allowed
                const studentAns = stuAns.replace(/\s+/g, ' ').trim();
                const standardAns = stdAns.content.replace(/\s+/g, ' ').trim();

                // Exact match (case sensitive, but allow space normalization)
                isCorrect = (studentAns === standardAns);
            }
        }

        if (isCorrect) {
            // 优先使用标准答案中携带的 score 字段（前端录入），否则回退到 scoreConfig（默认配置）
            if (stdAns.score !== undefined) {
                score = stdAns.score;
            } else {
                score = scoreConfig[qNum] || 0;
            }
        }

        detailedGrading[qNum] = {
            questionType: stdAns.type,
            standardAnswer: stdAns.content,
            studentAnswer: stuAns,
            isCorrect: isCorrect,
            score: score,
        };
    }
    return detailedGrading;
}


