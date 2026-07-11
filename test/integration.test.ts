import { describe, expect, it } from 'vitest';

import { createClientFromEnv } from '../src/client.js';
import { callTool, payload } from './helpers.js';

/**
 * Integration roundtrip against a real CamelMailer instance.
 *
 * Skipped unless CAMELMAILER_API_KEY is set (never active in CI):
 *
 *   CAMELMAILER_API_KEY=cm_xxx CAMELMAILER_BASE_URL=https://mail.example.com npm test
 */
const apiKey = process.env.CAMELMAILER_API_KEY;

describe.skipIf(!apiKey)('integration (real instance)', () => {
  it('lists messages through the list_emails tool', async () => {
    const client = createClientFromEnv();
    const result = await callTool('list_emails', { per_page: 1 }, client);

    expect(result.isError).toBeUndefined();
    expect(payload(result)).toHaveProperty('pagination');
  });

  it('reads the server stats through the get_stats tool', async () => {
    const client = createClientFromEnv();
    const result = await callTool('get_stats', {}, client);

    expect(result.isError).toBeUndefined();
    expect(payload(result)).toHaveProperty('stats');
  });
});
