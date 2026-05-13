import { ConfigService } from '@nestjs/config';
import { AgentService } from '../agent/agent.service';
import { TelegramService } from './telegram.service';

function makeConfig(token: string | undefined): ConfigService {
  return {
    get: (key: string) => (key === 'TELEGRAM_BOT_TOKEN' ? token : undefined),
  } as unknown as ConfigService;
}

function makeAgent(reply: string): AgentService {
  return {
    ask: jest
      .fn()
      .mockImplementation(
        async (_question: string, write: (chunk: string) => void): Promise<void> => {
          write(reply);
        },
      ),
  } as unknown as AgentService;
}

describe('TelegramService', () => {
  let realFetch: typeof fetch;

  beforeEach(() => {
    realFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('refuses to start without a token', async () => {
    const svc = new TelegramService(makeConfig(undefined), makeAgent(''));
    await expect(svc.start()).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
  });

  it('processes incoming messages and sends agent answers back', async () => {
    const agent = makeAgent('Two bills are due this week.');
    const svc = new TelegramService(makeConfig('TEST-TOKEN'), agent);

    const sentBodies: Record<string, unknown>[] = [];
    let pollCount = 0;
    globalThis.fetch = jest.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('/getUpdates')) {
        pollCount += 1;
        if (pollCount === 1) {
          return new Response(
            JSON.stringify({
              ok: true,
              result: [
                {
                  update_id: 42,
                  message: { chat: { id: 1001 }, text: 'overdue?' },
                },
              ],
            }),
            { status: 200 },
          );
        }
        svc.stop();
        return new Response(JSON.stringify({ ok: true, result: [] }), { status: 200 });
      }
      if (url.includes('/sendMessage')) {
        sentBodies.push(JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>);
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      throw new Error(`unexpected url ${url}`);
    }) as unknown as typeof fetch;

    await svc.start();

    expect(agent.ask).toHaveBeenCalledTimes(1);
    expect(agent.ask).toHaveBeenCalledWith('overdue?', expect.any(Function));
    expect(sentBodies).toEqual([{ chat_id: 1001, text: 'Two bills are due this week.' }]);
  });
});
