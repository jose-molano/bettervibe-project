import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { AgentService } from './agent.service';
import { AgentCommand } from './agent.command';

@Module({
  imports: [LibraryModule],
  providers: [AgentService, AgentCommand],
})
export class AgentModule {}
