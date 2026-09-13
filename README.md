# Camelmailer MCP Server

[![CI](https://github.com/camelmailer/camelmailer-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/camelmailer/camelmailer-mcp/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/camelmailer-mcp.svg)](https://www.npmjs.com/package/camelmailer-mcp)
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
      "args": ["-y", "camelmailer-mcp"],
      "env": {
        "CAMELMAILER_API_KEY": "cm_xxxx"
      }
    }
  }
}
```

> Until the packages land on npm, use the GitHub source instead:
> `"args": ["-y", "github:camelmailer/camelmailer-mcp"]`

### Claude Code

```bash
claude mcp add camelmailer -e CAMELMAILER_API_KEY=cm_xxxx -- npx -y camelmailer-mcp
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

Example prompts:

> Send a plain-text email from billing@acme.com to ada@example.com thanking her for the purchase.

> Why did yesterday's emails to @gmail.com addresses bounce?

> What's our DMARC pass rate for acme.com this month?

## Errors

API failures come back as tool errors carrying the stable Camelmailer error code (`Unauthorized`, `NotFound`, `ValidationError`, …), so the assistant can react — nothing crashes the server.

## Docs

Full API reference: [camelmailer.com/docs](https://camelmailer.com/docs) · SDK: [camelmailer-node](https://github.com/camelmailer/camelmailer-node) · CLI: [camelmailer-cli](https://github.com/camelmailer/camelmailer-cli)

## License

[MIT](LICENSE)
