import { Injectable } from '@nestjs/common';
import { AssignmentDocument } from '../assignments/schemas/assignment.schema';
import { SubmissionDocument } from './schemas/submission.schema';
import { AiReviewConfigService } from './ai-review-config.service';

@Injectable()
export class DoubaoAiReviewService {
  constructor(private readonly configService: AiReviewConfigService) {}

  async review(submission: SubmissionDocument, assignment: AssignmentDocument) {
    const apiKey = this.configService.doubaoApiKey;
    if (!apiKey) {
      return {
        success: false,
        error: '未配置 DOUBAO_API_KEY',
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
              '你是作业批改助手。请返回 JSON，格式为 {"score": number, "review": string, "highlights": string[] }。score 取 0-100。',
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
        error: `Doubao 请求失败: ${response.status} ${errorText}`,
      };
    }

    const data = (await response.json()) as any;
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return {
        success: false,
        error: 'Doubao 返回内容为空',
      };
    }

    const parsed = this.extractJson(content);
    if (!parsed) {
      return {
        success: false,
        error: 'Doubao 返回格式无法解析',
        rawContent: content,
      };
    }

    return {
      success: true,
      score: Number(parsed.score ?? 0),
      review: String(parsed.review ?? ''),
      highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
      rawContent: content,
      usage: data?.usage,
      model: data?.model || this.configService.doubaoModel,
    };
  }

  private buildPrompt(submission: SubmissionDocument, assignment: AssignmentDocument) {
    return [
      `作业标题：${assignment.title}`,
      `作业描述：${assignment.description}`,
      `评分说明：${assignment.gradingNotes || '无'}`,
      `题目材料：${JSON.stringify(assignment.questionMaterial || {}, null, 2)}`,
      `参考答案：${JSON.stringify(assignment.referenceAnswer || {}, null, 2)}`,
      `AI规则：${JSON.stringify(assignment.aiRule || {}, null, 2)}`,
      `学生答案：${submission.content}`,
    ].join('\n\n');
  }

  private extractJson(content: string) {
    try {
      return JSON.parse(content);
    } catch {
      const match = content.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
  }
}
