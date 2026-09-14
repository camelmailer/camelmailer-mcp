import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { apiError, callTool, getTool, ok, payload } from './helpers.js';

const campaign = {
  id: 7,
  name: 'September',
  subject: 'What shipped',
  from: 'news@acme.com',
  html_body: null,
  text_body: 'Hello.',
  status: 'draft',
  total: 120,
  sent: 0,
  stream_id: 3,
  stream: { permalink: 'product-news', name: 'Product news' },
  scheduled_at: null,
  created_at: '2026-09-01T10:00:00Z',
  completed_at: null,
};

describe('campaign creation is two separate tools', () => {
  it('create_campaign_draft posts to the planning route and does not send', async () => {
    const createDraft = vi.fn(() => ok({ campaign }));
    const result = await callTool(
      'create_campaign_draft',
      { stream: 'product-news', from: 'news@acme.com', name: 'September' },
      { campaigns: { createDraft } as never },
    );

    expect(createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ stream: 'product-news', from: 'news@acme.com' }),
    );
    expect(payload(result)).toEqual({ campaign });
  });

  it('send_campaign_now uses the stream route, which sends before it returns', async () => {
    const createAndSend = vi.fn(() => ok({ campaign: { ...campaign, status: 'sending' } }));
    await callTool(
      'send_campaign_now',
      { permalink: 'product-news', name: 'Status update' },
      { campaigns: { createAndSend } as never },
    );

    expect(createAndSend).toHaveBeenCalledWith(
      'product-news',
      expect.objectContaining({ name: 'Status update' }),
    );
  });

  it("says plainly which of the two sends, so a client does not have to guess", () => {
    // A tool described as writing a draft that actually mails the whole
    // audience is the worst failure this server can have.
    expect(getTool('create_campaign_draft').description).toContain('WITHOUT sending');
    expect(getTool('send_campaign_now').description).toContain('SENDS IT IMMEDIATELY');
    expect(getTool('create_campaign_draft').annotations?.destructiveHint).toBeUndefined();
    expect(getTool('send_campaign_now').annotations?.destructiveHint).toBe(true);
  });
});

