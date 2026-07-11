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

### Configuration

Playwright MCP server supports following arguments. They can be provided in the JSON configuration above, as a part of the `"args"` list:

<!--- Options generated by update-readme.js -->

```
> npx @tontoko/fast-playwright-mcp@latest --help
  --allowed-origins <origins>  semicolon-separated list of origins to allow the
                               browser to request. Default is to allow all.
  --blocked-origins <origins>  semicolon-separated list of origins to block the
                               browser from requesting. Blocklist is evaluated
                               before allowlist. If used without the allowlist,
                               requests not matching the blocklist are still
                               allowed.
  --block-service-workers      block service workers
  --browser <browser>          browser or chrome channel to use, possible
                               values: chrome, firefox, webkit, msedge.
  --caps <caps>                comma-separated list of additional capabilities
                               to enable, possible values: vision, pdf.
  --cdp-endpoint <endpoint>    CDP endpoint to connect to.
  --config <path>              path to the configuration file.
  --device <device>            device to emulate, for example: "iPhone 15"
  --executable-path <path>     path to the browser executable.
  --headless                   run browser in headless mode, headed by default
  --host <host>                host to bind server to. Default is localhost. Use
                               0.0.0.0 to bind to all interfaces.
  --ignore-https-errors        ignore https errors
  --isolated                   keep the browser profile in memory, do not save
                               it to disk.
  --image-responses <mode>     whether to send image responses to the client.
                               Can be "allow" or "omit", Defaults to "allow".
  --no-sandbox                 disable the sandbox for all process types that
                               are normally sandboxed.
  --output-dir <path>          path to the directory for output files.
  --port <port>                port to listen on for SSE transport.
  --proxy-bypass <bypass>      comma-separated domains to bypass proxy, for
                               example ".com,chromium.org,.domain.com"
  --proxy-server <proxy>       specify proxy server, for example
                               "http://myproxy:3128" or "socks5://myproxy:8080"
  --save-session               Whether to save the Playwright MCP session into
                               the output directory.
  --save-trace                 Whether to save the Playwright Trace of the
                               session into the output directory.
  --storage-state <path>       path to the storage state file for isolated
                               sessions.
  --user-agent <ua string>     specify user agent string
  --user-data-dir <path>       path to the user data directory. If not
                               specified, a temporary directory will be created.
  --viewport-size <size>       specify browser viewport size in pixels, for
                               example "1280, 720"
```

<!--- End of options generated section -->

For third-party browser binaries, compatibility guidance, and a Firefox example, see [Custom browser executables](./CUSTOM_BROWSER_EXECUTABLES.md).

### User profile

You can run Playwright MCP with persistent profile like a regular browser (default), in isolated contexts for testing sessions, or connect to your existing browser using the browser extension.

**Persistent profile**

All the logged in information will be stored in the persistent profile, you can delete it between sessions if you'd like to clear the offline state.
Persistent profile is located at the following locations and you can override it with the `--user-data-dir` argument.

```bash
# Windows
%USERPROFILE%\AppData\Local\ms-playwright\mcp-{channel}-profile

# macOS
- ~/Library/Caches/ms-playwright/mcp-{channel}-profile

# Linux
- ~/.cache/ms-playwright/mcp-{channel}-profile
```

**Isolated**

