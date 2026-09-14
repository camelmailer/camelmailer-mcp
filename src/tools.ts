import { z } from 'zod';
import type { ZodRawShape, objectOutputType, ZodTypeAny } from 'zod';

import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';

import type { CamelMailerResult } from '@camelmailer/sdk';

import type { McpClient } from './client.js';

/** The MCP tool result shape (`content` + optional `isError`). */
export interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/** One CamelMailer MCP tool: name, zod input shape and handler. */
export interface CamelMailerTool<Shape extends ZodRawShape = ZodRawShape> {
  name: string;
  description: string;
  inputSchema: Shape;
  /**
   * Behaviour hints for the client. `readOnlyHint` marks a tool that only
   * reads; `destructiveHint` marks one that mails people or removes data,
   * so a client can ask before running it.
   */
  annotations?: ToolAnnotations;
  handler: (
    client: McpClient,
    args: objectOutputType<Shape, ZodTypeAny>,
  ) => Promise<ToolResult>;
}

/** Hints for a tool that only reads. */
const READ_ONLY: ToolAnnotations = { readOnlyHint: true, openWorldHint: true };

/** Hints for a tool that sends mail or removes data. */
const DESTRUCTIVE: ToolAnnotations = { destructiveHint: true, openWorldHint: true };

function defineTool<Shape extends ZodRawShape>(tool: CamelMailerTool<Shape>): CamelMailerTool {
  return tool as unknown as CamelMailerTool;
}

/** A successful result: the API payload as pretty-printed JSON text. */
export function ok(data: unknown): ToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** A failed result: `isError: true` with the stable API error code. */
export function fail(code: string, message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: `${code}: ${message}` }] };
}

/** Unwrap an SDK `{ data, error }` envelope into a {@link ToolResult}. */
async function unwrap<T>(promise: Promise<CamelMailerResult<T>>): Promise<ToolResult> {
  const { data, error } = await promise;
  return error ? fail(error.code, error.message) : ok(data);
}

const pagination = {
  page: z.number().int().positive().optional().describe('Page number (1-based)'),
  per_page: z.number().int().positive().max(100).optional().describe('Results per page (max 100)'),
};

const recipients = {
  from: z
    .string()
    .describe('Sender address — must belong to a verified sending domain of the server'),
  to: z.array(z.string()).min(1).describe('Recipient email addresses'),
  cc: z.array(z.string()).optional().describe('CC recipients'),
  bcc: z.array(z.string()).optional().describe('BCC recipients'),
  reply_to: z.array(z.string()).optional().describe('Reply-To addresses'),
  tag: z.string().optional().describe('Free-form tag for filtering and stats'),
  stream: z
    .string()
    .optional()
    .describe("Message-stream permalink; defaults to the server's default stream"),
};

