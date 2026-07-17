## **Fast** Playwright MCP

This MCP server is a fork of the Microsoft one.
<https://github.com/microsoft/playwright-mcp>

A Model Context Protocol (MCP) server that provides browser automation capabilities using [Playwright](https://playwright.dev). This server enables LLMs to interact with web pages through structured accessibility snapshots, bypassing the need for screenshots or visually-tuned models.

### Key Features

- **Fast and lightweight**. Uses Playwright's accessibility tree, not pixel-based input.
- **LLM-friendly**. No vision models needed, operates purely on structured data.
- **Deterministic tool application**. Avoids ambiguity common with screenshot-based approaches.

### Fast Server Features (This Fork)

- **Token Optimization**. All tools support an `expectation` parameter to control response content:
  - `includeCode: false` - Suppress Playwright code generation to reduce tokens
  - `includeSnapshot: false` - Skip page snapshot for minimal responses (70-80% token reduction)
  - `includeConsole: false` - Exclude console messages
  - `includeTabs: false` - Hide tab information
- **Image Compression**. Screenshot tool supports `imageOptions`:
  - `format: 'jpeg'` - Use JPEG instead of PNG
  - `quality: 1-100` - Compress images (e.g., 50 for 50% quality)
  - `maxWidth: number` - Resize images to max width
- **Batch Execution**. Use `browser_batch_execute` for multiple operations:
  - Significant token reduction by eliminating redundant responses
  - Per-step and global expectation configuration
  - Error handling with `continueOnError` and `stopOnFirstError` options
- **Snapshot Control**. Limit snapshot size with `snapshotOptions`:
  - `selector: string` - Capture only specific page sections (recommended over maxLength)
  - `format: "aria"` - Accessibility tree format for LLM processing
- **Diff Detection**. Track only changes with `diffOptions`:
  - `enabled: true` - Show only what changed from previous state (massive token saver)
  - `format: "minimal"` - Ultra-compact diff output
  - Perfect for monitoring state changes during navigation or interactions
- **Diagnostic System**. Advanced debugging and element discovery tools:
  - `browser_find_elements` - Find elements using multiple search criteria (text, role, attributes)
  - `browser_diagnose` - Comprehensive page analysis with performance metrics and troubleshooting
  - Enhanced error handling with alternative element suggestions
  - Page structure analysis (iframes, modals, accessibility metrics)
  - Performance monitoring with execution time under 300ms
- **Enhanced Selector System**. Unified element selection with multiple strategies:
  - **Selector Arrays**: All element-based tools now support multiple selectors with automatic fallback
  - **4 Selector Types**: 
    - `ref`: System-generated element IDs from previous tool results (highest priority)
    - `role`: ARIA roles with optional text matching (e.g., `{role: "button", text: "Submit"}`)
    - `css`: Standard CSS selectors (e.g., `{css: "#submit-btn"}`)
    - `text`: Text content search with optional tag filtering (e.g., `{text: "Click me", tag: "button"}`)
  - **Intelligent Resolution**: Parallel CSS resolution, sequential role matching, automatic fallback
  - **Multiple Match Handling**: When multiple elements match, returns candidate list for LLM selection
  - **HTML Inspection**: New `browser_inspect_html` tool for intelligent content extraction with depth control

### Adaptive tool catalog

Version 0.2 defaults to an adaptive seven-tool startup catalog, reducing the fixed MCP context cost while preserving access to all registered tools.

- `browser_tools` searches, enables, disables, resets, and reports catalog state.
- `browser_query` dispatches schema-validated read-only tools.
- `browser_execute` dispatches schema-validated action and destructive tools.
- Known hidden tools remain directly callable for existing integrations.
- `--tool-profile=full` restores the previous complete static catalog.
- `--tool-profile=minimal` exposes only the discovery and dispatch gateways.

The repository enforces a serialized startup budget in CI. Run `bun run benchmark:tools -- --check` to inspect the current profile sizes.

### Security and interoperability controls

The CLI and configuration file support CDP headers and connection timeout, HTTP Host allowlisting, output-directory size limits, response secret redaction, action/navigation/expectation timeouts, a custom test-id attribute, and `codegen: "none"`. The optional offline MCP Apps dashboard is enabled with `--caps=apps`.

Maintenance documentation:

- [Architecture](docs/architecture.md)
- [0.2 migration guide](docs/migration-0.2.md)
- [Upstream compatibility policy](docs/upstream-policy.md)
- [Upstream compatibility matrix](docs/upstream-compatibility.md)
- [Release checklist](docs/release-checklist.md)

### Requirements
- Node.js 18 or newer
- VS Code, Cursor, Windsurf, Claude Desktop, Goose or any other MCP client

<!--
// Generate using:
node utils/generate-links.js
-->

### Getting started

First, install the Playwright MCP server with your client.

**Standard config** works in most of the tools:

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest"
      ]
    }
  }
}
```

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522fast-playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540tontoko%252Ffast-playwright-mcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522fast-playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540tontoko%252Ffast-playwright-mcp%2540latest%2522%255D%257D)


<details>
<summary>Claude Code</summary>

Use the Claude Code CLI to add the Playwright MCP server:

```bash
claude mcp add fast-playwright npx @tontoko/fast-playwright-mcp@latest
```
</details>

<details>
<summary>Claude Desktop</summary>

Follow the MCP install [guide](https://modelcontextprotocol.io/quickstart/user), use the standard config above.

</details>

<details>
<summary>Cursor</summary>

#### Click the button to install:

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](cursor://anysphere.cursor-deeplink/mcp/install?name=fast-playwright&config=eyJjb21tYW5kIjoibnB4IEB0b250b2tvL2Zhc3QtcGxheXdyaWdodC1tY3BAbGF0ZXN0In0K)

#### Or install manually:

Go to `Cursor Settings` -> `MCP` -> `Add new MCP Server`. Name to your liking, use `command` type with the command `npx @tontoko/fast-playwright-mcp@latest`. You can also verify config or add command like arguments via clicking `Edit`.

</details>

<details>
<summary>Gemini CLI</summary>

Follow the MCP install [guide](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md#configure-the-mcp-server-in-settingsjson), use the standard config above.

</details>

<details>
<summary>Goose</summary>

#### Click the button to install:

[![Install in Goose](https://block.github.io/goose/img/extension-install-dark.svg)](https://block.github.io/goose/extension?cmd=npx&arg=%40playwright%2Fmcp%40latest&id=playwright&name=Playwright&description=Interact%20with%20web%20pages%20through%20structured%20accessibility%20snapshots%20using%20Playwright)

#### Or install manually:

Go to `Advanced settings` -> `Extensions` -> `Add custom extension`. Name to your liking, use type `STDIO`, and set the `command` to `npx @tontoko/fast-playwright-mcp`. Click "Add Extension".
</details>

<details>
<summary>LM Studio</summary>

#### Click the button to install:

[![Add MCP Server playwright to LM Studio](https://files.lmstudio.ai/deeplink/mcp-install-light.svg)](https://lmstudio.ai/install-mcp?name=playwright&config=eyJjb21tYW5kIjoibnB4IiwiYXJncyI6WyJAcGxheXdyaWdodC9tY3BAbGF0ZXN0Il19)

#### Or install manually:

Go to `Program` in the right sidebar -> `Install` -> `Edit mcp.json`. Use the standard config above.
</details>

<details>
<summary>opencode</summary>

Follow the MCP Servers [documentation](https://opencode.ai/docs/mcp-servers/). For example in `~/.config/opencode/opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "playwright": {
      "type": "local",
      "command": [
        "npx",
        "@tontoko/fast-playwright-mcp"
      ],
      "enabled": true
    }
  }
}

