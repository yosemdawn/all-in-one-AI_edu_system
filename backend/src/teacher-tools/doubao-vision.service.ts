import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { readFile } from 'fs/promises';
import { Model } from 'mongoose';
import { AiModel, AiModelDocument } from '../admin/schemas/ai-model.schema';
import {
  StandardAnswerMap,
  QuestionScoreConfig,
} from './objective-grading.service';

type VisionImage = {
  path: string;
  mimeType: string;
};

type ChatResult<T> = {
  data: T;
  rawContent: string;
  usage?: Record<string, unknown>;
  model?: string;
};

@Injectable()
export class DoubaoVisionService {
  constructor(
    private readonly configService: ConfigService,
    @InjectModel(AiModel.name)
    private readonly aiModelModel: Model<AiModelDocument>,
  ) {}

  async parseStandardAnswers(text: string) {
    return this.callJson<StandardAnswerMap>(
      [
        {
          role: 'system',
          content:
            'Return JSON only. Convert the teacher answer-key text into an object keyed by question number. Each value must be {"content": string, "type": "single_choice"|"fill_in_blank", "score"?: number}.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      { timeoutMs: 45_000 },
    );
  }

  async parseScoreConfig(text: string) {
    return this.callJson<QuestionScoreConfig>(
      [
        {
          role: 'system',
          content:
            'Return JSON only. Convert the scoring rule into an object keyed by question number with numeric score values. Example: {"1":1,"2":1,"21":2.5}.',
        },
        {
          role: 'user',
          content: text,
        },
      ],
      { timeoutMs: 45_000 },
    );
  }

  async recognizeAnswerCard(image: VisionImage) {
    const imageContent = await this.toImageContent(image);
    return this.callJson<{
      studentName?: string;
      studentNumber?: string;
      answers: Record<string, string>;
    }>(
      [
        {
          role: 'system',
          content:
            'You are an answer-card recognition assistant. Return JSON only in this shape: {"studentName": string|null, "studentNumber": string|null, "answers": {"1":"A","2":"B"}}. Recognize filled choices and handwritten fill-in answers. Use empty string for blank answers. Do not grade.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Recognize the student identity and all answers from this answer-card image.',
            },
            imageContent,
          ],
        },
      ],
      { timeoutMs: 120_000 },
    );
  }

  async previewEssayRequirements(images: VisionImage[], text?: string) {
    const imageContents = await Promise.all(
      images.map((image) => this.toImageContent(image)),
    );
    return this.callJson<{ requirements: string }>(
      [
        {
          role: 'system',
          content:
            'Return JSON only in this shape: {"requirements": string}. Extract the complete essay prompt/requirements from the provided text and images.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                text?.trim() ||
                'Extract the essay requirements from the uploaded image(s).',
            },
            ...imageContents,
          ],
        },
      ],
      { timeoutMs: 90_000 },
    );
  }

  async reviewEssay(input: {
    requirementsText: string;
    requirementImages: VisionImage[];
    essayImage: VisionImage;
  }) {
    const requirementImageContents = await Promise.all(
      input.requirementImages.map((image) => this.toImageContent(image)),
    );
    const essayImageContent = await this.toImageContent(input.essayImage);

    return this.callJson<{
      studentName?: string;
      studentNumber?: string;
      essayText: string;
      score: number;
      strengths: string;
      weaknesses: string;
      suggestions: Array<{
        original_sentence?: string;
        revised_sentence?: string;
        reason?: string;
      }>;
      summary_comment: string;
    }>(
      [
        {
          role: 'system',
          content:
            'You are a senior English writing teacher. Return JSON only. The shape must be {"studentName": string|null, "studentNumber": string|null, "essayText": string, "score": number, "strengths": string, "weaknesses": string, "suggestions": [{"original_sentence": string, "revised_sentence": string, "reason": string}], "summary_comment": string}. score must be 0-100.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: [
                'Grade the essay image. First read the essay requirements, then read the student essay, then provide structured feedback.',
                `Essay requirements text: ${input.requirementsText || 'See requirement image(s), if any.'}`,
                'If spelling mistakes exist, put spelling feedback first in suggestions.',
              ].join('\n'),
            },
            ...requirementImageContents,
            essayImageContent,
          ],
        },
      ],
      { timeoutMs: 120_000 },
    );
  }

  private async callJson<T>(
    messages: Array<Record<string, unknown>>,
    options: { timeoutMs: number },
  ): Promise<ChatResult<T>> {
    const config = await this.resolveModelConfig();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          temperature: 0.2,
          max_completion_tokens: 8192,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text();
        throw new ServiceUnavailableException(
          `Doubao request failed: ${response.status} ${this.redact(body)}`,
        );
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const content = this.extractContent(payload);
      if (!content) {
        throw new ServiceUnavailableException('Doubao response is empty');
      }

      return {
        data: this.extractJson<T>(content),
        rawContent: content,
        usage: this.readRecord(payload, 'usage'),
        model: this.readString(payload, 'model') || config.model,
      };
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ServiceUnavailableException('Doubao request timed out');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async resolveModelConfig() {
    const model = await this.aiModelModel.findOne({ code: 'doubao' }).lean();
    const apiKey =
      model?.apiKey || this.configService.get<string>('DOUBAO_API_KEY') || '';

    if (!apiKey) {
      throw new ServiceUnavailableException('Doubao API key is not configured');
    }

    const rawBaseUrl =
      model?.baseUrl ||
      this.configService.get<string>('DOUBAO_BASE_URL') ||
      'https://ark.cn-beijing.volces.com/api/v3';

    return {
      apiKey,
      baseUrl: rawBaseUrl.replace(/\/$/, ''),
      model:
        model?.modelName ||
        this.configService.get<string>('DOUBAO_MODEL') ||
        'doubao-seed-2-0-lite-260215',
    };
  }

  private async toImageContent(image: VisionImage) {
    const buffer = await readFile(image.path);
    if (!buffer.length) {
      throw new BadRequestException('Uploaded image is empty');
    }

    return {
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType || 'image/jpeg'};base64,${buffer.toString('base64')}`,
      },
    };
  }

  private extractContent(payload: Record<string, unknown>) {
    const choices = payload.choices;
    if (!Array.isArray(choices)) {
      return '';
    }
    const firstChoice = choices[0] as Record<string, unknown> | undefined;
    const message = firstChoice?.message as Record<string, unknown> | undefined;
    return typeof message?.content === 'string' ? message.content : '';
  }

  private extractJson<T>(content: string): T {
    const candidates = [
      content,
      content.match(/```json\s*([\s\S]*?)```/)?.[1],
      content.match(/```\s*([\s\S]*?)```/)?.[1],
      content.match(/\{[\s\S]*\}/)?.[0],
    ].filter((item): item is string => !!item);

    for (const candidate of candidates) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        continue;
      }
    }

    throw new ServiceUnavailableException('Doubao response JSON parse failed');
  }

  private readRecord(value: unknown, key: string) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const candidate = (value as Record<string, unknown>)[key];
    return candidate && typeof candidate === 'object'
      ? (candidate as Record<string, unknown>)
      : undefined;
  }

  private readString(value: unknown, key: string) {
    if (!value || typeof value !== 'object') {
      return undefined;
    }
    const candidate = (value as Record<string, unknown>)[key];
    return typeof candidate === 'string' ? candidate : undefined;
  }

  private redact(value: string) {
    return value.replace(/[A-Za-z0-9_-]{24,}/g, '[REDACTED]');
  }
}