export const tools: CamelMailerTool[] = [
  defineTool({
    name: 'send_email',
    description:
      'Send a transactional email through CamelMailer. Provide html_body and/or ' +
      'text_body. Queues one message per recipient and returns their ids.',
    inputSchema: {
      ...recipients,
      subject: z.string().optional().describe('Message subject'),
      html_body: z.string().optional().describe('HTML body'),
      text_body: z.string().optional().describe('Plain-text body'),
      idempotency_key: z
        .string()
        .optional()
        .describe(
          'Makes the send replayable: the same key with the same body returns the ' +
            'first result instead of sending twice. Reusing it for a different body ' +
            'is refused with InvalidIdempotentRequest.',
        ),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => {
      if (!args.html_body && !args.text_body) {
        return Promise.resolve(
          fail('MissingBody', 'Provide html_body and/or text_body (or use send_email_with_template).'),
        );
      }
      const { idempotency_key: idempotencyKey, ...options } = args;
      return unwrap(client.emails.send(options, idempotencyKey ? { idempotencyKey } : undefined));
    },
  }),

  defineTool({
    name: 'send_email_with_template',
    description:
      'Render a stored CamelMailer template (Mustache-style {{ variables }}) ' +
      'against template_model and send it. Fields set directly (e.g. subject) ' +
      'override the rendered ones.',
    inputSchema: {
      ...recipients,
      template: z.string().describe('Permalink of the stored template to render'),
      template_model: z
        .record(z.unknown())
        .optional()
        .describe('Variables for the template placeholders'),
      subject: z.string().optional().describe('Override the rendered subject'),
      idempotency_key: z
        .string()
        .optional()
        .describe('See send_email; makes the send replayable.'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => {
      const { idempotency_key: idempotencyKey, ...options } = args;
      return unwrap(
        client.emails.sendWithTemplate(options, idempotencyKey ? { idempotencyKey } : undefined),
      );
    },
  }),

  defineTool({
    name: 'list_emails',
    description:
      'List messages of the CamelMailer server, newest first. Filter by scope, ' +
      'status, tag, substring query or message stream.',
    inputSchema: {
      scope: z.enum(['incoming', 'outgoing']).optional().describe('Message direction'),
      status: z.string().optional().describe('Status filter, e.g. Sent, Pending, HardFail'),
      tag: z.string().optional().describe('Tag filter'),
      query: z.string().optional().describe('Substring match on subject / addresses'),
      stream: z.string().optional().describe('Message-stream permalink'),
      ...pagination,
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.emails.list(args)),
  }),

  defineTool({
    name: 'get_email',
    description: 'Retrieve one message by id, including its SMTP delivery attempts.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric message id'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.emails.get(args.id)),
  }),

  defineTool({
    name: 'list_templates',
    description: 'List all stored message templates of the CamelMailer server.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: (client) => unwrap(client.templates.list()),
  }),

  defineTool({
    name: 'render_template',
    description:
      'Preview a stored template rendered against a variable model — returns the ' +
      'rendered subject, html_body and text_body without sending anything.',
    inputSchema: {
      template: z.string().describe('Permalink of the template'),
      template_model: z
        .record(z.unknown())
        .optional()
        .describe('Variables for the template placeholders'),
    },
    annotations: READ_ONLY,
    handler: (client, args) =>
      unwrap(client.templates.render(args.template, args.template_model ?? {})),
  }),

  defineTool({
    name: 'get_stats',
    description:
      'Message counters of the server (sent, pending, bounced, opens, clicks, …), ' +
      'optionally limited to a created_at time window.',
    inputSchema: {
      from: z.string().optional().describe('Window start, ISO 8601'),
      to: z.string().optional().describe('Window end, ISO 8601'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.stats.get(args)),
  }),

  defineTool({
    name: 'list_bounces',
    description: 'List bounced messages, filtered and paginated.',
    inputSchema: {
      status: z.string().optional().describe('Status filter'),
      tag: z.string().optional().describe('Tag filter'),
      query: z.string().optional().describe('Substring match on subject / addresses'),
      ...pagination,
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.bounces.list(args)),
  }),

  defineTool({
    name: 'dmarc_summary',
    description:
      'DMARC compliance summary over the stored aggregate reports: pass rate, ' +
      'top sending sources and disposition totals.',
    inputSchema: {
      domain: z.string().optional().describe('Limit to one domain'),
      from: z.string().optional().describe('Report window start, ISO 8601'),
      to: z.string().optional().describe('Report window end, ISO 8601'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.dmarc.summary(args)),
  }),
  // ---------------------------------------------------------- streams

  defineTool({
    name: 'list_streams',
    description:
      'List the message streams of the server. A stream is transactional or ' +
      'broadcast; broadcast streams are the ones campaigns and subscribers ' +
      'belong to.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: (client) => unwrap(client.streams.list()),
  }),

  defineTool({
    name: 'get_stream',
    description: 'Retrieve one message stream by permalink.',
    inputSchema: {
      permalink: z.string().describe('Stream permalink'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.streams.get(args.permalink)),
  }),

  defineTool({
    name: 'create_stream',
    description:
      'Create a message stream. Set permalink explicitly when you need to know ' +
      'it up front; the API derives one from the name otherwise.',
    inputSchema: {
      name: z.string().describe('Display name'),
      permalink: z.string().optional().describe('URL-safe identifier used in every later call'),
      stream_type: z
        .enum(['transactional', 'broadcast'])
        .optional()
        .describe('Defaults to transactional'),
    },
    handler: (client, args) => unwrap(client.streams.create(args)),
  }),

  defineTool({
    name: 'update_stream',
    description: 'Update a message stream. Only the given fields change.',
    inputSchema: {
      permalink: z.string().describe('Stream permalink'),
      name: z.string().optional().describe('New display name'),
      stream_type: z.enum(['transactional', 'broadcast']).optional().describe('New stream type'),
      archived: z.boolean().optional().describe('Archive or unarchive the stream'),
    },
    handler: (client, args) => {
      const { permalink, ...options } = args;
      return unwrap(client.streams.update(permalink, options));
    },
  }),

  defineTool({
    name: 'archive_stream',
    description: 'Archive a message stream. Archived streams reject new messages.',
    inputSchema: {
      permalink: z.string().describe('Stream permalink'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.streams.archive(args.permalink)),
  }),

  // -------------------------------------------------------- broadcast

  defineTool({
    name: 'send_to_stream',
    description:
      'SENDS MAIL IMMEDIATELY to every subscriber of a broadcast stream. Give ' +
      'either a subject with a body, or a template permalink. Recipients past ' +
      'the per-request cap of 1000 come back as skipped, so a larger audience ' +
      'wants a campaign.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      from: z.string().describe('Sender address on a verified sending domain'),
      subject: z.string().optional().describe('Message subject'),
      html_body: z.string().optional().describe('HTML body'),
      text_body: z.string().optional().describe('Plain-text body'),
      template: z.string().optional().describe('Stored template to render for every recipient'),
      template_model: z
        .record(z.unknown())
        .optional()
        .describe('Variables for the template placeholders'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => {
      const { permalink, ...options } = args;
      if (!options.template && !options.html_body && !options.text_body) {
        return Promise.resolve(
          fail('MissingBody', 'Provide html_body, text_body, or a template permalink.'),
        );
      }
      return unwrap(client.emails.sendToStream(permalink, options));
    },
  }),

  // -------------------------------------------------------- campaigns

  defineTool({
    name: 'list_campaigns',
    description:
      'List broadcast campaigns, newest first. Pass stream to narrow to one ' +
      'broadcast stream.',
    inputSchema: {
      stream: z.string().optional().describe('Limit to one broadcast stream'),
    },
    annotations: READ_ONLY,
    handler: (client, args) =>
      unwrap(args.stream ? client.campaigns.listForStream(args.stream) : client.campaigns.list()),
  }),

  defineTool({
    name: 'get_campaign',
    description:
      'Retrieve one campaign with its statistics: total, sent, delivered, ' +
      'failed, opened, clicked and unsubscribed.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric campaign id'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.campaigns.get(args.id)),
  }),

  defineTool({
    name: 'create_campaign_draft',
    description:
      'Write a campaign WITHOUT sending it. Leave scheduled_at unset and the ' +
      'campaign stays a draft; set it and the server sends when due. This is ' +
      'the tool to use when a campaign should be reviewed first — use ' +
      'send_campaign_now only when it should go out immediately.',
    inputSchema: {
      stream: z.string().describe('Broadcast stream to send to'),
      from: z.string().describe('Sender address on a verified sending domain'),
      name: z.string().optional().describe('Display name'),
      subject: z.string().optional().describe('Message subject'),
      html_body: z.string().optional().describe('HTML body'),
      text_body: z.string().optional().describe('Plain-text body'),
      scheduled_at: z
        .string()
        .optional()
        .describe('RFC 3339 send time; arms the campaign as scheduled'),
    },
    handler: (client, args) => unwrap(client.campaigns.createDraft(args)),
  }),

  defineTool({
    name: 'send_campaign_now',
    description:
      'CREATES A CAMPAIGN AND SENDS IT IMMEDIATELY to every subscriber of the ' +
      'stream. There is no draft to review and no schedule; the send starts ' +
      'before this returns. Use create_campaign_draft unless the mail really ' +
      'should go out now.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      name: z.string().describe('Display name'),
      from: z.string().optional().describe('Sender address on a verified sending domain'),
      subject: z.string().optional().describe('Message subject'),
      html_body: z.string().optional().describe('HTML body'),
      text_body: z.string().optional().describe('Plain-text body'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => {
      const { permalink, ...options } = args;
      return unwrap(client.campaigns.createAndSend(permalink, options));
    },
  }),

  defineTool({
    name: 'update_campaign',
    description:
      'Edit a draft or scheduled campaign. Set scheduled_at to schedule it, or ' +
      'clear_schedule to drop it back to a draft. Touching neither leaves the ' +
      'schedule standing. A campaign that is already sending cannot be edited.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric campaign id'),
      name: z.string().optional().describe('Display name'),
      from: z.string().optional().describe('Sender address'),
      subject: z.string().optional().describe('Message subject'),
      html_body: z.string().optional().describe('HTML body'),
      text_body: z.string().optional().describe('Plain-text body'),
      scheduled_at: z.string().optional().describe('RFC 3339 send time'),
      clear_schedule: z
        .boolean()
        .optional()
        .describe('Clear the schedule, returning the campaign to a draft'),
    },
    handler: (client, args) => {
      const { id, clear_schedule: clearSchedule, scheduled_at: scheduledAt, ...rest } = args;
      // An omitted field leaves the schedule standing; only an explicit
      // null clears it.
      const schedule = clearSchedule
        ? { scheduled_at: null }
        : scheduledAt !== undefined
          ? { scheduled_at: scheduledAt }
          : {};
      return unwrap(client.campaigns.update(id, { ...rest, ...schedule }));
    },
  }),

  defineTool({
    name: 'send_campaign',
    description:
      'SENDS AN EXISTING CAMPAIGN NOW, whatever its schedule said. The send ' +
      'starts immediately and cannot be undone for messages already queued.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric campaign id'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.campaigns.send(args.id)),
  }),

  defineTool({
    name: 'cancel_campaign',
    description:
      'Cancel a scheduled or in-flight campaign. Messages already queued are ' +
      'not recalled.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric campaign id'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.campaigns.cancel(args.id)),
  }),

  // ------------------------------------------------------ subscribers

  defineTool({
    name: 'list_subscribers',
    description:
      "List a broadcast stream's subscribers, subscribed and unsubscribed " +
      'alike. A broadcast send to an address that is not subscribed is refused, ' +
      'so this list is the audience.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.subscribers.list(args.permalink)),
  }),

  defineTool({
    name: 'add_subscriber',
    description:
      'Add or update one subscriber of a broadcast stream. Upserts by address, ' +
      'so calling it twice is safe.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      address: z.string().describe('Email address'),
      status: z
        .enum(['subscribed', 'unsubscribed'])
        .optional()
        .describe('Defaults to subscribed'),
    },
    handler: (client, args) => {
      const { permalink, ...options } = args;
      return unwrap(client.subscribers.add(permalink, options));
    },
  }),

  defineTool({
    name: 'import_subscribers',
    description:
      'Add many addresses to a broadcast stream at once, all as subscribed. ' +
      'Blanks and duplicates within the request are skipped, so the reported ' +
      'count can be lower than the number of addresses passed.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      addresses: z.array(z.string()).min(1).describe('Email addresses to subscribe'),
    },
    handler: (client, args) => unwrap(client.subscribers.import(args.permalink, args.addresses)),
  }),

  defineTool({
    name: 'record_complaint',
    description:
      'Record a spam complaint against an address: writes a stream-scoped ' +
      'suppression and flips the subscription to unsubscribed. Idempotent, so ' +
      'a feedback loop can replay it safely.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      address: z.string().describe('The complaining address'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.subscribers.complaint(args.permalink, args.address)),
  }),

  defineTool({
    name: 'remove_subscriber',
    description:
      'Remove a subscriber from a broadcast stream entirely. To stop mailing ' +
      'someone while keeping the record, set their status to unsubscribed with ' +
      'add_subscriber instead.',
    inputSchema: {
      permalink: z.string().describe('Broadcast stream permalink'),
      address: z.string().describe('Email address to remove'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.subscribers.remove(args.permalink, args.address)),
  }),

  // ---------------------------------------------------------- layouts

  defineTool({
    name: 'list_layouts',
    description:
      'List the template layouts of the server. A layout wraps every template ' +
      'that uses it, so header, footer and styling live in one place.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: (client) => unwrap(client.layouts.list()),
  }),

  defineTool({
    name: 'get_layout',
    description: 'Retrieve one layout by permalink, including its wrappers.',
    inputSchema: {
      permalink: z.string().describe('Layout permalink'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.layouts.get(args.permalink)),
  }),

  defineTool({
    name: 'create_layout',
    description:
      'Create a template layout. html_wrapper has to embed the body with ' +
      '{{{ content }}}; anything else is refused with ValidationError.',
    inputSchema: {
      name: z.string().describe('Display name'),
      permalink: z.string().optional().describe('URL-safe identifier'),
      html_wrapper: z.string().describe('HTML wrapper embedding {{{ content }}}'),
      text_wrapper: z.string().optional().describe('Plain-text wrapper'),
    },
    handler: (client, args) => unwrap(client.layouts.create(args)),
  }),

  defineTool({
    name: 'update_layout',
    description: 'Update a layout. Only the given fields change.',
    inputSchema: {
      permalink: z.string().describe('Layout permalink'),
      name: z.string().optional().describe('Display name'),
      html_wrapper: z.string().optional().describe('HTML wrapper embedding {{{ content }}}'),
      text_wrapper: z.string().optional().describe('Plain-text wrapper'),
    },
    handler: (client, args) => {
      const { permalink, ...options } = args;
      return unwrap(client.layouts.update(permalink, options));
    },
  }),

  defineTool({
    name: 'delete_layout',
    description:
      'Delete a layout. Templates that referenced it fall back to no wrapper.',
    inputSchema: {
      permalink: z.string().describe('Layout permalink'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.layouts.delete(args.permalink)),
  }),

  // ---------------------------------------------------------- inbound

  defineTool({
    name: 'list_inbound',
    description:
      'List inbound and held messages, newest first. Covers mail arriving ' +
      'through an inbound route as well as outbound mail the spam filter put ' +
      'on hold.',
    inputSchema: {
      status: z.string().optional().describe('Status filter, e.g. held'),
      stream: z.string().optional().describe('Message-stream permalink'),
      query: z.string().optional().describe('Substring match on subject / addresses'),
      ...pagination,
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.inbound.list(args)),
  }),

  defineTool({
    name: 'get_inbound',
    description: 'Retrieve one inbound or held message by id.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric message id'),
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.inbound.get(args.id)),
  }),

  defineTool({
    name: 'retry_inbound',
    description:
      'Put an inbound message back on the delivery queue, for instance after ' +
      'fixing the route it should have matched.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric message id'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.inbound.retry(args.id)),
  }),

  defineTool({
    name: 'bypass_inbound',
    description:
      'RELEASE A HELD MESSAGE past the hold and deliver it. The hold is what ' +
      'the spam filter put there, so check the message before releasing it.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric message id'),
    },
    annotations: DESTRUCTIVE,
    handler: (client, args) => unwrap(client.inbound.bypass(args.id)),
  }),

  // ------------------------------------------------------------- logs

  defineTool({
    name: 'list_api_requests',
    description:
      "List the server's own logged API requests, newest first. Useful when a " +
      'send did not arrive and the question is whether the request ever reached ' +
      'the API, and with what answer.',
    inputSchema: {
      method: z.string().optional().describe('Exact HTTP method'),
      status: z.string().optional().describe('Status class: 2xx, 3xx, 4xx or 5xx'),
      from: z.string().optional().describe('Window start, RFC 3339'),
      to: z.string().optional().describe('Window end, RFC 3339'),
      ...pagination,
    },
    annotations: READ_ONLY,
    handler: (client, args) => unwrap(client.logs.list(args)),
  }),

  defineTool({
    name: 'list_tags',
    description:
      "Tags used by the server's recent messages, most used first — the " +
      'vocabulary available to the tag filter of list_emails.',
    inputSchema: {},
    annotations: READ_ONLY,
    handler: (client) => unwrap(client.logs.tags()),
  }),
];
