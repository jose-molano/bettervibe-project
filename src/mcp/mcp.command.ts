import { Command, CommandRunner } from 'nest-commander';
import { MCPService } from './mcp.service';

@Command({
  name: 'mcp',
  description: 'Run paperclaw as an MCP stdio server (for agents like Claude Code).',
})
export class MCPCommand extends CommandRunner {
  constructor(private readonly mcp: MCPService) {
    super();
  }

  async run(): Promise<void> {
    await this.mcp.start();
    // McpServer keeps the stdio transport alive; the process exits when the
    // client closes stdin.
  }
}
