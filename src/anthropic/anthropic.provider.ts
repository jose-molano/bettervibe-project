import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

export const ANTHROPIC_CLIENT = Symbol('ANTHROPIC_CLIENT');

export const anthropicProvider = {
  provide: ANTHROPIC_CLIENT,
  inject: [ConfigService],
  useFactory: (config: ConfigService): Anthropic => {
    // Anthropic SDK falls back to process.env.ANTHROPIC_API_KEY on its own.
    // We don't fail-fast here so `paperclaw --help` works without an API key.
    const apiKey = config.get<string>('ANTHROPIC_API_KEY') ?? process.env.ANTHROPIC_API_KEY;
    return new Anthropic({ apiKey });
  },
};
