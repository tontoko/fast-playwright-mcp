# Playwright MCP browser extension

The extension connects Fast Playwright MCP to tabs in an existing Chrome, Edge, or Chromium profile. The connected MCP client can access the selected tab and its authenticated browser state, so only approve clients you trust.

## Build the bundled extension

The bundled protocol-v1 extension is the extension supported by this repository.

```bash
cd extension
npm ci
npm run build
```

Then:

1. Open `chrome://extensions/` (or `edge://extensions/`).
2. Enable **Developer mode**.
3. Select **Load unpacked** and choose `extension/dist`.
4. Configure the MCP server with `--extension`:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--extension"
      ]
    }
  }
}
```

On the first browser operation, the extension opens a confirmation page. Select the tab to expose and click **Connect**. Rejecting the request closes the pending relay, and a later browser operation can open a fresh request.

## Microsoft Playwright Extension compatibility

The current Microsoft Playwright Extension uses protocol v2. This repository's bundled relay remains protocol v1, so the Chrome Web Store extension ID and token must not be configured as a substitute. Protocol-v2 migration is intentionally deferred until the relay, reconnect, and multi-tab semantics can be adopted together.

## Troubleshooting

- The browser executable must be installed in a standard location for the selected channel (`chrome` by default).
- Only loopback relay connections are accepted; the server binds the relay to `127.0.0.1`.
- The launcher selects the Chrome profile containing the bundled extension when it can identify one from `Local State` and the profile `Extensions` directory.
- If the connection page says the extension is missing, verify that the bundled extension is installed and restart the browser after installing or updating it.
