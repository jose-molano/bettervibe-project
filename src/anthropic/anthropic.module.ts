import { Module } from '@nestjs/common';
import { ANTHROPIC_CLIENT, anthropicProvider } from './anthropic.provider';

@Module({
  providers: [anthropicProvider],
  exports: [ANTHROPIC_CLIENT],
})
export class AnthropicModule {}