```
</details>

<details>
<summary>Qodo Gen</summary>

Open [Qodo Gen](https://docs.qodo.ai/qodo-documentation/qodo-gen) chat panel in VSCode or IntelliJ → Connect more tools → + Add new MCP → Paste the standard config above.

Click <code>Save</code>.
</details>

<details>
<summary>VS Code</summary>

#### Click the button to install:

[<img src="https://img.shields.io/badge/VS_Code-VS_Code?style=flat-square&label=Install%20Server&color=0098FF" alt="Install in VS Code">](https://insiders.vscode.dev/redirect?url=vscode%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522fast-playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540tontoko%252Ffast-playwright-mcp%2540latest%2522%255D%257D) [<img alt="Install in VS Code Insiders" src="https://img.shields.io/badge/VS_Code_Insiders-VS_Code_Insiders?style=flat-square&label=Install%20Server&color=24bfa5">](https://insiders.vscode.dev/redirect?url=vscode-insiders%3Amcp%2Finstall%3F%257B%2522name%2522%253A%2522fast-playwright%2522%252C%2522command%2522%253A%2522npx%2522%252C%2522args%2522%253A%255B%2522%2540tontoko%252Ffast-playwright-mcp%2540latest%2522%255D%257D)

#### Or install manually:

Follow the MCP install [guide](https://code.visualstudio.com/docs/copilot/chat/mcp-servers#_add-an-mcp-server), use the standard config above. You can also install the Playwright MCP server using the VS Code CLI:

```bash
# For VS Code
code --add-mcp '{"name":"fast-playwright","command":"npx","args":["@tontoko/fast-playwright-mcp@latest"]}'
```

After installation, the Playwright MCP server will be available for use with your GitHub Copilot agent in VS Code.
</details>

<details>
<summary>Windsurf</summary>

Follow Windsurf MCP [documentation](https://docs.windsurf.com/windsurf/cascade/mcp). Use the standard config above.

</details>

### Configuration file

The Playwright MCP server can be configured using a JSON file. You can specify the configuration file using the `--config` command line option:

```bash
npx @tontoko/fast-playwright-mcp@latest --config path/to/config.json
```

<details>
<summary>Configuration file schema</summary>

```typescript
{
  /**
   * Tool catalog profile. Adaptive is the 0.2 default; full restores the
   * pre-0.2 static catalog and minimal exposes only the discovery gateways.
   */
  toolProfile?: 'adaptive' | 'full' | 'minimal';

  browser?: {
    /**
     * The browser to use.
     */
    browserName?: 'chromium' | 'firefox' | 'webkit';

    /**
     * Keep the browser profile in memory. By default the profile is written
     * under the operating system's temporary Playwright registry directory.
     */
    isolated?: boolean;

    /**
     * Path to the user data directory. Supplying this overrides the generated
     * persistent profile location.
     */
    userDataDir?: string;

    /**
     * Launch options passed to Playwright.
     */
    launchOptions?: {
      channel?: string;
      executablePath?: string;
      headless?: boolean;
      args?: string[];
    };

    /**
     * Browser context options passed to Playwright.
     */
    contextOptions?: Record<string, unknown>;

    /**
     * Existing Chrome DevTools Protocol endpoint.
     */
    cdpEndpoint?: string;

    /**
     * HTTP headers sent when connecting to the CDP endpoint.
     */
    cdpHeaders?: Record<string, string>;

    /**
     * CDP connection timeout in milliseconds.
     */
    cdpTimeout?: number;

    /**
     * Playwright remote browser endpoint.
     */
    remoteEndpoint?: string;
  };

  server?: {
    host?: string;
    port?: number;
    allowedHosts?: string[];
  };

  capabilities?: Array<'vision' | 'pdf' | 'apps'>;
  outputDir?: string;
  outputMode?: 'file' | 'stdio';
  outputMaxSize?: number;
  secrets?: Record<string, string>;
  testIdAttribute?: string;
  timeouts?: {
    action?: number;
    navigation?: number;
    expect?: number;
  };
  codegen?: 'typescript' | 'none';
}
```

</details>

### User profile

You can run Playwright MCP with a persistent profile, like a regular browser (default), in isolated contexts for testing sessions, or connect to an existing browser using the [browser extension](extension/README.md).

**Persistent profile**

All the logged in information will be stored in the persistent profile, you can delete it between sessions if you'd like to clear the offline state.
The persistent profile will be located in the following directories and you can override it with the `--user-data-dir` argument.

```bash
# Windows
%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile

