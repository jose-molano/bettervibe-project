import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { ExtractModule } from './extract/extract.module';
import { ClassifyModule } from './classify/classify.module';
import { LibraryModule } from './library/library.module';
import { AgentModule } from './agent/agent.module';

@Module({
  imports: [AppConfigModule, ExtractModule, ClassifyModule, LibraryModule, AgentModule],
})
export class AppModule {}
