# Camelmailer MCP Server

[![CI](https://github.com/camelmailer/camelmailer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/camelmailer/camelmailer-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/%40camelmailer%2Fmcp.svg)](https://www.npmjs.com/package/@camelmailer/mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

[Model Context Protocol](https://modelcontextprotocol.io) server for [Camelmailer](https://camelmailer.com) — lets AI assistants like Claude send and inspect transactional email. Works with the Camelmailer cloud and any self-hosted instance.

## Setup

You need a server API key from your Camelmailer dashboard.

### Claude Desktop

Add to `claude_desktop_config.json` (Settings → Developer → Edit Config):

```json
{
  "mcpServers": {
    "camelmailer": {
      "command": "npx",
      "args": ["-y", "@camelmailer/mcp"],
      "env": {
        "CAMELMAILER_API_KEY": "cm_xxxx"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add camelmailer -e CAMELMAILER_API_KEY=cm_xxxx -- npx -y @camelmailer/mcp
```

### Self-hosted instances

Point the server at your own instance (defaults to `https://app.camelmailer.com`):

```json
"env": {
  "CAMELMAILER_API_KEY": "cm_xxxx",
  "CAMELMAILER_BASE_URL": "https://mail.example.com"
}
```

## Tools

| Tool | Description |
| --- | --- |
| `send_email` | Send an email with `html_body` / `text_body` |
| `send_email_with_template` | Render a stored template against variables and send |
| `list_emails` | List messages (filter by scope, status, tag, query, stream) |
| `get_email` | One message incl. SMTP delivery attempts |
| `list_templates` | All stored message templates |
| `render_template` | Preview a rendered template — no send |
| `get_stats` | Message counters (sent, bounced, opens, clicks, …) |
| `list_bounces` | Bounced messages |
| `dmarc_summary` | DMARC pass rate and top sending sources |
| `list_streams` `get_stream` `create_stream` `update_stream` `archive_stream` | Message streams |
| `send_to_stream` | **Sends now** to every subscriber of a broadcast stream |
| `list_campaigns` `get_campaign` | Campaigns and their statistics |
| `create_campaign_draft` | Write a campaign **without** sending it |
| `send_campaign_now` | **Sends now**: creates a campaign and mails the stream |
| `update_campaign` `send_campaign` `cancel_campaign` | Edit, send or call off a campaign |
| `list_subscribers` `add_subscriber` `import_subscribers` | The audience of a broadcast stream |
| `record_complaint` `remove_subscriber` | Suppress or remove an address |
| `list_layouts` `get_layout` `create_layout` `update_layout` `delete_layout` | Template layouts |
| `list_inbound` `get_inbound` `retry_inbound` `bypass_inbound` | Inbound and held messages |
| `list_api_requests` `list_tags` | The server's request log and tag index |

### Which campaign tool sends

There are two ways to create a campaign and they behave differently:

- **`create_campaign_draft`** writes it and waits. Without `scheduled_at` it
  stays a draft; with one the server sends it when due.
- **`send_campaign_now`** creates it and mails every subscriber of the stream
  before the call returns. There is no draft to review.

They are separate tools because they are separate API routes, and calling one
when you meant the other is the difference between a draft and a broadcast.

Tools that mail people or remove data carry the MCP `destructiveHint`
annotation; the read-only ones carry `readOnlyHint`. A client can use those to
ask before running one.

Example prompts:

> Send a plain-text email from billing@acme.com to ada@example.com thanking her for the purchase.

> Why did yesterday's emails to @gmail.com addresses bounce?

> Draft a September newsletter for the product-news stream, but do not send it yet.

> How many people are subscribed to product-news, and how did last month's campaign do?

## Errors

API failures come back as tool errors carrying the stable Camelmailer error code (`Unauthorized`, `NotFound`, `ValidationError`, …), so the assistant can react — nothing crashes the server.

## Docs

Full API reference: [camelmailer.com/docs](https://camelmailer.com/docs) · SDK: [camelmailer-node](https://github.com/camelmailer/camelmailer-node) · CLI: [camelmailer-cli](https://github.com/camelmailer/camelmailer-cli)

## License

[MIT](LICENSE)
