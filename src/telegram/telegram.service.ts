import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentService } from '../agent/agent.service';

interface TgMessage {
  chat: { id: number };
  text?: string;
}

interface TgUpdate {
  update_id: number;
  message?: TgMessage;
}

interface TgGetUpdatesResponse {
  ok: boolean;
  result?: TgUpdate[];
  description?: string;
}

const POLL_TIMEOUT_SEC = 25;
const TG_MAX_TEXT = 4000;

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private offset = 0;
  private stopped = false;

  constructor(
    private readonly config: ConfigService,
    private readonly agent: AgentService,
  ) {}

  async start(): Promise<void> {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN is required (set it in .env).');
    }
    const apiBase = `https://api.telegram.org/bot${token}`;
    this.logger.log('Telegram bot started. Press Ctrl+C to stop.');

    while (!this.stopped) {
      let updates: TgUpdate[] = [];
      try {
        updates = await this.getUpdates(apiBase);
      } catch (err) {
        this.logger.warn(`getUpdates failed: ${(err as Error).message}. Retrying in 2s.`);
        await sleep(2000);
        continue;
      }
      for (const update of updates) {
        this.offset = Math.max(this.offset, update.update_id + 1);
        const message = update.message;
        if (!message?.text) continue;
        await this.handleMessage(apiBase, message);
      }
    }
  }

  stop(): void {
    this.stopped = true;
  }

  private async handleMessage(apiBase: string, message: TgMessage): Promise<void> {
    const chatId = message.chat.id;
    const text = (message.text ?? '').trim();
    if (!text) return;
    this.logger.log(`[${chatId}] ${text}`);
    try {
      let buffer = '';
      await this.agent.ask(text, (chunk) => {
        buffer += chunk;
      });
      const reply = buffer.trim() || '(no answer)';
      await this.sendMessage(apiBase, chatId, reply);
    } catch (err) {
      const msg = (err as Error).message;
      this.logger.error(`agent.ask failed: ${msg}`);
      await this.sendMessage(apiBase, chatId, `Error: ${msg}`).catch(() => {});
    }
  }

  private async getUpdates(apiBase: string): Promise<TgUpdate[]> {
    const url = `${apiBase}/getUpdates?offset=${this.offset}&timeout=${POLL_TIMEOUT_SEC}`;
    const res = await fetch(url);
    const data = (await res.json()) as TgGetUpdatesResponse;
    if (!data.ok) {
      throw new Error(data.description ?? `HTTP ${res.status}`);
    }
    return data.result ?? [];
  }

  private async sendMessage(apiBase: string, chatId: number, text: string): Promise<void> {
    const chunks = chunkText(text, TG_MAX_TEXT);
    for (const chunk of chunks) {
      const res = await fetch(`${apiBase}/sendMessage`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: chunk }),
      });
      if (!res.ok) {
        throw new Error(`sendMessage HTTP ${res.status}`);
      }
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function chunkText(text: string, size: number): string[] {
  if (text.length <= size) return [text];
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) {
    out.push(text.slice(i, i + size));
  }
  return out;
}
