# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/camelmailer/camelmailer-mcp/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/camelmailer/camelmailer-mcp/releases/tag/v0.1.0
