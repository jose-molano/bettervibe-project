import { Module } from '@nestjs/common';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { LibraryModule } from '../library/library.module';
import { SearchModule } from '../search/search.module';
import { AgentService } from './agent.service';
import { AgentCommand } from './agent.command';

@Module({
  imports: [AnthropicModule, LibraryModule, SearchModule],
  providers: [AgentService, AgentCommand],
})
export class AgentModule {}
