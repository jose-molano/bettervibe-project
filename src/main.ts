#!/usr/bin/env node
import { CommandFactory } from 'nest-commander';
import { AppModule } from './app.module';

async function bootstrap() {
  // MCP speaks JSON-RPC over stdout; any NestJS log to stdout would corrupt it.
  const isMcp = process.argv.includes('mcp');
  await CommandFactory.run(AppModule, {
    logger: isMcp ? false : ['error', 'warn', 'log'],
  });
}

bootstrap();