# macOS
- ~/Library/Caches/ms-playwright/mcp-{channel}-profile

# Linux
- ~/.cache/ms-playwright/mcp-{channel}-profile
```

**Isolated**

In isolated mode, each session is started in an isolated profile. Every time you ask MCP to close the browser,
the session is closed and all the storage state for this session is lost. Isolated mode can be used for testing
purposes to ensure each session is independent.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--isolated"
      ]
    }
  }
}
```

**Browser extension**

The Playwright MCP Browser Extension allows you to connect to existing browser tabs and leverage your current browser session and authenticated state. See the [extension/README.md](extension/README.md) for installation and usage instructions.

### Configuration

Playwright MCP server supports following arguments. All of them are optional:

<!--- Options generated by update-readme.js -->

```
> npx @tontoko/fast-playwright-mcp@latest --help
  --tool-profile <profile>           tool catalog profile: adaptive, full, or
                                     minimal
  --allowed-hosts <hosts...>         comma-separated HTTP Host values accepted
                                     by the HTTP transport. Use * to disable
                                     validation.
  --cdp-endpoint <endpoint>          CDP endpoint to connect to.
  --cdp-header <headers...>          CDP headers as Name: Value pairs.
  --cdp-timeout <timeout>            CDP connection timeout in milliseconds.
  --ws-endpoint <endpoint>           Playwright remote browser websocket
                                     endpoint (deprecated, use --remote-endpoint
                                     instead)
  --remote-endpoint <endpoint>       Playwright remote browser endpoint to
                                     connect to.
  --remote-timeout <timeout>         Timeout in milliseconds for remote browser
                                     connection. Defaults to 30000ms (30
                                     seconds).
  --browser <browser>                browser or chrome channel to use, possible
                                     values: chrome, firefox, webkit, msedge.
  --caps <caps>                      comma-separated list of additional
                                     capabilities to enable, possible values:
                                     vision, pdf, apps.
  --config <path>                    path to the configuration file.
  --console-level <level>            level of console messages to return:
                                     "error", "warning", "info" or "debug".
                                     Each level includes the messages of more
                                     severe levels.
  --device <device>                  device to emulate, for example: "iPhone
                                     15"
  --executable-path <path>           path to the browser executable.
  --extension                        Connect to an already running Chrome/Edge
                                     instance (with the "Playwright MCP Bridge"
                                     extension installed).
  --grant-permissions <permissions>  List of permissions to grant to the browser
                                     context, for example
                                     "geolocation,clipboard-read,clipboard-write
                                     ".
  --headless                         run browser in headless mode, headed by
                                     default
  --host <host>                      host to bind server to. Default is
                                     localhost. Use 0.0.0.0 to bind to all
                                     interfaces.
  --ignore-https-errors              ignore https errors
  --init-page <path...>              path to TypeScript file to evaluate on the
                                     Playwright page object
  --init-script <path...>            path to JavaScript file to add to every
                                     page before any of the page's scripts.
                                     Can be specified multiple times.
  --isolated                        keep the browser profile in memory, do not
                                    save it to disk.
  --image-responses <mode>           whether to send image responses to the
                                     client. Can be "allow" or "omit", Defaults
                                     to "allow".
  --no-sandbox                       disable the sandbox for all process types
                                     that are normally sandboxed.
  --output-dir <path>                path to save the output files.
  --output-max-size <bytes>          maximum output directory size in bytes. 0
                                     disables eviction.
  --output-mode <mode>               whether to save the output to a file or
                                     return it in the response. Possible values:
                                     "file" or "stdio". Default is "stdio".
  --port <port>                      port to listen on for SSE transport.
  --proxy-bypass <bypass>            comma-separated domains to bypass proxy,
                                     for example
                                     ".com,chromium.org,.domain.com"
  --proxy-server <proxy>             specify proxy server, for example
                                     "http://myproxy:3128" or
                                     "socks5://myproxy:8080"
  --save-session                     whether to save the Playwright MCP session
                                     into the output directory.
  --save-trace                       whether to save the Playwright Trace of the
                                     session into the output directory.
  --save-video <resolution>          whether to save the video of the session
                                     into the output directory. For example
                                     "--save-video=800x600"
  --secrets <path>                   dotenv file containing values redacted from
                                     textual tool responses.
  --shared-browser-context           whether to reuse the same browser context
                                     across all connected HTTP clients.
  --storage-state <path>             path to the storage state file for isolated
                                     sessions.
  --test-id-attribute <attribute>    attribute used by Playwright getByTestId.
  --timeout-action <timeout>         default action timeout in milliseconds.
  --timeout-navigation <timeout>     default navigation timeout in milliseconds.
  --timeout-expect <timeout>         default expectation timeout in milliseconds.
  --user-agent <ua string>           specify user agent string
  --user-data-dir <path>             path to the user data directory. If not
                                     specified, a temporary directory will be
                                     created.
  --viewport-size <size>             specify browser viewport size in pixels,
                                     for example "1280x720"

```

