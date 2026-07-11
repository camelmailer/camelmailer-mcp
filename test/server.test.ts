import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it, vi } from 'vitest';

import type { McpClient } from '../src/client.js';
import { createServer } from '../src/server.js';
import { tools } from '../src/tools.js';
import { email, ok, pagination } from './helpers.js';

async function connect(sdkClient: Partial<McpClient>) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer(sdkClient as McpClient);
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe('createServer', () => {
  it('registers every tool over the wire', async () => {
    const client = await connect({});
    const listed = await client.listTools();

    expect(listed.tools.map((tool) => tool.name).sort()).toEqual(
      tools.map((tool) => tool.name).sort(),
    );
    const sendEmail = listed.tools.find((tool) => tool.name === 'send_email');
    expect(sendEmail?.description).toContain('transactional email');
    expect(sendEmail?.inputSchema).toMatchObject({ type: 'object' });
  });

  it('executes a tool call end-to-end', async () => {
    const list = vi.fn(() => ok({ messages: [email()], pagination: pagination() }));
    const client = await connect({ emails: { list } as never });

    const result = await client.callTool({
      name: 'list_emails',
      arguments: { scope: 'outgoing' },
    });

    expect(list).toHaveBeenCalledWith(expect.objectContaining({ scope: 'outgoing' }));
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0]!.text)).toMatchObject({ messages: [{ id: 42 }] });
  });

  it('rejects invalid arguments through the protocol schema validation', async () => {
    const client = await connect({});
    const result = await client.callTool({
      name: 'get_email',
      arguments: { id: 'not-a-number' },
    });
    expect(result.isError).toBe(true);
  });

  it('turns handler exceptions into isError results instead of crashing', async () => {
    const list = vi.fn(() => {
      throw new Error('boom');
    });
    const client = await connect({ emails: { list } as never });
    const result = await client.callTool({ name: 'list_emails', arguments: {} });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0]!.text).toContain('UnexpectedError');
  });
});
