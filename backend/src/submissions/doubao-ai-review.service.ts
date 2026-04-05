import { Injectable } from '@nestjs/common';
import { AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { AiReviewConfigService } from './ai-review-config.service';
import { SubmissionDocument } from './schemas/submission.schema';

type ReviewResult = {
  success: boolean;
  error?: string;
  score?: number;
  review?: string;
  highlights?: string[];
  rawContent?: string;
  usage?: Record<string, unknown>;
  model?: string;
};

@Injectable()
export class DoubaoAiReviewService {
  constructor(private readonly configService: AiReviewConfigService) {}

  async review(
    submission: SubmissionDocument,
    assignment: AssignmentDocument,
  ): Promise<ReviewResult> {
    const apiKey = this.configService.doubaoApiKey;
    if (!apiKey) {
      return {
        success: false,
        error: 'DOUBAO_API_KEY is not configured',
      };
    }

    const prompt = this.buildPrompt(submission, assignment);
    const url = `${this.configService.doubaoBaseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: this.configService.doubaoModel,
        messages: [
          {
            role: 'system',
            content:
              'You are an assignment grading assistant. Return JSON only in the shape {"score": number, "review": string, "highlights": string[]}. score must be between 0 and 100.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `Doubao request failed: ${response.status} ${errorText}`,
      };
    }

    const data: unknown = await response.json();
    const content = this.extractContent(data);
    if (!content) {
      return {
        success: false,
        error: 'Doubao response content is empty',
      };
    }

    const parsed = this.extractJson(content);
    if (!parsed) {
      return {
        success: false,
        error: 'Doubao response format could not be parsed',
        rawContent: content,
      };
    }

    return {
      success: true,
      score: this.readNumber(parsed, 'score') ?? 0,
      review: this.readString(parsed, 'review') ?? '',
      highlights: this.readStringArray(parsed, 'highlights'),
      rawContent: content,
      usage: this.readRecord(data, 'usage'),
      model: this.readString(data, 'model') || this.configService.doubaoModel,
    };
  }

  private buildPrompt(
    submission: SubmissionDocument,
    assignment: AssignmentDocument,
  ) {
    return [
      `Assignment title: ${assignment.title}`,
      `Assignment description: ${assignment.description || 'N/A'}`,
      `Grading notes: ${assignment.gradingNotes || 'N/A'}`,
      `Question material: ${JSON.stringify(assignment.questionMaterial || {}, null, 2)}`,
      `Reference answer: ${JSON.stringify(assignment.referenceAnswer || {}, null, 2)}`,
      `AI rule: ${JSON.stringify(assignment.aiRule || {}, null, 2)}`,
      `Student submission: ${submission.content}`,
    ].join('\n\n');
  }

  private extractJson(content: string) {
    try {
      return JSON.parse(content) as unknown;
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]) as unknown;
      } catch {
        return null;
      }
    }
  }

  private extractContent(value: unknown) {
    const [firstChoice] = this.readArray(value, 'choices');
    const message = this.readRecord(firstChoice, 'message');
    return this.readString(message, 'content');
  }

  private readArray(value: unknown, key: string) {
    if (!this.isRecord(value)) {
      return [];
    }

    const candidate = value[key];
    return Array.isArray(candidate) ? (candidate as unknown[]) : [];
  }

  private readRecord(value: unknown, key: string) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const candidate = value[key];
    return this.isRecord(candidate) ? candidate : undefined;
  }

  private readString(value: unknown, key: string) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const candidate = value[key];
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private readNumber(value: unknown, key: string) {
    if (!this.isRecord(value)) {
      return undefined;
    }

    const candidate = value[key];
    return typeof candidate === 'number' ? candidate : undefined;
  }

  private readStringArray(value: unknown, key: string) {
    if (!this.isRecord(value)) {
      return [];
    }

    const candidate = value[key];
    return Array.isArray(candidate)
      ? candidate.filter((item): item is string => typeof item === 'string')
      : [];
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
