import { Module } from '@nestjs/common';
import { ExtractModule } from '../extract/extract.module';
import { ClassifyService } from './classify.service';
import { ClassifyCommand } from './classify.command';

@Module({
  imports: [ExtractModule],
  providers: [ClassifyService, ClassifyCommand],
})
export class ClassifyModule {}
