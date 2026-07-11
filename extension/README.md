# Playwright MCP browser extension

The extension connects Fast Playwright MCP to tabs in an existing Chrome, Edge, or Chromium profile. The connected MCP client can access the selected tab and its authenticated browser state, so only approve clients you trust.

## Option A: build the bundled extension

The bundled extension is the default supported by this repository.

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

On the first browser operation, the extension opens a confirmation page. Select the tab to expose and click **Connect**.

## Option B: use the current Playwright Extension from Chrome Web Store

The Microsoft Playwright Extension uses a different extension ID. Install it from:

https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm

Set its ID in the MCP server environment:

```json
{
  "mcpServers": {
    "playwright-extension": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--extension"
      ],
      "env": {
        "PLAYWRIGHT_MCP_EXTENSION_ID": "mmlmfjhmonkocbjadbfplnigmagldckm"
      }
    }
  }
}
```

The extension normally asks for approval. To allow token-based reconnection, copy the token shown by the extension and also set `PLAYWRIGHT_MCP_EXTENSION_TOKEN` to the same value:

```json
"env": {
  "PLAYWRIGHT_MCP_EXTENSION_ID": "mmlmfjhmonkocbjadbfplnigmagldckm",
  "PLAYWRIGHT_MCP_EXTENSION_TOKEN": "replace-with-the-extension-token"
}
```

Do not commit that token to a repository or share it with untrusted clients.

## Troubleshooting

- The browser executable must be installed in a standard location for the selected channel (`chrome` by default).
- Only loopback relay connections are accepted; the server binds the relay to `127.0.0.1`.
- If the connection page says the extension is missing, verify the extension ID and restart the browser after installing or updating the extension.
- If a previous connection is stuck, close the confirmation page, disconnect the extension, and retry the browser operation.
