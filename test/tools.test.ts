import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import type { SendEmailResponse } from 'camelmailer';

import { apiError, callTool, email, getTool, ok, pagination, payload } from './helpers.js';
import { tools } from '../src/tools.js';

const sendResponse: SendEmailResponse = {
  message_id: 42,
  recipients: [{ rcpt_to: 'ada@example.com', message_id: 42, token: 'tok42', status: 'Pending' }],
};

describe('tool registry', () => {
  it('exposes exactly the documented tools', () => {
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'dmarc_summary',
      'get_email',
      'get_stats',
      'list_bounces',
      'list_emails',
      'list_templates',
      'render_template',
      'send_email',
      'send_email_with_template',
    ]);
  });

  it('gives every tool a description', () => {
    for (const tool of tools) {
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
    }
  });
});

describe('send_email', () => {
  it('sends and returns the queued recipients as JSON', async () => {
    const send = vi.fn(() => ok(sendResponse));
    const result = await callTool(
      'send_email',
      {
        from: 'billing@acme.com',
        to: ['ada@example.com'],
        subject: 'Hi',
        text_body: 'Hello!',
        tag: 'welcome',
      },
      { emails: { send } as never },
    );

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'billing@acme.com',
        to: ['ada@example.com'],
        text_body: 'Hello!',
        tag: 'welcome',
      }),
    );
    expect(result.isError).toBeUndefined();
    expect(payload(result)).toEqual(sendResponse);
  });

  it('rejects a send without any body', async () => {
    const result = await callTool(
      'send_email',
      { from: 'a@b.c', to: ['d@e.f'], subject: 'Hi' },
      {},
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('MissingBody');
  });

  it('requires at least one recipient (schema)', () => {
    const schema = z.object(getTool('send_email').inputSchema);
    expect(() => schema.parse({ from: 'a@b.c', to: [], text_body: 'x' })).toThrow();
  });

  it('maps API errors to isError results with the stable code', async () => {
    const send = vi.fn(() => apiError('ValidationError', 'from address not allowed'));
    const result = await callTool(
      'send_email',
      { from: 'a@b.c', to: ['d@e.f'], text_body: 'x' },
      { emails: { send } as never },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('ValidationError: from address not allowed');
  });
});

describe('send_email_with_template', () => {
  it('sends a template with its model', async () => {
    const sendWithTemplate = vi.fn(() => ok(sendResponse));
    const result = await callTool(
      'send_email_with_template',
      {
        from: 'billing@acme.com',
        to: ['ada@example.com'],
        template: 'welcome',
        template_model: { name: 'Ada' },
      },
      { emails: { sendWithTemplate } as never },
    );

    expect(sendWithTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'welcome', template_model: { name: 'Ada' } }),
    );
    expect(payload(result)).toEqual(sendResponse);
  });

  it('requires the template permalink (schema)', () => {
    const schema = z.object(getTool('send_email_with_template').inputSchema);
    expect(() => schema.parse({ from: 'a@b.c', to: ['d@e.f'] })).toThrow();
  });

  it('maps NotFound to an isError result', async () => {
    const sendWithTemplate = vi.fn(() => apiError('NotFound', 'no such template', 404));
    const result = await callTool(
      'send_email_with_template',
      { from: 'a@b.c', to: ['d@e.f'], template: 'nope' },
      { emails: { sendWithTemplate } as never },
    );
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('NotFound: no such template');
  });
});

describe('list_emails', () => {
  it('lists messages with filters passed through', async () => {
    const list = vi.fn(() => ok({ messages: [email()], pagination: pagination() }));
    const result = await callTool(
      'list_emails',
      { scope: 'outgoing', status: 'HardFail', tag: 'x', page: 2, per_page: 50 },
      { emails: { list } as never },
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'outgoing', status: 'HardFail', tag: 'x', page: 2, per_page: 50 }),
    );
    expect(payload(result)).toMatchObject({ messages: [{ id: 42 }] });
  });

  it('rejects an invalid scope (schema)', () => {
    const schema = z.object(getTool('list_emails').inputSchema);
    expect(() => schema.parse({ scope: 'sideways' })).toThrow();
  });

  it('rejects per_page above 100 (schema)', () => {
    const schema = z.object(getTool('list_emails').inputSchema);
    expect(() => schema.parse({ per_page: 101 })).toThrow();
  });
});

