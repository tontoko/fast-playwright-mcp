# Custom browser executables

Fast Playwright MCP accepts a browser binary through `--executable-path` or `browser.launchOptions.executablePath` in a configuration file. The binary still needs to be compatible with the selected Playwright browser type.

## Example: third-party Firefox-compatible binary

[`feder-cr/invisible_playwright`](https://github.com/feder-cr/invisible_playwright) is one example of a third-party project that exposes the absolute path of its downloaded Firefox-compatible binary.

Install and fetch it according to that project's instructions:

```bash
pip install git+https://github.com/feder-cr/invisible_playwright.git
python -m invisible_playwright fetch
```

Print the cached executable path:

```bash
invisible_playwright path
```

Pass the printed absolute path to Fast Playwright MCP:

```json
{
  "mcpServers": {
    "playwright-firefox": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--browser",
        "firefox",
        "--executable-path",
        "/absolute/path/printed/by/invisible_playwright"
      ]
    }
  }
}
```

The equivalent configuration-file form is:

```json
{
  "browser": {
    "browserName": "firefox",
    "launchOptions": {
      "executablePath": "/absolute/path/printed/by/invisible_playwright"
    }
  }
}
```

## Compatibility and safety

Third-party browser builds are not developed, audited, endorsed, or supported by this repository. Their patches may change browser behavior, security properties, update cadence, and Playwright compatibility. Pin versions where reproducibility matters, verify downloaded artifacts, and test upgrades before production use.

Use browser automation only where you are authorized to do so, and comply with applicable laws, site terms, privacy obligations, and organizational policy. Refer to the third-party project's own license and disclaimer before use.
