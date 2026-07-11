import { z } from 'zod';

import type { CamelMailerResult, Email, Pagination } from 'camelmailer';

import type { McpClient } from '../src/client.js';
import type { CamelMailerTool, ToolResult } from '../src/tools.js';
import { tools } from '../src/tools.js';

/** A successful SDK result envelope. */
export function ok<T>(data: T): Promise<CamelMailerResult<T>> {
  return Promise.resolve({ data, error: null });
}

/** A failed SDK result envelope carrying a CamelMailerError-shaped error. */
export function apiError(
  code: string,
  message: string,
  statusCode: number | null = 422,
): Promise<CamelMailerResult<never>> {
  return Promise.resolve({
    data: null,
    error: Object.assign(new Error(message), { code, statusCode }) as never,
  });
}

/** Look a tool up by name (throws when missing). */
export function getTool(name: string): CamelMailerTool {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`no such tool: ${name}`);
  return tool;
}

/**
 * Validate `args` against the tool's zod schema (like the MCP server does),
 * then invoke the handler against the fake client.
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>,
  client: Partial<McpClient>,
): Promise<ToolResult> {
  const tool = getTool(name);
  const parsed = z.object(tool.inputSchema).parse(args);
  return tool.handler(client as McpClient, parsed);
}

/** Parse the JSON payload out of a successful tool result. */
export function payload(result: ToolResult): unknown {
  if (result.isError) throw new Error(`tool failed: ${result.content[0]?.text}`);
  return JSON.parse(result.content[0]?.text ?? 'null');
}

export function pagination(overrides: Partial<Pagination> = {}): Pagination {
  return { page: 1, per_page: 30, total: 1, total_pages: 1, ...overrides };
}

export function email(overrides: Partial<Email> = {}): Email {
  return {
    id: 42,
    token: 'tok42',
    scope: 'outgoing',
    rcpt_to: 'ada@example.com',
    mail_from: 'billing@acme.com',
    subject: 'Your receipt',
    message_id: '<msg@acme.com>',
    tag: 'receipt',
    status: 'Sent',
    bounce: false,
    spam_status: null,
    spam_score: null,
    held: false,
    threat: false,
    size: 1204,
    metadata: null,
    stream_id: 1,
    bypassed: false,
    created_at: '2026-07-11T10:00:00Z',
    ...overrides,
  };
}