<!--- End of options generated section -->

### Custom Browser Executables (Firefox Forks and Chrome/Chromium Forks)

By default, Playwright launches its bundled browsers. You can use a custom browser executable (for example a branded Chromium fork or a Firefox-based browser) by specifying the full path to the executable. See `CUSTOM_BROWSER_EXECUTABLES.md` for detailed, platform-specific instructions and warnings.

- CLI: `--browser <chromium|firefox|webkit>` with `--executable-path <full path>`
- Config file: set `browser.launchOptions.executablePath`

Examples:

```bash
npx @tontoko/fast-playwright-mcp@latest --browser chromium --executable-path "/opt/google/chrome/chrome"
```

```bash
npx @tontoko/fast-playwright-mcp@latest --browser firefox --executable-path "/opt/waterfox/waterfox"
```

Important: third-party browser compatibility is not guaranteed. Verify the publisher and binary before use; the server executes the supplied path directly. Waterfox is only an illustrative Firefox-family example and may not support Playwright's required Firefox protocol patches.

### Standalone MCP server

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY set to a valid X server. For example `DISPLAY=:1 npx @tontoko/fast-playwright-mcp@latest --port 8931`.

### Docker

**NOTE:** The Docker implementation only supports headless chromium at the moment.

```json
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

Or if you prefer to run the container as a long-lived service instead of letting the MCP client spawn it, use:

```
docker run -d -i --rm --init --pull=always \
  --entrypoint node \
  --name playwright-mcp \
  -p 8931:8931 \
  mcr.microsoft.com/playwright/mcp \
  cli.js --headless --browser chromium --no-sandbox --port 8931
```

The server will be available at port **8931** and can be accessed via any MCP client.

You can build the Docker image yourself.

```
docker build -t mcr.microsoft.com/playwright/mcp .
```

### Programmatic usage

```js
import http from 'node:http';

import { createConnection } from '@tontoko/fast-playwright-mcp';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';

