import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { SearchService } from './search.service';

@Module({
  imports: [LibraryModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
