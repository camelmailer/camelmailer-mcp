import { CamelMailer } from '@camelmailer/sdk';
import type {
  AddSubscriberOptions,
  CamelMailerResult,
  CampaignResponse,
  CreateCampaignOptions,
  CreateDraftCampaignOptions,
  CreateLayoutOptions,
  CreateStreamOptions,
  DeleteLayoutResponse,
  DmarcFilterOptions,
  DmarcSummaryResponse,
  GetCampaignResponse,
  GetEmailResponse,
  GetInboundResponse,
  GetStatsOptions,
  GetStatsResponse,
  ImportSubscribersResponse,
  InboundRequeueResponse,
  LayoutLogoResponse,
  LayoutResponse,
  ListBouncesOptions,
  ListBouncesResponse,
  ListCampaignsResponse,
  ListEmailsOptions,
  ListEmailsResponse,
  ListInboundOptions,
  ListInboundResponse,
  ListLayoutsResponse,
  ListLogsOptions,
  ListLogsResponse,
  ListStreamsResponse,
  ListSubscribersResponse,
  ListTagsResponse,
  ListTemplatesResponse,
  RemoveSubscriberResponse,
  RenderTemplateResponse,
  SendEmailOptions,
  SendEmailResponse,
  SendEmailWithTemplateOptions,
  SendRequestOptions,
  SendToStreamOptions,
  SendToStreamResponse,
  StreamResponse,
  SubscriberResponse,
  UpdateCampaignOptions,
  UpdateLayoutOptions,
  UpdateStreamOptions,
} from '@camelmailer/sdk';

import { VERSION } from './version.js';

/**
 * The slice of the CamelMailer SDK the MCP tools use. Tools are written
 * against this structural type so tests can substitute a plain object.
 */
export interface McpClient {
  emails: {
    send(
      options: SendEmailOptions,
      request?: SendRequestOptions,
    ): Promise<CamelMailerResult<SendEmailResponse>>;
    sendWithTemplate(
      options: SendEmailWithTemplateOptions,
      request?: SendRequestOptions,
    ): Promise<CamelMailerResult<SendEmailResponse>>;
    sendToStream(
      permalink: string,
      options: SendToStreamOptions,
    ): Promise<CamelMailerResult<SendToStreamResponse>>;
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
  streams: {
    list(): Promise<CamelMailerResult<ListStreamsResponse>>;
    create(options: CreateStreamOptions): Promise<CamelMailerResult<StreamResponse>>;
    get(permalink: string): Promise<CamelMailerResult<StreamResponse>>;
    update(
      permalink: string,
      options: UpdateStreamOptions,
    ): Promise<CamelMailerResult<StreamResponse>>;
    archive(permalink: string): Promise<CamelMailerResult<StreamResponse>>;
  };
  campaigns: {
    list(): Promise<CamelMailerResult<ListCampaignsResponse>>;
    listForStream(permalink: string): Promise<CamelMailerResult<ListCampaignsResponse>>;
    get(id: number): Promise<CamelMailerResult<GetCampaignResponse>>;
    createDraft(
      options: CreateDraftCampaignOptions,
    ): Promise<CamelMailerResult<CampaignResponse>>;
    createAndSend(
      permalink: string,
      options: CreateCampaignOptions,
    ): Promise<CamelMailerResult<CampaignResponse>>;
    update(
      id: number,
      options: UpdateCampaignOptions,
    ): Promise<CamelMailerResult<CampaignResponse>>;
    send(id: number): Promise<CamelMailerResult<CampaignResponse>>;
    cancel(id: number): Promise<CamelMailerResult<CampaignResponse>>;
  };
  subscribers: {
    list(permalink: string): Promise<CamelMailerResult<ListSubscribersResponse>>;
    add(
      permalink: string,
      options: AddSubscriberOptions,
    ): Promise<CamelMailerResult<SubscriberResponse>>;
    import(
      permalink: string,
      addresses: string[],
    ): Promise<CamelMailerResult<ImportSubscribersResponse>>;
    complaint(
      permalink: string,
      address: string,
    ): Promise<CamelMailerResult<SubscriberResponse>>;
    remove(
      permalink: string,
      address: string,
    ): Promise<CamelMailerResult<RemoveSubscriberResponse>>;
  };
  layouts: {
    list(): Promise<CamelMailerResult<ListLayoutsResponse>>;
    create(options: CreateLayoutOptions): Promise<CamelMailerResult<LayoutResponse>>;
    get(permalink: string): Promise<CamelMailerResult<LayoutResponse>>;
    update(
      permalink: string,
      options: UpdateLayoutOptions,
    ): Promise<CamelMailerResult<LayoutResponse>>;
    delete(permalink: string): Promise<CamelMailerResult<DeleteLayoutResponse>>;
    uploadLogo(
      permalink: string,
      dataUrl: string,
    ): Promise<CamelMailerResult<LayoutLogoResponse>>;
  };
  inbound: {
    list(options?: ListInboundOptions): Promise<CamelMailerResult<ListInboundResponse>>;
    get(id: number): Promise<CamelMailerResult<GetInboundResponse>>;
    retry(id: number): Promise<CamelMailerResult<InboundRequeueResponse>>;
    bypass(id: number): Promise<CamelMailerResult<InboundRequeueResponse>>;
  };
  logs: {
    list(options?: ListLogsOptions): Promise<CamelMailerResult<ListLogsResponse>>;
    tags(): Promise<CamelMailerResult<ListTagsResponse>>;
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
