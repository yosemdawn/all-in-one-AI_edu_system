import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { DoubaoAiReviewService } from './doubao-ai-review.service';
import { AiReviewConfigService } from './ai-review-config.service';

describe('AI request deadlines (local HTTP server, no external AI)', () => {
  let server: Server;
  afterEach(async () => {
    server?.closeAllConnections();
    if (server)
      await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  it.each(['headers', 'body'])(
    'aborts a stalled response %s',
    async (stage) => {
      server = createServer((_req, res) => {
        if (stage === 'body') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.write('{');
        }
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve),
      );
      const port = (server.address() as AddressInfo).port;
      const service = new DoubaoAiReviewService({
        doubaoBaseUrl: `http://127.0.0.1:${port}`,
        requestTimeoutMs: 50,
      } as AiReviewConfigService);
      const started = Date.now();
      await expect(
        service.review(
          { content: 'answer' } as never,
          { title: 'assignment' } as never,
          { apiKey: 'local-test-only' },
        ),
      ).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(1500);
    },
  );
});
