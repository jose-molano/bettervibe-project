import { Command, CommandRunner } from 'nest-commander';
import { TelegramService } from './telegram.service';

@Command({
  name: 'telegram',
  description: 'Run paperclaw as a Telegram bot. Forwards messages to the ask agent.',
})
export class TelegramCommand extends CommandRunner {
  constructor(private readonly telegram: TelegramService) {
    super();
  }

  async run(): Promise<void> {
    await this.telegram.start();
  }
}
