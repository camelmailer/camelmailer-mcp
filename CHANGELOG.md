# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-09-14

### Added

- Campaign tools: `list_campaigns`, `get_campaign`, `create_campaign_draft`,
  `send_campaign_now`, `update_campaign`, `send_campaign`,
  `cancel_campaign`. The two create tools are deliberately separate:
  `create_campaign_draft` writes the campaign and waits, while
  `send_campaign_now` mails every subscriber of the stream before it
  returns.
- Subscriber tools: `list_subscribers`, `add_subscriber`,
  `import_subscribers`, `record_complaint`, `remove_subscriber`.
- Layout tools: `list_layouts`, `get_layout`, `create_layout`,
  `update_layout`, `delete_layout`.
- Inbound tools: `list_inbound`, `get_inbound`, `retry_inbound`,
  `bypass_inbound`.
- Log tools: `list_api_requests`, `list_tags`.
- Stream tools: `list_streams`, `get_stream`, `create_stream`,
  `update_stream`, `archive_stream`. The server had none.
- `send_to_stream` for broadcasting to a stream's subscribers.
- `idempotency_key` on `send_email` and `send_email_with_template`.
- MCP annotations on every tool: `readOnlyHint` for the readers,
  `destructiveHint` for everything that mails people or removes data, so a
  client can ask before running one.

### Changed

- Requires `@camelmailer/sdk` 0.2.2.

## [0.1.0] - 2026-07-12

### Added

- MCP server (stdio) exposing the Camelmailer messaging API to AI assistants.
- Tools: `send_email`, `send_email_with_template`, `list_emails`, `get_email`,
  `list_templates`, `render_template`, `get_stats`, `list_bounces`,
  `dmarc_summary` — all with zod input schemas and descriptions.
- API errors surface as `isError` tool results carrying the stable
  Camelmailer error code (`Unauthorized`, `ValidationError`, …).
- Configuration via `CAMELMAILER_API_KEY` / `CAMELMAILER_BASE_URL`
  environment variables (self-hosted instances supported).

[Unreleased]: https://github.com/camelmailer/camelmailer-mcp/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/camelmailer/camelmailer-mcp/releases/tag/v0.2.0
[0.1.0]: https://github.com/camelmailer/camelmailer-mcp/releases/tag/v0.1.0
