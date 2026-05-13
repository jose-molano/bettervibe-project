// Expected environment variables:
//   ANTHROPIC_API_KEY  – Anthropic API key (required)
//   INBOX_PATH         – Path to the inbox folder  (default: ./inbox)
//   LIBRARY_PATH       – Path to the library folder (default: ./library)

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  exports: [ConfigModule],
})
export class AppConfigModule {}
