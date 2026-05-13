import { Module } from '@nestjs/common';
import { AgentModule } from '../agent/agent.module';
import { TelegramCommand } from './telegram.command';
import { TelegramService } from './telegram.service';

@Module({
  imports: [AgentModule],
  providers: [TelegramService, TelegramCommand],
})
export class TelegramModule {}