In the isolated mode, each session is started in the isolated profile. Every time you ask MCP to close the browser,
the session is closed and all the storage state for this session is lost. You can provide initial storage state
to the browser via the config's `contextOptions` or via the `--storage-state` argument. Learn more about the storage
state [here](https://playwright.dev/docs/auth).

```js
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": [
        "@tontoko/fast-playwright-mcp@latest",
        "--isolated",
        "--storage-state={path/to/storage.json}"
      ]
    }
  }
}
```

**Browser Extension**

The Playwright MCP Chrome Extension allows you to connect to existing browser tabs and leverage your logged-in sessions and browser state. See [extension/README.md](extension/README.md) for installation and setup instructions.

### Configuration file

The Playwright MCP server can be configured using a JSON configuration file. You can specify the configuration file
using the `--config` command line option:

```bash
npx @tontoko/fast-playwright-mcp@latest --config path/to/config.json
```

<details>
<summary>Configuration file schema</summary>

```typescript
{
  // Browser configuration
  browser?: {
    // Browser type to use (chromium, firefox, or webkit)
    browserName?: 'chromium' | 'firefox' | 'webkit';

    // Keep the browser profile in memory, do not save it to disk.
    isolated?: boolean;

    // Path to user data directory for browser profile persistence
    userDataDir?: string;

    // Browser launch options (see Playwright docs)
    // @see https://playwright.dev/docs/api/class-browsertype#browser-type-launch
    launchOptions?: {
      channel?: string;        // Browser channel (e.g. 'chrome')
      headless?: boolean;      // Run in headless mode
      executablePath?: string; // Path to browser executable
      // ... other Playwright launch options
    };

    // Browser context options
    // @see https://playwright.dev/docs/api/class-browser#browser-new-context
    contextOptions?: {
      viewport?: { width: number, height: number };
      // ... other Playwright context options
    };

    // CDP endpoint for connecting to existing browser
    cdpEndpoint?: string;

    // Remote Playwright server endpoint
    remoteEndpoint?: string;
  },

  // Server configuration
  server?: {
    port?: number;  // Port to listen on
    host?: string;  // Host to bind to (default: localhost)
  },

  // List of additional capabilities
  capabilities?: Array<
    'tabs' |    // Tab management
    'install' | // Browser installation
    'pdf' |     // PDF generation
    'vision' |  // Coordinate-based interactions
  >;

  // Directory for output files
  outputDir?: string;

  // Network configuration
  network?: {
    // List of origins to allow the browser to request. Default is to allow all. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    allowedOrigins?: string[];

    // List of origins to block the browser to request. Origins matching both `allowedOrigins` and `blockedOrigins` will be blocked.
    blockedOrigins?: string[];
  };
 
  /**
   * Whether to send image responses to the client. Can be "allow" or "omit". 
   * Defaults to "allow".
   */
  imageResponses?: 'allow' | 'omit';
}
```
</details>

### Standalone MCP server

When running headed browser on system w/o display or from worker processes of the IDEs,
run the MCP server from environment with the DISPLAY and pass the `--port` flag to enable HTTP transport.

```bash
npx @tontoko/fast-playwright-mcp@latest --port 8931
```

And then in MCP client config, set the `url` to the HTTP endpoint:

```js
{
  "mcpServers": {
    "playwright": {
      "url": "http://localhost:8931/mcp"
    }
  }
}
```

<details>
<summary><b>Docker</b></summary>

**NOTE:** The Docker implementation only supports headless chromium at the moment.

```js
{
  "mcpServers": {
    "playwright": {
      "command": "docker",
      "args": ["run", "-i", "--rm", "--init", "--pull=always", "mcr.microsoft.com/playwright/mcp"]
    }
  }
}
```

You can build the Docker image yourself.

```
docker build -t mcr.microsoft.com/playwright/mcp .
```
</details>

<details>
<summary><b>Programmatic usage</b></summary>

```js
import http from 'http';

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
</details>

### Tools

<!--- Tools generated by update-readme.js -->

<details><summary><b>Core automation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_batch_execute**
  - Title: Batch Execute Browser Actions
  - Description: Execute multiple browser actions in sequence. PREFER over individual tools for 2+ operations.
  - Parameters:
    - `steps` (array): Array of steps to execute in sequence. Recommended for form filling (multiple type→click), multi-step navigation, any workflow with 2+ known steps. Saves 90% tokens vs individual calls. Example: [{tool:"browser_navigate",arguments:{url:"https://example.com"}},{tool:"browser_type",arguments:{selectors:[{css:"#user"}],text:"john"}},{tool:"browser_click",arguments:{selectors:[{css:"#btn"}]}}]
    - `stopOnFirstError` (boolean, optional): Stop entire batch on first error
    - `globalExpectation` (optional): Default expectation for all steps. Recommended: {includeSnapshot:false,snapshotOptions:{selector:"#app"},diffOptions:{enabled:true}}. Per-step override with steps[].expectation
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_click**
  - Title: Perform click on web page
  - Description: Perform click on web page
  - Parameters:
    - `selectors` (array): Array of element selectors (max 5). Selectors are tried in order until one succeeds (fallback mechanism). Multiple matches trigger an error with candidate list. Supports: ref (highest priority), CSS (#id, .class, tag), role (button, textbox, etc.), text content. Example: [{css: "#submit"}, {role: "button", text: "Submit"}] - tries ID first, falls back to role+text
    - `doubleClick` (boolean, optional): Double-click if true
    - `button` (string, optional): Mouse button (default: left)
    - `expectation` (object, optional): Page state capture config. Use batch_execute for multi-clicks
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_close**
  - Title: Close browser
  - Description: Close the page
  - Parameters: None
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_console_messages**
  - Title: Get console messages
  - Description: Returns all console messages
  - Parameters:
    - `consoleOptions` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_diagnose**
  - Title: Diagnose page
  - Description: Analyze page complexity and performance characteristics. Reports on: iframe count, DOM size, modal states, element statistics. Use for: debugging slow pages, understanding page structure, or monitoring page complexity.
  - Parameters:
    - `searchForElements` (object, optional): Search for specific elements and include them in the report
    - `includePerformanceMetrics` (boolean, optional): Include performance metrics in the report
    - `includeAccessibilityInfo` (boolean, optional): Include accessibility information
    - `includeTroubleshootingSuggestions` (boolean, optional): Include troubleshooting suggestions
    - `diagnosticLevel` (string, optional): Level of diagnostic detail: none (no diagnostics), basic (critical only), standard (default), detailed (with metrics), full (all info)
    - `useParallelAnalysis` (boolean, optional): Use Phase 2 parallel analysis for improved performance and resource monitoring
    - `useUnifiedSystem` (boolean, optional): Use Phase 3 unified diagnostic system with enhanced error handling and monitoring
    - `configOverrides` (object, optional): Runtime configuration overrides for diagnostic system
    - `includeSystemStats` (boolean, optional): Include unified system statistics and health information
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_drag**
  - Title: Drag mouse
  - Description: Perform drag and drop between two elements
  - Parameters:
    - `startSelectors` (array): Source element selectors for drag start
    - `endSelectors` (array): Target element selectors for drag end
    - `expectation` (object, optional): Page state after drag. Use batch_execute for workflows
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_evaluate**
  - Title: Evaluate JavaScript
  - Description: Evaluate JavaScript expression on page or element and return result
  - Parameters:
    - `function` (string): JS function: () => {...} or (element) => {...}
    - `selectors` (array, optional): Optional element selectors. If provided, function receives element as parameter
    - `expectation` (object, optional): Page state config. false for data extraction, true for DOM changes
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_file_upload**
  - Title: Upload files
  - Description: Upload one or multiple files to file input
  - Parameters:
    - `paths` (array): Absolute paths to upload (array)
    - `expectation` (object, optional): Page state config. Use batch_execute for click→upload
  - Read-only: **false**

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
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_handle_dialog**
  - Title: Handle a dialog
  - Description: Handle a dialog (alert, confirm, prompt)
  - Parameters:
    - `accept` (boolean): Accept (true) or dismiss (false)
    - `promptText` (string, optional): Text for prompt dialogs
    - `expectation` (object, optional): Page state after dialog. Use batch_execute for workflows
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_hover**
  - Title: Hover mouse
  - Description: Hover over element on page
  - Parameters:
    - `selectors` (array): Array of element selectors (max 5). Selectors are tried in order until one succeeds (fallback mechanism). Multiple matches trigger an error with candidate list. Supports: ref (highest priority), CSS (#id, .class, tag), role (button, textbox, etc.), text content. Example: [{css: "#submit"}, {role: "button", text: "Submit"}] - tries ID first, falls back to role+text
    - `expectation` (object, optional): Page state after hover. Use batch_execute for hover→click
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_inspect_html**
  - Title: HTML inspection
  - Description: Extract and analyze HTML content from web pages with intelligent filtering and size control. Optimized for LLM consumption with configurable depth, format options, and automatic truncation.
  - Parameters:
    - `selectors` (array): Array of element selectors to inspect
    - `depth` (number, optional): Maximum hierarchy depth to extract
    - `includeStyles` (boolean, optional): Include computed CSS styles
    - `maxSize` (number, optional): Maximum size in bytes (1KB-500KB)
    - `format` (string, optional): Output format
    - `includeAttributes` (boolean, optional): Include element attributes
    - `preserveWhitespace` (boolean, optional): Preserve whitespace in content
    - `excludeSelector` (string, optional): CSS selector to exclude elements
    - `includeSuggestions` (boolean, optional): Include CSS selector suggestions in output
    - `includeChildren` (boolean, optional): Include child elements in extraction
    - `optimizeForLLM` (boolean, optional): Optimize extracted HTML for LLM consumption
    - `expectation` (object, optional): Page state config (minimal for HTML inspection)
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate**
  - Title: Navigate to a URL
  - Description: Navigate to a URL
  - Parameters:
    - `url` (string): The URL to navigate to
    - `expectation` (object, optional): Page state after navigation
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_back**
  - Title: Go back to previous page
  - Description: Go back to previous page
  - Parameters:
    - `expectation` (object, optional): Page state after going back
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_navigate_forward**
  - Title: Go forward to next page
  - Description: Go forward to next page
  - Parameters:
    - `expectation` (object, optional): Page state after going forward
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_network_requests**
  - Title: List network requests
  - Description: Returns network requests since loading the page with optional filtering
  - Parameters:
    - `urlPatterns` (array, optional): URL patterns to filter (supports regex)
    - `excludeUrlPatterns` (array, optional): URL patterns to exclude (takes precedence)
    - `statusRanges` (array, optional): Status code ranges (e.g., [{min:200,max:299}])
    - `methods` (array, optional): HTTP methods to filter
    - `maxRequests` (number, optional): Max requests to return (default: 20)
    - `newestFirst` (boolean, optional): Order by timestamp (default: newest first)
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_press_key**
  - Title: Press a key
  - Description: Press a key on the keyboard
  - Parameters:
    - `key` (string): Key to press
    - `expectation` (object, optional): Page state config. Use batch_execute for multiple keys
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_resize**
  - Title: Resize browser window
  - Description: Resize the browser window
  - Parameters:
    - `width` (number): Width of the browser window
    - `height` (number): Height of the browser window
    - `expectation` (object, optional): undefined
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_select_option**
  - Title: Select option
  - Description: Select option in dropdown
  - Parameters:
    - `selectors` (array): Array of element selectors (max 5). Selectors are tried in order until one succeeds (fallback mechanism). Multiple matches trigger an error with candidate list. Supports: ref (highest priority), CSS (#id, .class, tag), role (button, textbox, etc.), text content. Example: [{css: "#submit"}, {role: "button", text: "Submit"}] - tries ID first, falls back to role+text
    - `values` (array): Values to select (array)
    - `expectation` (object, optional): Page state after selection. Use batch_execute for forms
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_snapshot**
  - Title: Page snapshot
  - Description: Capture accessibility snapshot of current page
  - Parameters:
    - `expectation` (object, optional): Page state config
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_take_screenshot**
  - Title: Take a screenshot
  - Description: Take a screenshot of current page and return image data
  - Parameters:
    - `type` (string, optional): Image format for the screenshot. Default is png.
    - `filename` (string, optional): File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.
    - `selectors` (array, optional): Optional element selectors for element screenshots. If not provided, viewport screenshot will be taken.
    - `fullPage` (boolean, optional): When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.
    - `expectation` (object, optional): Additional page state config
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_type**
  - Title: Type text
  - Description: Type text into editable element
  - Parameters:
    - `selectors` (array): Array of element selectors (max 5) supporting ref, role, CSS, or text-based selection
    - `text` (string): Text to type into the element
    - `submit` (boolean, optional): Press Enter after typing if true
    - `slowly` (boolean, optional): Type slowly for auto-complete if true
    - `expectation` (object, optional): Page state config. Use batch_execute for forms
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_wait_for**
  - Title: Wait for
  - Description: Wait for text to appear or disappear or a specified time to pass
  - Parameters:
    - `time` (number, optional): Wait time in seconds
    - `text` (string, optional): undefined
    - `textGone` (string, optional): undefined
    - `expectation` (object, optional): Page state after wait
  - Read-only: **true**

</details>

<details><summary><b>Tab management</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_close**
  - Title: Close a tab
  - Description: Close a tab by index or close current tab
  - Parameters:
    - `index` (number, optional): Tab index to close (omit for current)
    - `expectation` (object, optional): Page state after close
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_list**
  - Title: List tabs
  - Description: List browser tabs with titles and URLs
  - Parameters:
    - `expectation` (object, optional): Page state config
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_new**
  - Title: Open a new tab
  - Description: Open a new tab
  - Parameters:
    - `url` (string, optional): URL for new tab (optional)
    - `expectation` (object, optional): Page state of new tab
  - Read-only: **true**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_tab_select**
  - Title: Select a tab
  - Description: Select a tab by index
  - Parameters:
    - `index` (number): The index of the tab to select
    - `expectation` (object, optional): Page state after tab switch
  - Read-only: **true**

</details>

<details><summary><b>Browser installation</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_install**
  - Title: Install the browser specified in the config
  - Description: Install the browser specified in the config. Call this if you get an error about the browser not being installed.
  - Parameters: None
  - Read-only: **false**

</details>

<details><summary><b>Coordinate-based (opt-in via --caps=vision)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_click_xy**
  - Title: Click
  - Description: Click at specific coordinates
  - Parameters:
    - `element` (string): undefined
    - `x` (number): X coordinate (requires --caps=vision)
    - `y` (number): Y coordinate (requires --caps=vision)
    - `expectation` (object, optional): Page state after click. Prefer element ref over coords
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_drag_xy**
  - Title: Drag mouse
  - Description: Drag from one coordinate to another
  - Parameters:
    - `element` (string): undefined
    - `startX` (number): Start X (requires --caps=vision)
    - `startY` (number): Start Y (requires --caps=vision)
    - `endX` (number): End X
    - `endY` (number): End Y
    - `expectation` (object, optional): Page state after drag. Prefer element refs over coords
  - Read-only: **false**

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_mouse_move_xy**
  - Title: Move mouse
  - Description: Move mouse to specific coordinates.Requires --caps=vision.x,y:coordinates.expectation:{includeSnapshot:false} for simple move,true to see hover effects.PREFER element-based interactions over coordinates when possible.
  - Parameters:
    - `element` (string): undefined
    - `x` (number): X coordinate
    - `y` (number): Y coordinate
    - `expectation` (object, optional): undefined
  - Read-only: **true**

</details>

<details><summary><b>PDF generation (opt-in via --caps=pdf)</b></summary>

<!-- NOTE: This has been generated via update-readme.js -->

- **browser_pdf_save**
  - Title: Save as PDF
  - Description: Save page as PDF
  - Parameters:
    - `filename` (string, optional): File name to save the pdf to. Defaults to `page-{timestamp}.pdf` if not specified.
  - Read-only: **true**

</details>


<!--- End of tools generated section -->

## Token Optimization Features

Playwright MCP server includes advanced token optimization features to reduce token usage and improve performance through response filtering and batch execution.

### Response Filtering with Expectation Parameter

All browser tools support an optional `expectation` parameter that controls what information is included in the response. This can significantly reduce token usage by excluding unnecessary data.

#### Basic Usage

```json
// Standard call - includes all information (snapshot, console, tabs, etc.)
{
  "name": "browser_navigate",
  "arguments": {
    "url": "https://example.com"
  }
}

// Optimized call - only includes essential information
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