describe('get_email', () => {
  it('fetches one message by id', async () => {
    const get = vi.fn(() => ok({ message: email(), deliveries: [] }));
    const result = await callTool('get_email', { id: 42 }, { emails: { get } as never });

    expect(get).toHaveBeenCalledWith(42);
    expect(payload(result)).toMatchObject({ message: { id: 42 } });
  });

  it('rejects a non-integer id (schema)', () => {
    const schema = z.object(getTool('get_email').inputSchema);
    expect(() => schema.parse({ id: 'abc' })).toThrow();
    expect(() => schema.parse({ id: -1 })).toThrow();
  });

  it('maps NotFound to an isError result', async () => {
    const get = vi.fn(() => apiError('NotFound', 'no such message', 404));
    const result = await callTool('get_email', { id: 999 }, { emails: { get } as never });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('NotFound: no such message');
  });
});

describe('list_templates', () => {
  it('lists the templates', async () => {
    const list = vi.fn(() =>
      ok({
        templates: [
          {
            id: 3,
            uuid: 'uuid-3',
            name: 'Welcome',
            permalink: 'welcome',
            subject: 'Hello {{ name }}',
            html_body: null,
            text_body: 'Hi {{ name }}',
            archived: false,
          },
        ],
      }),
    );
    const result = await callTool('list_templates', {}, { templates: { list } as never });
    expect(payload(result)).toMatchObject({ templates: [{ permalink: 'welcome' }] });
  });
});

describe('render_template', () => {
  it('renders with the given model', async () => {
    const render = vi.fn(() =>
      ok({ rendered: { subject: 'Hello Ada', html_body: null, text_body: 'Hi Ada' } }),
    );
    const result = await callTool(
      'render_template',
      { template: 'welcome', template_model: { name: 'Ada' } },
      { templates: { render } as never },
    );

    expect(render).toHaveBeenCalledWith('welcome', { name: 'Ada' });
    expect(payload(result)).toMatchObject({ rendered: { subject: 'Hello Ada' } });
  });

  it('defaults to an empty model', async () => {
    const render = vi.fn(() =>
      ok({ rendered: { subject: 'Hello ', html_body: null, text_body: null } }),
    );
    await callTool('render_template', { template: 'welcome' }, { templates: { render } as never });
    expect(render).toHaveBeenCalledWith('welcome', {});
  });
});

describe('get_stats', () => {
  it('returns the counters and passes the window through', async () => {
    const stats = {
      total: 10, incoming: 1, outgoing: 9, sent: 8, pending: 1, held: 0,
      bounced: 0, soft_fail: 0, hard_fail: 0, opens: 3, clicks: 1,
      unique_opens: 2, unique_clicks: 1,
    };
    const get = vi.fn(() => ok({ stats }));
    const result = await callTool(
      'get_stats',
      { from: '2026-07-01', to: '2026-07-11' },
      { stats: { get } as never },
    );

    expect(get).toHaveBeenCalledWith(
      expect.objectContaining({ from: '2026-07-01', to: '2026-07-11' }),
    );
    expect(payload(result)).toEqual({ stats });
  });
});

describe('list_bounces', () => {
  it('lists bounces with filters', async () => {
    const list = vi.fn(() =>
      ok({ bounces: [email({ bounce: true, status: 'HardFail' })], pagination: pagination() }),
    );
    const result = await callTool(
      'list_bounces',
      { status: 'HardFail', page: 1 },
      { bounces: { list } as never },
    );

    expect(list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'HardFail', page: 1 }),
    );
    expect(payload(result)).toMatchObject({ bounces: [{ status: 'HardFail' }] });
  });

  it('maps Unauthorized to an isError result', async () => {
    const list = vi.fn(() => apiError('Unauthorized', 'invalid API key', 401));
    const result = await callTool('list_bounces', {}, { bounces: { list } as never });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('Unauthorized: invalid API key');
  });
});

describe('dmarc_summary', () => {
  it('returns the summary and passes filters through', async () => {
    const summary = {
      total: 200, pass: 180, fail: 20, pass_rate: 0.9,
      by_source: [], by_disposition: { none: 180, quarantine: 20 },
    };
    const summaryFn = vi.fn(() => ok({ summary }));
    const result = await callTool(
      'dmarc_summary',
      { domain: 'acme.com' },
      { dmarc: { summary: summaryFn } as never },
    );

    expect(summaryFn).toHaveBeenCalledWith(expect.objectContaining({ domain: 'acme.com' }));
    expect(payload(result)).toEqual({ summary });
  });

  it('maps network failures to an isError result', async () => {
    const summaryFn = vi.fn(() => apiError('NetworkError', 'Unable to reach https://x', null));
    const result = await callTool('dmarc_summary', {}, { dmarc: { summary: summaryFn } as never });
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('NetworkError');
  });
});
