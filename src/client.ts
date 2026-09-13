import { CamelMailer } from '@camelmailer/sdk';
import type {
  CamelMailerResult,
  DmarcFilterOptions,
  DmarcSummaryResponse,
  GetEmailResponse,
  GetStatsOptions,
  GetStatsResponse,
  ListBouncesOptions,
  ListBouncesResponse,
  ListEmailsOptions,
  ListEmailsResponse,
  ListTemplatesResponse,
  RenderTemplateResponse,
  SendEmailOptions,
  SendEmailResponse,
  SendEmailWithTemplateOptions,
} from '@camelmailer/sdk';

import { VERSION } from './version.js';

/**
 * The slice of the CamelMailer SDK the MCP tools use. Tools are written
 * against this structural type so tests can substitute a plain object.
 */
export interface McpClient {
  emails: {
    send(options: SendEmailOptions): Promise<CamelMailerResult<SendEmailResponse>>;
    sendWithTemplate(
      options: SendEmailWithTemplateOptions,
    ): Promise<CamelMailerResult<SendEmailResponse>>;
    get(id: number): Promise<CamelMailerResult<GetEmailResponse>>;
    list(options?: ListEmailsOptions): Promise<CamelMailerResult<ListEmailsResponse>>;
  };
  templates: {
    list(): Promise<CamelMailerResult<ListTemplatesResponse>>;
    render(
      permalink: string,
      model?: Record<string, unknown>,
    ): Promise<CamelMailerResult<RenderTemplateResponse>>;
  };
  stats: {
    get(options?: GetStatsOptions): Promise<CamelMailerResult<GetStatsResponse>>;
  };
  bounces: {
    list(options?: ListBouncesOptions): Promise<CamelMailerResult<ListBouncesResponse>>;
  };
  dmarc: {
    summary(options?: DmarcFilterOptions): Promise<CamelMailerResult<DmarcSummaryResponse>>;
  };
}

/**
 * Build the real SDK client from `CAMELMAILER_API_KEY` /
 * `CAMELMAILER_BASE_URL` (base URL defaults to the CamelMailer cloud).
 */
export function createClientFromEnv(): McpClient {
  if (!process.env.CAMELMAILER_API_KEY) {
    throw new Error(
      'CAMELMAILER_API_KEY is not set. Add it to the `env` block of the MCP ' +
        'server configuration (see the README for a Claude Desktop example).',
    );
  }
  return new CamelMailer(undefined, { userAgent: `camelmailer-mcp:${VERSION}` });
}
