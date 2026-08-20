export const DEFAULT_DOUBAO_MODEL = 'doubao-seed-2-1-turbo-260628';
export const DEFAULT_DOUBAO_ENDPOINT =
  'https://ark.cn-beijing.volces.com/api/v3/chat/completions';

export function resolveDoubaoModel(
  model: string | null | undefined,
) {
  return model?.trim() || DEFAULT_DOUBAO_MODEL;
}

export function resolveDoubaoEndpoint(endpoint: string | null | undefined) {
  const rawEndpoint = endpoint?.trim() || DEFAULT_DOUBAO_ENDPOINT;
  try {
    const url = new URL(rawEndpoint);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return DEFAULT_DOUBAO_ENDPOINT;
    }

    const normalizedPath = url.pathname.replace(/\/+$/, '');
    url.pathname = normalizedPath.endsWith('/chat/completions')
      ? normalizedPath
      : `${normalizedPath}/chat/completions`;
    return url.toString();
  } catch {
    return DEFAULT_DOUBAO_ENDPOINT;
  }
}
