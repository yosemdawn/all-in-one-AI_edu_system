import { Injectable } from '@nestjs/common';

export type StandardAnswer = {
  content: string;
  type: 'single_choice' | 'fill_in_blank';
  score?: number;
};

export type StandardAnswerMap = Record<string, StandardAnswer>;
export type StudentAnswerMap = Record<string, string>;
export type QuestionScoreConfig = Record<string, number>;

export type GradingResult = {
  questionType: 'single_choice' | 'fill_in_blank';
  standardAnswer: string;
  studentAnswer: string | null;
  isCorrect: boolean;
  score: number;
};

@Injectable()
export class ObjectiveGradingService {
  gradeStudentAnswers(
    studentAnswers: StudentAnswerMap,
    standardAnswers: StandardAnswerMap,
    scoreConfig: QuestionScoreConfig = {},
  ) {
    const detailedGrading: Record<string, GradingResult> = {};

    for (const qNum of Object.keys(standardAnswers).sort(this.sortQuestionId)) {
      const stdAns = standardAnswers[qNum];
      const rawStudentAnswer = studentAnswers[qNum];
      const stuAns =
        typeof rawStudentAnswer === 'string' && rawStudentAnswer.trim()
          ? rawStudentAnswer.trim()
          : null;
      let isCorrect = false;
      let score = 0;

      if (stuAns) {
        if (stdAns.type === 'single_choice') {
          isCorrect =
            stuAns.trim().toUpperCase() === stdAns.content.trim().toUpperCase();
        } else {
          isCorrect =
            this.normalizeFillBlank(stuAns) ===
            this.normalizeFillBlank(stdAns.content);
        }
      }

      if (isCorrect) {
        score = Number(stdAns.score ?? scoreConfig[qNum] ?? 0);
      }

      detailedGrading[qNum] = {
        questionType: stdAns.type,
        standardAnswer: stdAns.content,
        studentAnswer: stuAns,
        isCorrect,
        score: Number.isFinite(score) ? score : 0,
      };
    }

    return detailedGrading;
  }

  calculateTotalScore(results: Record<string, GradingResult>) {
    return Object.values(results).reduce((sum, item) => sum + item.score, 0);
  }

  normalizeStandardAnswers(value: unknown): StandardAnswerMap {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const record = value as Record<string, unknown>;
    return Object.entries(record).reduce<StandardAnswerMap>(
      (result, [questionId, rawAnswer]) => {
        if (typeof rawAnswer === 'string' || typeof rawAnswer === 'number') {
          result[questionId] = {
            content: String(rawAnswer),
            type: 'single_choice',
          };
          return result;
        }

        if (rawAnswer && typeof rawAnswer === 'object') {
          const answer = rawAnswer as Record<string, unknown>;
          const content = answer.content ?? answer.answer ?? answer.value;
          const rawType = answer.type;
          const type =
            rawType === 'fill_in_blank' ? 'fill_in_blank' : 'single_choice';
          if (content !== undefined && content !== null) {
            const score = Number(answer.score);
            result[questionId] = {
              content: String(content),
              type,
              ...(Number.isFinite(score) ? { score } : {}),
            };
          }
        }

        return result;
      },
      {},
    );
  }

  normalizeScoreConfig(value: unknown): QuestionScoreConfig {
    if (!value || typeof value !== 'object') {
      return {};
    }

    return Object.entries(value as Record<string, unknown>).reduce(
      (result, [questionId, rawScore]) => {
        const score = Number(rawScore);
        if (Number.isFinite(score)) {
          result[questionId] = score;
        }
        return result;
      },
      {} as QuestionScoreConfig,
    );
  }

  private normalizeFillBlank(value: string) {
    return value.replace(/\s+/g, ' ').trim();
  }

  private sortQuestionId(a: string, b: string) {
    const left = Number(a);
    const right = Number(b);
    if (Number.isFinite(left) && Number.isFinite(right)) {
      return left - right;
    }
    return a.localeCompare(b);
  }
}

