import { z } from 'zod';
import type { ZodRawShape, objectOutputType, ZodTypeAny } from 'zod';

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
  handler: (
    client: McpClient,
    args: objectOutputType<Shape, ZodTypeAny>,
  ) => Promise<ToolResult>;
}

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
    },
    handler: (client, args) => {
      if (!args.html_body && !args.text_body) {
        return Promise.resolve(
          fail('MissingBody', 'Provide html_body and/or text_body (or use send_email_with_template).'),
        );
      }
      return unwrap(client.emails.send(args));
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
    },
    handler: (client, args) => unwrap(client.emails.sendWithTemplate(args)),
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
    handler: (client, args) => unwrap(client.emails.list(args)),
  }),

  defineTool({
    name: 'get_email',
    description: 'Retrieve one message by id, including its SMTP delivery attempts.',
    inputSchema: {
      id: z.number().int().positive().describe('Numeric message id'),
    },
    handler: (client, args) => unwrap(client.emails.get(args.id)),
  }),

  defineTool({
    name: 'list_templates',
    description: 'List all stored message templates of the CamelMailer server.',
    inputSchema: {},
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
    handler: (client, args) => unwrap(client.templates.render(args.template, args.template_model ?? {})),
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
    handler: (client, args) => unwrap(client.dmarc.summary(args)),
  }),
];
