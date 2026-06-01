export const DEFAULT_DOUBAO_MODEL = 'doubao-seed-2-0-lite-260428';

export const DOUBAO_MODEL_OPTIONS = [
  'doubao-seed-2-0-lite-260428',
  'doubao-seed-2-0-mini-260428',
  'doubao-seed-2-0-pro-260215',
  'doubao-seed-1-8-251228',
] as const;

export type DoubaoModelOption = (typeof DOUBAO_MODEL_OPTIONS)[number];

export function resolveDoubaoModel(
  model: string | null | undefined,
): DoubaoModelOption {
  return DOUBAO_MODEL_OPTIONS.includes(model as DoubaoModelOption)
    ? (model as DoubaoModelOption)
    : DEFAULT_DOUBAO_MODEL;
}
