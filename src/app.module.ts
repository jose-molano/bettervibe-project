import { Module } from '@nestjs/common';
import { AgentModule } from './agent/agent.module';
import { AnthropicModule } from './anthropic/anthropic.module';
import { ClassifyModule } from './classify/classify.module';
import { AppConfigModule } from './config/config.module';
import { ExtractModule } from './extract/extract.module';
import { LibraryModule } from './library/library.module';
import { LogModule } from './log/log.module';
import { MCPModule } from './mcp/mcp.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [
    AppConfigModule,
    AnthropicModule,
    ExtractModule,
    LibraryModule,
    LogModule,
    SearchModule,
    ClassifyModule,
    AgentModule,
    MCPModule,
  ],
})
export class AppModule {}