http.createServer(async (req, res) => {
  // ...

  // Creates a headless Playwright MCP server with SSE transport
  const connection = await createConnection({ browser: { launchOptions: { headless: true } } });
  const transport = new SSEServerTransport('/messages', res);
  await connection.sever.connect(transport);
  // ...
});
```

### Tools

<details>
<summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_batch_execute**
  - Title: Execute batch of browser operations
  - Description: Execute multiple browser tools in sequence with optional per-step expectations, error handling, and template variables.
  - Parameters:
    - `steps` (array): Array of browser operations to execute in sequence
    - `stopOnFirstError` (boolean, optional): Stop entire batch execution on first error (default: true)
    - `globalExpectation` (object, optional): Default expectation settings applied to all steps
    - `maxConcurrency` (number, optional): Maximum number of parallel operations (default: 1, max: 10)
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page you are currently working on
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_diagnose**
  - Title: Diagnose page
  - Description: Generate comprehensive diagnostic information about the current page state, structure, and potential issues for troubleshooting browser automation.
  - Parameters:
    - `includePerformanceMetrics` (boolean, optional): Include performance metrics and timing information
    - `includeAccessibilityInfo` (boolean, optional): Include accessibility-related information
    - `includeTroubleshootingSuggestions` (boolean, optional): Include troubleshooting suggestions
    - `useUnifiedSystem` (boolean, optional): Use unified diagnostic system for enhanced error handling
    - `enableRealTimeMonitoring` (boolean, optional): Enable real-time monitoring during diagnosis
    - `performanceThresholds` (object, optional): Custom performance thresholds
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop operation between two elements
  - Parameters:
    - `startSelectors` (array): Starting element selector strategies for the drag operation
    - `endSelectors` (array): Ending element selector strategies for the drag operation
    - `startRef` (string, optional): Exact target element reference from the page snapshot (deprecated, use startSelectors instead)
    - `startElement` (string, optional): Human-readable source element description (deprecated, use startSelectors instead)
    - `endRef` (string, optional): Exact target element reference from the page snapshot (deprecated, use endSelectors instead)
    - `endElement` (string, optional): Human-readable target element description (deprecated, use endSelectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element
  - Parameters:
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `selectors` (array, optional): Target element selector strategies. If omitted, evaluates on the page.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_execute**
  - Title: Execute browser tool
  - Description: Execute a registered action or destructive browser tool using that tool's original schema validation.
  - Parameters:
    - `tool` (string): Registered action or destructive tool name.
    - `arguments` (object, optional): Arguments validated by the target tool schema.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array, optional): The absolute paths to the files to upload. Can be a single file or multiple files. If omitted, the file chooser is cancelled.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_find**
  - Title: Find in accessibility snapshot
  - Description: Search the accessibility snapshot and return only matching lines with a small amount of context.
  - Parameters:
    - `query` (string): Text or regular expression source to search for.
    - `regex` (boolean, optional): Treat query as a regular expression source.
    - `caseSensitive` (boolean, optional): Use case-sensitive matching.
    - `maxResults` (number, optional): Maximum matching ranges to return.
    - `contextLines` (number, optional): Number of surrounding snapshot lines to include.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_find_elements**
  - Title: Find elements
  - Description: Find elements on the page using multiple search criteria such as text, role, tag name, or attributes. Returns matching elements sorted by confidence.
  - Parameters:
    - `searchCriteria` (object): Search criteria for finding elements
    - `maxResults` (number, optional): Maximum number of results to return
    - `includeDiagnosticInfo` (boolean, optional): Include diagnostic information about the page
    - `useUnifiedSystem` (boolean, optional): Use unified diagnostic system for enhanced error handling
    - `enableEnhancedDiscovery` (boolean, optional): Enable enhanced element discovery with contextual suggestions
    - `performanceThreshold` (number, optional): Performance threshold in milliseconds for element discovery
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page
  - Parameters:
    - `selectors` (array): Element selector strategies to find the target element
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_inspect_html**
  - Title: Inspect HTML
  - Description: Inspect HTML structure with optional selector and depth limiting for better understanding of page structure
  - Parameters:
    - `selector` (string, optional): CSS selector to focus on specific element(s)
    - `maxDepth` (number, optional): Maximum depth to traverse (0 = element only, 1 = immediate children, etc.)
    - `includeAttributes` (boolean, optional): Include element attributes in output
    - `includeTextContent` (boolean, optional): Include text content of elements
    - `includeStyles` (boolean, optional): Include computed styles (limited set)
    - `maxElements` (number, optional): Maximum number of elements to return
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to the previous page
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Title: Go forward
  - Description: Go forward to the next page
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns all network requests since loading the page with advanced filtering options to reduce token usage. Enhanced Fast MCP version.
  - Parameters:
    - `includeStatic` (boolean, optional): Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.
    - `urlPatterns` (array, optional): Array of URL patterns to include (regex strings). Only requests matching at least one pattern will be included.
    - `excludeUrlPatterns` (array, optional): Array of URL patterns to exclude (regex strings). Requests matching any pattern will be excluded.
    - `methods` (array, optional): HTTP methods to include (e.g., ['GET', 'POST']). Case-insensitive.
    - `statusRanges` (array, optional): HTTP status code ranges to include (e.g., [{min: 200, max: 299}]).
    - `maxRequests` (number, optional): Maximum number of requests to return. Defaults to 50.
    - `newestFirst` (boolean, optional): Whether to return newest requests first. Defaults to false (chronological order).
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_query**
  - Title: Query browser tool
  - Description: Execute a registered read-only browser tool using that tool's original schema validation.
  - Parameters:
    - `tool` (string): Registered read-only tool name.
    - `arguments` (object, optional): Arguments validated by the target tool schema.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select an option in a dropdown
  - Parameters:
    - `selectors` (array): Element selector strategies to find the dropdown
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.
  - Parameters:
    - `type` (string, optional): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.
    - `selectors` (array, optional): Element selector strategies for element screenshot. If omitted, screenshots the page.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
    - `scale` (string, optional): Use CSS pixels or device pixels for the screenshot.
    - `imageOptions` (object, optional): Image compression and resizing options for token optimization
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tools**
  - Title: Manage browser tools
  - Description: Search the registered browser-tool catalog and control the tools visible in this MCP session.
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element
  - Parameters:
    - `selectors` (array): Element selector strategies to find the target element
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

</details>

<details>
<summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Title: Close a tab
  - Description: Close a tab
  - Parameters:
    - `index` (number, optional): The index of the tab to close. Closes current tab if not provided.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Title: List tabs
  - Description: List browser tabs
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Title: Open a new tab
  - Description: Open a new tab
  - Parameters:
    - `url` (string, optional): The URL to navigate to in the new tab. If not provided, the new tab will be blank.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Title: Select a tab
  - Description: Select a tab by index
  - Parameters:
    - `index` (number): The index of the tab to select
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>Browser installation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Title: Install the browser specified in the config
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click left mouse button at a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag left mouse button to a given position
  - Parameters:
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the PDF to. Defaults to `page-{timestamp}.pdf` if not specified.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

</details>

<!--- Tools generated by update-readme.js -->

<details>
<summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_batch_execute**
  - Title: Execute batch of browser operations
  - Description: Execute multiple browser tools in sequence with optional per-step expectations, error handling, and template variables.
  - Parameters:
    - `steps` (array): Array of browser operations to execute in sequence
    - `stopOnFirstError` (boolean, optional): Stop entire batch execution on first error (default: true)
    - `globalExpectation` (object, optional): Default expectation settings applied to all steps
    - `maxConcurrency` (number, optional): Maximum number of parallel operations (default: 1, max: 10)
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page you are currently working on
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_diagnose**
  - Title: Diagnose page
  - Description: Generate comprehensive diagnostic information about the current page state, structure, and potential issues for troubleshooting browser automation.
  - Parameters:
    - `includePerformanceMetrics` (boolean, optional): Include performance metrics and timing information
    - `includeAccessibilityInfo` (boolean, optional): Include accessibility-related information
    - `includeTroubleshootingSuggestions` (boolean, optional): Include troubleshooting suggestions
    - `useUnifiedSystem` (boolean, optional): Use unified diagnostic system for enhanced error handling
    - `enableRealTimeMonitoring` (boolean, optional): Enable real-time monitoring during diagnosis
    - `performanceThresholds` (object, optional): Custom performance thresholds
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop operation between two elements
  - Parameters:
    - `startSelectors` (array): Starting element selector strategies for the drag operation
    - `endSelectors` (array): Ending element selector strategies for the drag operation
    - `startRef` (string, optional): Exact target element reference from the page snapshot (deprecated, use startSelectors instead)
    - `startElement` (string, optional): Human-readable source element description (deprecated, use startSelectors instead)
    - `endRef` (string, optional): Exact target element reference from the page snapshot (deprecated, use endSelectors instead)
    - `endElement` (string, optional): Human-readable target element description (deprecated, use endSelectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element
  - Parameters:
    - `function` (string): () => { /* code */ } or (element) => { /* code */ } when element is provided
    - `selectors` (array, optional): Target element selector strategies. If omitted, evaluates on the page.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_execute**
  - Title: Execute browser tool
  - Description: Execute a registered action or destructive browser tool using that tool's original schema validation.
  - Parameters:
    - `tool` (string): Registered action or destructive tool name.
    - `arguments` (object, optional): Arguments validated by the target tool schema.
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files
  - Parameters:
    - `paths` (array, optional): The absolute paths to the files to upload. Can be a single file or multiple files. If omitted, the file chooser is cancelled.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_find**
  - Title: Find in accessibility snapshot
  - Description: Search the accessibility snapshot and return only matching lines with a small amount of context.
  - Parameters:
    - `query` (string): Text or regular expression source to search for.
    - `regex` (boolean, optional): Treat query as a regular expression source.
    - `caseSensitive` (boolean, optional): Use case-sensitive matching.
    - `maxResults` (number, optional): Maximum matching ranges to return.
    - `contextLines` (number, optional): Number of surrounding snapshot lines to include.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_find_elements**
  - Title: Find elements
  - Description: Find elements on the page using multiple search criteria such as text, role, tag name, or attributes. Returns matching elements sorted by confidence.
  - Parameters:
    - `searchCriteria` (object): Search criteria for finding elements
    - `maxResults` (number, optional): Maximum number of results to return
    - `includeDiagnosticInfo` (boolean, optional): Include diagnostic information about the page
    - `useUnifiedSystem` (boolean, optional): Use unified diagnostic system for enhanced error handling
    - `enableEnhancedDiscovery` (boolean, optional): Enable enhanced element discovery with contextual suggestions
    - `performanceThreshold` (number, optional): Performance threshold in milliseconds for element discovery
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog
  - Parameters:
    - `accept` (boolean): Whether to accept the dialog.
    - `promptText` (string, optional): The text of the prompt in case of a prompt dialog.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page
  - Parameters:
    - `selectors` (array): Element selector strategies to find the target element
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_inspect_html**
  - Title: Inspect HTML
  - Description: Inspect HTML structure with optional selector and depth limiting for better understanding of page structure
  - Parameters:
    - `selector` (string, optional): CSS selector to focus on specific element(s)
    - `maxDepth` (number, optional): Maximum depth to traverse (0 = element only, 1 = immediate children, etc.)
    - `includeAttributes` (boolean, optional): Include element attributes in output
    - `includeTextContent` (boolean, optional): Include text content of elements
    - `includeStyles` (boolean, optional): Include computed styles (limited set)
    - `maxElements` (number, optional): Maximum number of elements to return
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back
  - Description: Go back to the previous page
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Title: Go forward
  - Description: Go forward to the next page
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns all network requests since loading the page with advanced filtering options to reduce token usage. Enhanced Fast MCP version.
  - Parameters:
    - `includeStatic` (boolean, optional): Whether to include successful static resources like images, fonts, scripts, etc. Defaults to false.
    - `urlPatterns` (array, optional): Array of URL patterns to include (regex strings). Only requests matching at least one pattern will be included.
    - `excludeUrlPatterns` (array, optional): Array of URL patterns to exclude (regex strings). Requests matching any pattern will be excluded.
    - `methods` (array, optional): HTTP methods to include (e.g., ['GET', 'POST']). Case-insensitive.
    - `statusRanges` (array, optional): HTTP status code ranges to include (e.g., [{min: 200, max: 299}]).
    - `maxRequests` (number, optional): Maximum number of requests to return. Defaults to 50.
    - `newestFirst` (boolean, optional): Whether to return newest requests first. Defaults to false (chronological order).
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Name of the key to press or a character to generate, such as `ArrowLeft` or `a`
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_query**
  - Title: Query browser tool
  - Description: Execute a registered read-only browser tool using that tool's original schema validation.
  - Parameters:
    - `tool` (string): Registered read-only tool name.
    - `arguments` (object, optional): Arguments validated by the target tool schema.
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select an option in a dropdown
  - Parameters:
    - `selectors` (array): Element selector strategies to find the dropdown
    - `values` (array): Array of values to select in the dropdown. This can be a single value or multiple values.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of the current page, this is better than screenshot
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of the current page. You can't perform actions based on the screenshot, use browser_snapshot for actions.
  - Parameters:
    - `type` (string, optional): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.
    - `selectors` (array, optional): Element selector strategies for element screenshot. If omitted, screenshots the page.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
    - `scale` (string, optional): Use CSS pixels or device pixels for the screenshot.
    - `imageOptions` (object, optional): Image compression and resizing options for token optimization
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tools**
  - Title: Manage browser tools
  - Description: Search the registered browser-tool catalog and control the tools visible in this MCP session.
  - Parameters: None
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element
  - Parameters:
    - `selectors` (array): Element selector strategies to find the target element
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Whether to submit entered text (press Enter after)
    - `slowly` (boolean, optional): Whether to type one character at a time. Useful for triggering key handlers in the page. By default entire text is filled in at once.
    - `ref` (string, optional): Exact target element reference from the page snapshot (deprecated, use selectors instead)
    - `element` (string, optional): Human-readable element description used to obtain permission to interact with the element (deprecated, use selectors instead)
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): The time to wait in seconds
    - `text` (string, optional): The text to wait for
    - `textGone` (string, optional): The text to wait for to disappear
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

</details>

<details>
<summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Title: Close a tab
  - Description: Close a tab
  - Parameters:
    - `index` (number, optional): The index of the tab to close. Closes current tab if not provided.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Title: List tabs
  - Description: List browser tabs
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Title: Open a new tab
  - Description: Open a new tab
  - Parameters:
    - `url` (string, optional): The URL to navigate to in the new tab. If not provided, the new tab will be blank.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Title: Select a tab
  - Description: Select a tab by index
  - Parameters:
    - `index` (number): The index of the tab to select
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>Browser installation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Title: Install the browser specified in the config
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters:
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click left mouse button at a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag left mouse button to a given position
  - Parameters:
    - `startX` (number): Start X coordinate
    - `startY` (number): Start Y coordinate
    - `endX` (number): End X coordinate
    - `endY` (number): End Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to a given position
  - Parameters:
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **false**

</details>

<details>
<summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the PDF to. Defaults to `page-{timestamp}.pdf` if not specified.
    - `expectation` (object, optional): Control what is included in the response for token optimization
  - Read-only: **true**

</details>

<!--- End of tools generated section -->

### Token Optimization Examples

The Fast Server provides advanced token optimization through expectation controls and batch execution:

#### Basic Expectation Control

```json
{
  "name": "browser_navigate",
  "arguments": {
    "url": "https://example.com",
    "expectation": {
      "includeSnapshot": false,
      "includeConsole": false,
      "includeTabs": false
    }
  }
}
```

#### Expectation Options

- **`includeSnapshot`** (boolean, default: varies by tool): Include page accessibility snapshot
- **`includeConsole`** (boolean, default: varies by tool): Include browser console messages
- **`includeDownloads`** (boolean, default: true): Include download information
- **`includeTabs`** (boolean, default: varies by tool): Include tab information
- **`includeCode`** (boolean, default: true): Include executed code in response

#### Advanced Snapshot Options

```json
{
  "name": "browser_click",
  "arguments": {
    "element": "Login button",
    "ref": "#login-btn",
    "expectation": {
      "includeSnapshot": true,
      "snapshotOptions": {
        "selector": ".dashboard",
        "maxLength": 1000,
        "format": "text"
      }
    }
  }
}
```

#### Console Filtering Options

```json
{
  "name": "browser_navigate",
  "arguments": {
    "url": "https://example.com",
    "expectation": {
      "includeConsole": true,
      "consoleOptions": {
        "levels": ["error", "warn"],
        "maxMessages": 5,
        "patterns": ["^Error:"],
        "removeDuplicates": true
      }
    }
  }
}
```

### Batch Execution

Execute multiple browser actions in a single request with optimized response handling and flexible error control.

#### Basic Batch Execution

```json
{
  "name": "browser_batch_execute",
  "arguments": {
    "steps": [
      {
        "tool": "browser_navigate",
        "arguments": { "url": "https://example.com/login" }
      },
      {
        "tool": "browser_type",
        "arguments": { 
          "element": "username field", 
          "ref": "#username", 
          "text": "testuser" 
        }
      },
      {
        "tool": "browser_type",
        "arguments": { 
          "element": "password field", 
          "ref": "#password", 
          "text": "password" 
        }
      },
      {
        "tool": "browser_click",
        "arguments": { "element": "login button", "ref": "#login-btn" }
      }
    ]
  }
}
```

#### Advanced Batch Configuration

```json
{
  "name": "browser_batch_execute",
  "arguments": {
    "steps": [
      {
        "tool": "browser_navigate",
        "arguments": { "url": "https://example.com" },
        "expectation": { "includeSnapshot": false },
        "continueOnError": true
      },
      {
        "tool": "browser_click",
        "arguments": { "element": "button", "ref": "#submit" },
        "expectation": { 
          "includeSnapshot": true,
          "snapshotOptions": { "selector": ".result-area" }
        }
      }
    ],
    "stopOnFirstError": false,
    "globalExpectation": {
      "includeConsole": false,
      "includeTabs": false
    }
  }
}
```

#### Error Handling Options

- **`continueOnError`** (per step): Continue batch execution even if this step fails
- **`stopOnFirstError`** (global): Stop entire batch on first error
- Flexible combination allows for robust automation workflows

### Tool-Specific Defaults

Each tool has optimized defaults based on typical usage patterns:

- **Navigation tools** (`browser_navigate`): Include full context for verification
- **Interactive tools** (`browser_click`, `browser_type`): Include snapshot but minimal logging
- **Screenshot/snapshot tools**: Exclude additional context
- **Code evaluation**: Include console output but minimal other info
- **Wait operations**: Minimal output for efficiency

### Performance Benefits

- **Token Reduction**: 50-80% reduction in token usage with optimized expectations
- **Faster Execution**: 2-5x speed improvement with batch execution
- **Reduced Latency**: Fewer round trips between client and server
- **Cost Optimization**: Lower API costs due to reduced token consumption

### Response Diff Detection

The Fast Server includes automatic diff detection to efficiently track changes between consecutive tool executions:

```json
{
  "name": "browser_click",
  "arguments": {
    "element": "Load more button",
    "ref": "#load-more",
    "expectation": {
      "includeSnapshot": true,
      "diffOptions": {
        "enabled": true,
        "threshold": 0.1,
        "format": "unified",
        "maxDiffLines": 50,
        "context": 3
      }
    }
  }
}
```

#### Diff Detection Benefits

- **Minimal token usage**: Only changed content is shown instead of full snapshots
- **Change tracking**: Automatically detects what changed after actions
- **Flexible formats**: Choose between unified, split, or minimal diff formats
- **Smart caching**: Compares against previous response from the same tool

#### When to Use Diff Detection

1. **UI interactions without navigation**: Clicks, typing, hover effects
2. **Dynamic content updates**: Loading more items, real-time updates
3. **Form interactions**: Track changes as users fill forms
4. **Selective monitoring**: Use with CSS selectors to track specific areas

```json
{
  "name": "browser_type",
  "arguments": {
    "element": "Search input",
    "ref": "#search",
    "text": "playwright",
    "expectation": {
      "includeSnapshot": true,
      "snapshotOptions": {
        "selector": "#search-results"
      },
      "diffOptions": {
        "enabled": true,
        "format": "minimal"
      }
    }
  }
}
```

### Best Practices

1. **Use batch execution** for multi-step workflows
2. **Enable diff detection** for actions without page navigation
3. **Disable snapshots** for intermediate steps that don't need verification
4. **Use selective snapshots** with CSS selectors for large pages
5. **Filter console messages** to relevant levels only
6. **Combine global and step-specific expectations** for fine-grained control
7. **Use minimal diff format** for maximum token savings

### Diagnostic System Examples

**Find alternative elements when selectors fail:**
```json
{
  "name": "browser_find_elements",
  "arguments": {
    "searchCriteria": {
      "text": "Submit",
      "role": "button"
    },
    "maxResults": 5
  }
}
```

**Generate comprehensive page diagnostics:**
```json
{
  "name": "browser_diagnose",
  "arguments": {
    "includePerformanceMetrics": true,
    "includeAccessibilityInfo": true,
    "includeTroubleshootingSuggestions": true
  }
}
```

**Debug automation failures with enhanced errors:**
All tools automatically provide enhanced error messages with:
- Alternative element suggestions
- Page structure analysis
- Context-aware troubleshooting tips
- Performance insights

### Network Request Filtering

The `browser_network_requests` tool provides advanced filtering capabilities to reduce token usage by up to 80-95% when working with network logs.

#### Basic Usage Examples

```json
// Filter API requests only
{
  "name": "browser_network_requests",
  "arguments": {
    "urlPatterns": ["api/", "/graphql"]
  }
}

