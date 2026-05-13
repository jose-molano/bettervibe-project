import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { AnthropicModule } from './anthropic/anthropic.module';
import { ClassifyModule } from './classify/classify.module';
import { AppConfigModule } from './config/config.module';
import { ExtractModule } from './extract/extract.module';
import { LibraryModule } from './library/library.module';
import { LogModule } from './log/log.module';

@Module({
  imports: [
    AppConfigModule,
    AnthropicModule,
    ExtractModule,
    LibraryModule,
    LogModule,
    ClassifyModule,
    AgentModule,
  ],
})
export class AppModule {}