describe('update_campaign', () => {
  it('clear_schedule sends an explicit null', async () => {
    const update = vi.fn(() => ok({ campaign }));
    await callTool(
      'update_campaign',
      { id: 7, clear_schedule: true },
      { campaigns: { update } as never },
    );

    // An omitted field leaves the schedule standing.
    expect(update).toHaveBeenCalledWith(7, expect.objectContaining({ scheduled_at: null }));
  });

  it('leaves the schedule alone when neither field is given', async () => {
    let body: Record<string, unknown> | undefined;
    const update = vi.fn((_id: number, options: Record<string, unknown>) => {
      body = options;
      return ok({ campaign });
    });
    await callTool(
      'update_campaign',
      { id: 7, subject: 'Corrected' },
      { campaigns: { update } as never },
    );

    // The key has to be absent, not null: a null would clear the schedule.
    expect(body).toBeDefined();
    expect('scheduled_at' in (body ?? {})).toBe(false);
    // `clear_schedule` is a tool argument, not an API field.
    expect('clear_schedule' in (body ?? {})).toBe(false);
  });

  it('reports the API refusing to edit a sending campaign', async () => {
    const update = vi.fn(() =>
      apiError('ValidationError', 'a sent campaign can no longer be edited'),
    );
    const result = await callTool(
      'update_campaign',
      { id: 7, subject: 'Too late' },
      { campaigns: { update } as never },
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('ValidationError');
  });
});

describe('send_to_stream', () => {
  it('broadcasts and returns what was queued against what was skipped', async () => {
    const sendToStream = vi.fn(() => ok({ queued: 42, skipped: 3 }));
    const result = await callTool(
      'send_to_stream',
      { permalink: 'newsletter', from: 'news@acme.com', text_body: 'Hello.' },
      { emails: { sendToStream } as never },
    );

    expect(sendToStream).toHaveBeenCalledWith(
      'newsletter',
      expect.objectContaining({ from: 'news@acme.com', text_body: 'Hello.' }),
    );
    expect(payload(result)).toEqual({ queued: 42, skipped: 3 });
  });

  it('refuses a broadcast without a body', async () => {
    const result = await callTool(
      'send_to_stream',
      { permalink: 'newsletter', from: 'news@acme.com' },
      {},
    );

    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toContain('MissingBody');
  });
});

describe('subscribers', () => {
  it('adds one address, upserting by address', async () => {
    const add = vi.fn(() =>
      ok({ subscriber: { id: 1, address: 'ada@example.com', status: 'subscribed', created_at: '' } }),
    );
    await callTool(
      'add_subscriber',
      { permalink: 'newsletter', address: 'ada@example.com' },
      { subscribers: { add } as never },
    );

    expect(add).toHaveBeenCalledWith('newsletter', { address: 'ada@example.com' });
  });

  it('imports many addresses', async () => {
    const importFn = vi.fn(() => ok({ added: 2, total: 5 }));
    await callTool(
      'import_subscribers',
      { permalink: 'newsletter', addresses: ['ada@example.com', 'grace@example.com'] },
      { subscribers: { import: importFn } as never },
    );

    expect(importFn).toHaveBeenCalledWith('newsletter', [
      'ada@example.com',
      'grace@example.com',
    ]);
  });

  it('requires at least one address to import (schema)', () => {
    const schema = z.object(getTool('import_subscribers').inputSchema);
    expect(() => schema.parse({ permalink: 'newsletter', addresses: [] })).toThrow();
  });

  it('records a complaint, which suppresses and unsubscribes', async () => {
    const complaint = vi.fn(() =>
      ok({ subscriber: { id: 1, address: 'ada@example.com', status: 'unsubscribed', created_at: '' } }),
    );
    await callTool(
      'record_complaint',
      { permalink: 'newsletter', address: 'ada@example.com' },
      { subscribers: { complaint } as never },
    );

    expect(complaint).toHaveBeenCalledWith('newsletter', 'ada@example.com');
  });
});

describe('layouts', () => {
  it('creates a layout with the content placeholder', async () => {
    const create = vi.fn(() => ok({ layout: { id: 1, permalink: 'default' } }));
    await callTool(
      'create_layout',
      { name: 'Default', html_wrapper: '<html>{{{ content }}}</html>' },
      { layouts: { create } as never },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ html_wrapper: '<html>{{{ content }}}</html>' }),
    );
  });

  it('requires the html wrapper (schema)', () => {
    const schema = z.object(getTool('create_layout').inputSchema);
    expect(() => schema.parse({ name: 'Broken' })).toThrow();
  });

  it('splits the permalink out of the update body', async () => {
    const update = vi.fn(() => ok({ layout: { id: 1, permalink: 'default' } }));
    await callTool(
      'update_layout',
      { permalink: 'default', name: 'Main' },
      { layouts: { update } as never },
    );

    expect(update).toHaveBeenCalledWith('default', { name: 'Main' });
  });
});

describe('inbound and logs', () => {
  it('retries a held message and reads the requeued flag', async () => {
    // The endpoint answers with `requeued`, not `queued`.
    const retry = vi.fn(() => ok({ message: { id: 55 }, requeued: true }));
    const result = await callTool('retry_inbound', { id: 55 }, { inbound: { retry } as never });

    expect(retry).toHaveBeenCalledWith(55);
    expect(payload(result)).toEqual({ message: { id: 55 }, requeued: true });
  });

  it('lists logged API requests by status class', async () => {
    const list = vi.fn(() => ok({ requests: [], pagination: {} }));
    await callTool('list_api_requests', { status: '4xx' }, { logs: { list } as never });

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ status: '4xx' }));
  });

  it('lists tags', async () => {
    const tags = vi.fn(() => ok({ tags: [{ tag: 'receipt', count: 12 }] }));
    const result = await callTool('list_tags', {}, { logs: { tags } as never });

    expect(payload(result)).toEqual({ tags: [{ tag: 'receipt', count: 12 }] });
  });
});

describe('streams', () => {
  it('creates a stream with an explicit permalink', async () => {
    const create = vi.fn(() => ok({ stream: { id: 2, permalink: 'broadcasts' } }));
    await callTool(
      'create_stream',
      { name: 'Broadcasts', permalink: 'broadcasts', stream_type: 'broadcast' },
      { streams: { create } as never },
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ permalink: 'broadcasts', stream_type: 'broadcast' }),
    );
  });

  it('splits the permalink out of the update body', async () => {
    const update = vi.fn(() => ok({ stream: { id: 2, permalink: 'broadcasts' } }));
    await callTool(
      'update_stream',
      { permalink: 'broadcasts', archived: true },
      { streams: { update } as never },
    );

    expect(update).toHaveBeenCalledWith('broadcasts', { archived: true });
  });
});
