import { Module } from '@nestjs/common';
import { LibraryModule } from '../library/library.module';
import { SearchModule } from '../search/search.module';
import { MCPCommand } from './mcp.command';
import { MCPService } from './mcp.service';

@Module({
  imports: [LibraryModule, SearchModule],
  providers: [MCPService, MCPCommand],
})
export class MCPModule {}
