import { ObjectiveGradingService } from './objective-grading.service';

describe('ObjectiveGradingService', () => {
  let service: ObjectiveGradingService;

  beforeEach(() => {
    service = new ObjectiveGradingService();
  });

  it('grades single choice and fill-in answers with configured scores', () => {
    const result = service.gradeStudentAnswers(
      {
        '1': 'a',
        '2': '  hello   world ',
        '3': '',
      },
      {
        '1': { content: 'A', type: 'single_choice', score: 2 },
        '2': { content: 'hello world', type: 'fill_in_blank' },
        '3': { content: 'C', type: 'single_choice', score: 1 },
      },
      { '2': 3 },
    );

    expect(result['1'].isCorrect).toBe(true);
    expect(result['1'].score).toBe(2);
    expect(result['2'].isCorrect).toBe(true);
    expect(result['2'].score).toBe(3);
    expect(result['3'].isCorrect).toBe(false);
    expect(result['3'].score).toBe(0);
    expect(service.calculateTotalScore(result)).toBe(5);
  });

  it('normalizes simple answer and score maps from json payloads', () => {
    expect(
      service.normalizeStandardAnswers({
        '1': 'B',
        '2': { answer: 'China', type: 'fill_in_blank', score: '4' },
      }),
    ).toEqual({
      '1': { content: 'B', type: 'single_choice' },
      '2': { content: 'China', type: 'fill_in_blank', score: 4 },
    });

    expect(service.normalizeScoreConfig({ '1': '2', '2': 3 })).toEqual({
      '1': 2,
      '2': 3,
    });
  });
});

