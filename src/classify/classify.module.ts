import { Module } from '@nestjs/common';
import { AnthropicModule } from '../anthropic/anthropic.module';
import { ExtractModule } from '../extract/extract.module';
import { LibraryModule } from '../library/library.module';
import { LogModule } from '../log/log.module';
import { ClassifyCommand } from './classify.command';
import { ClassifyService } from './classify.service';

@Module({
  imports: [AnthropicModule, ExtractModule, LibraryModule, LogModule],
  providers: [ClassifyService, ClassifyCommand],
})
export class ClassifyModule {}
