import {
  DEFAULT_DOUBAO_ENDPOINT,
  DEFAULT_DOUBAO_MODEL,
  resolveDoubaoEndpoint,
  resolveDoubaoModel,
} from './doubao-models';

describe('doubao model configuration', () => {
  it('uses the Turbo model ID as the default', () => {
    expect(resolveDoubaoModel(undefined)).toBe(DEFAULT_DOUBAO_MODEL);
    expect(resolveDoubaoModel('   ')).toBe(DEFAULT_DOUBAO_MODEL);
  });

  it('accepts a custom compatible model ID', () => {
    expect(resolveDoubaoModel(' custom-provider-model ')).toBe(
      'custom-provider-model',
    );
  });

  it('accepts a base URL and appends the chat completions path', () => {
    expect(resolveDoubaoEndpoint('https://example.com/v1/')).toBe(
      'https://example.com/v1/chat/completions',
    );
  });

  it('keeps a complete endpoint and preserves its query string', () => {
    expect(
      resolveDoubaoEndpoint(
        'https://example.com/v1/chat/completions?api-version=2026-06-28',
      ),
    ).toBe(
      'https://example.com/v1/chat/completions?api-version=2026-06-28',
    );
  });

  it('falls back for invalid or unsupported URLs', () => {
    expect(resolveDoubaoEndpoint('not-a-url')).toBe(DEFAULT_DOUBAO_ENDPOINT);
    expect(resolveDoubaoEndpoint('file:///tmp/model')).toBe(
      DEFAULT_DOUBAO_ENDPOINT,
    );
  });
});
