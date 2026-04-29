
interface StandardAnswer {
    content: string;
    type: 'single_choice' | 'fill_in_blank';
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

// Default score configuration (example)
const defaultScoreConfig: QuestionScoreConfig = {};
for (let i = 1; i <= 15; i++) {
    defaultScoreConfig[String(i)] = 3;
}
for (let i = 16; i <= 30; i++) {
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
                // Strict case-sensitive, full-width/half-width match for fill-in-the-blank
                isCorrect = (stuAns === stdAns.content);
            }
        }

        if (isCorrect) {
            score = scoreConfig[qNum] || 0; // Get score from config, default to 0 if not found
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