// Exclude analytics and tracking
{
  "name": "browser_network_requests", 
  "arguments": {
    "excludeUrlPatterns": ["analytics", "tracking", "ads"]
  }
}

// Success responses only
{
  "name": "browser_network_requests",
  "arguments": {
    "statusRanges": [{ "min": 200, "max": 299 }]
  }
}

// Recent errors only
{
  "name": "browser_network_requests",
  "arguments": {
    "statusRanges": [{ "min": 400, "max": 599 }],
    "maxRequests": 5,
    "newestFirst": true
  }
}
```

#### Advanced Filtering

```json
// Complex filtering for API debugging
{
  "name": "browser_network_requests",
  "arguments": {
    "urlPatterns": ["/api/users", "/api/posts"],
    "excludeUrlPatterns": ["/api/health"],
    "methods": ["GET", "POST"],
    "statusRanges": [
      { "min": 200, "max": 299 },
      { "min": 400, "max": 499 }
    ],
    "maxRequests": 10,
    "newestFirst": true
  }
}

// Monitor only failed requests
{
  "name": "browser_network_requests", 
  "arguments": {
    "statusRanges": [
      { "min": 400, "max": 499 },
      { "min": 500, "max": 599 }
    ],
    "maxRequests": 3
  }
}
```

#### Regex Pattern Support

```json
{
  "name": "browser_network_requests",
  "arguments": {
    "urlPatterns": ["^/api/v[0-9]+/users$"],
    "excludeUrlPatterns": ["\\.(css|js|png)$"]
  }
}
```

#### Token Optimization Benefits

- **Massive reduction**: 80-95% fewer tokens for large applications
- **Focused debugging**: See only relevant network activity
- **Performance monitoring**: Track specific endpoints or error patterns
- **Cost savings**: Lower API costs due to reduced token usage

#### When to Use Network Filtering

1. **API debugging**: Focus on specific endpoints and methods
2. **Error monitoring**: Track only failed requests
3. **Performance analysis**: Monitor slow or problematic endpoints  
4. **Large applications**: Reduce overwhelming network logs
5. **Token management**: Stay within LLM context limits

### Migration Guide

Existing code continues to work without changes. To optimize:

1. Start by adding `expectation: { includeSnapshot: false }` to intermediate steps
2. Use batch execution for sequences of 3+ operations
3. Gradually fine-tune expectations based on your specific needs
4. Use diagnostic tools when automation fails or needs debugging
5. Set `--tool-profile=full` before upgrading when a client depends on the complete static `tools/list` response.
