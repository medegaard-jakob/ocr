#!/usr/bin/env bash
# Launches the Playwright MCP server (https://github.com/microsoft/playwright-mcp)
# so Claude Code can drive a real browser -- navigate the built web app,
# click through screens, and take screenshots.
#
# Claude Code's own remote sandbox environments pre-install Chromium outside
# Playwright's normal managed-browser location (see PLAYWRIGHT_BROWSERS_PATH),
# at a version the MCP server's bundled Playwright doesn't recognize. When
# that binary is present we point at it directly with --executable-path,
# which skips Playwright's version check entirely, and add --no-sandbox since
# these sandboxes run as root. On any other machine neither condition is met
# and Playwright manages/downloads its own browser as usual.
set -euo pipefail

args=(--headless --isolated)

sandbox_chromium="/opt/pw-browsers/chromium"
if [ -x "$sandbox_chromium" ]; then
  args+=(--executable-path "$sandbox_chromium" --no-sandbox)
fi

exec npx -y @playwright/mcp@latest "${args[@]}"
