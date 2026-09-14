import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpClient } from './client.js';
import { createClientFromEnv } from './client.js';
import { fail, tools } from './tools.js';
import { VERSION } from './version.js';

/**
 * Build the CamelMailer MCP server with every tool registered.
 * The SDK client is injectable for tests; by default it is created from
 * `CAMELMAILER_API_KEY` / `CAMELMAILER_BASE_URL`.
 */
export function createServer(client: McpClient = createClientFromEnv()): McpServer {
  const server = new McpServer({ name: '@camelmailer/sdk', version: VERSION });

  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
      },
      async (args) => {
        try {
          return await tool.handler(client, args);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return fail('UnexpectedError', message);
        }
      },
    );
  }

  return server;
}
