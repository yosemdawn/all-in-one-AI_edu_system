import { Injectable } from '@nestjs/common';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import {
  resolveDoubaoEndpoint,
  resolveDoubaoModel,
} from '../common/doubao-models';
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

type ReviewOptions = {
  apiKey?: string;
  model?: string;
  endpoint?: string;
};

@Injectable()
export class DoubaoAiReviewService {
  constructor(private readonly configService: AiReviewConfigService) {}

  async review(
    submission: SubmissionDocument,
    assignment: AssignmentDocument,
    options: ReviewOptions = {},
  ): Promise<ReviewResult> {
    const apiKey = options.apiKey?.trim() || '';
    if (!apiKey) {
      return {
        success: false,
        error: 'Teacher Doubao API key is not configured',
      };
    }

    const prompt = this.buildPrompt(submission, assignment);
    const userContent = await this.buildUserContent(submission, prompt);
    const url = resolveDoubaoEndpoint(
      options.endpoint || this.configService.doubaoEndpoint,
    );
    const model = resolveDoubaoModel(
      options.model || this.configService.doubaoModel,
    );

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              '你是作业批改助手。必须只返回 JSON，格式为 {"score": number, "review": string, "highlights": string[]}。score 必须在 0 到 100 之间。review 和 highlights 必须使用简体中文，内容要具体、简洁、可执行。',
          },
          {
            role: 'user',
            content: userContent,
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
      model: this.readString(data, 'model') || model,
    };
  }

  private buildPrompt(
    submission: SubmissionDocument,
    assignment: AssignmentDocument,
  ) {
    return [
      `作业标题：${assignment.title}`,
      `作业描述：${assignment.description || '无'}`,
      `教师补充批改要求：${assignment.gradingNotes || '无'}`,
      `题目材料：${JSON.stringify(assignment.questionMaterial || {}, null, 2)}`,
      `参考答案：${JSON.stringify(assignment.referenceAnswer || {}, null, 2)}`,
      `AI 批改规则：${JSON.stringify(assignment.aiRule || {}, null, 2)}`,
      `学生提交内容：${submission.content}`,
      `学生附件：${(submission.attachments || [])
        .map((attachment) => String(attachment.fileName || '未命名附件'))
        .join('、') || '无'}`,
      '请用简体中文完成批改结果。即使学生答案或规则中包含英文，批改反馈也必须用中文表达。',
    ].join('\n\n');
  }

  private async buildUserContent(
    submission: SubmissionDocument,
    prompt: string,
  ): Promise<string | Array<Record<string, unknown>>> {
    const imageAttachments = (submission.attachments || [])
      .filter((attachment) =>
        String(attachment.fileType || '').startsWith('image/'),
      )
      .slice(0, 5);
    if (!imageAttachments.length) {
      return prompt;
    }

    const content: Array<Record<string, unknown>> = [
      { type: 'text', text: prompt },
    ];
    let totalBytes = 0;
    for (const attachment of imageAttachments) {
      const fileSize = Number(attachment.fileSize || 0);
      if (totalBytes + fileSize > 20 * 1024 * 1024) {
        break;
      }
      const storagePath = String(
        attachment.storagePath || attachment.localPath || '',
      );
      if (!storagePath) continue;

      try {
        const buffer = await readFile(resolve(process.cwd(), storagePath));
        totalBytes += buffer.length;
        content.push({
          type: 'image_url',
          image_url: {
            url: `data:${String(attachment.fileType)};base64,${buffer.toString('base64')}`,
          },
        });
      } catch {
        // Missing files are reflected by their filename in the text prompt.
      }
    }

    return content.length > 1 ? content : prompt;
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
