from pathlib import Path


def replace_once(path: str, old: str, new: str, label: str) -> None:
    target = Path(path)
    text = target.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit(
            f"{path}: expected exactly one {label} marker, found {count}"
        )
    target.write_text(text.replace(old, new, 1), encoding="utf-8")


replace_once(
    "src/config.ts",
    """const AUTOMATION_CONTROLLED_ARG =
  '--disable-blink-features=AutomationControlled';
""",
    """const AUTOMATION_CONTROLLED_ARG =
  '--disable-blink-features=AutomationControlled';
const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+\\-.^_`|~0-9A-Za-z]+$/u;
""",
    "header-name constant",
)
replace_once(
    "src/config.ts",
    """function resolveCdpHeaders(
  cliOptions: CLIOptions
): Record<string, string> | undefined {
  if (!(cliOptions.cdpHeaders || cliOptions.cdpHeader)) {
    return;
  }
  return {
    ...cliOptions.cdpHeaders,
    ...cliOptions.cdpHeader,
  };
}
""",
    """function containsForbiddenHeaderValueCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === 0 || codePoint === 10 || codePoint === 13) {
      return true;
    }
  }
  return false;
}

function validateHeader(name: string, value: string): void {
  if (
    !HTTP_HEADER_NAME_PATTERN.test(name) ||
    !value ||
    containsForbiddenHeaderValueCharacter(value)
  ) {
    throw new Error(`Invalid header: ${name}`);
  }
}

function validateHeaders(
  headers: Record<string, string> | undefined
): Record<string, string> | undefined {
  if (!headers || Object.keys(headers).length === 0) {
    return;
  }
  for (const [name, value] of Object.entries(headers)) {
    validateHeader(name, value);
  }
  return { ...headers };
}

function resolveCdpHeaders(
  cliOptions: CLIOptions
): Record<string, string> | undefined {
  return validateHeaders({
    ...cliOptions.cdpHeaders,
    ...cliOptions.cdpHeader,
  });
}
""",
    "CDP header resolver",
)
replace_once(
    "src/config.ts",
    """    cdpHeaders: {
      ...base.browser.cdpHeaders,
      ...overrides.browser?.cdpHeaders,
    },
""",
    """    cdpHeaders: validateHeaders({
      ...base.browser.cdpHeaders,
      ...overrides.browser?.cdpHeaders,
    }),
""",
    "merged CDP headers",
)
replace_once(
    "src/config.ts",
    """  if (!(name && headerValue)) {
    throw new Error(`Invalid header: ${value}`);
  }
  return { ...previous, [name]: headerValue };
""",
    """  if (!(name && headerValue)) {
    throw new Error(`Invalid header: ${value}`);
  }
  validateHeader(name, headerValue);
  return { ...previous, [name]: headerValue };
""",
    "header parser validation",
)

replace_once(
    "src/context.ts",
    "import type { ToolResponse } from './mcp/types.js';\n",
    "import type { ToolResponse } from './mcp/types.js';\nimport { originRoutePattern } from './network-origin.js';\n",
    "network-origin import",
)
context = Path("src/context.ts")
context_text = context.read_text(encoding="utf-8")
route_marker = "context.route(`*://${origin}/**`,"
if context_text.count(route_marker) != 2:
    raise SystemExit(
        "src/context.ts: expected two origin route markers, "
        f"found {context_text.count(route_marker)}"
    )
context.write_text(
    context_text.replace(route_marker, "context.route(originRoutePattern(origin),"),
    encoding="utf-8",
)

replace_once(
    "src/tab.ts",
    """      let ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
      // Apply selector filtering if specified
      if (selector) {
        ariaSnapshot = this._filterAriaSnapshotBySelector(
          ariaSnapshot,
          selector
        );
      }
""",
    """      let ariaSnapshot: string;
      if (selector) {
        const locator = this.page.locator(selector);
        if (await locator.count()) {
          ariaSnapshot = await locator.first().ariaSnapshot();
        } else {
          snapshotDebug(
            'Selector "%s" not found, returning full snapshot',
            selector
          );
          ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
        }
      } else {
        ariaSnapshot = await this.page.ariaSnapshot({ mode: 'ai' });
      }
""",
    "partial snapshot implementation",
)
tab = Path("src/tab.ts")
tab_text = tab.read_text(encoding="utf-8")
start = tab_text.find("  private _filterAriaSnapshotBySelector(")
end = tab_text.find("  private _truncateAtWordBoundary(", start)
if start < 0 or end < 0:
    raise SystemExit("src/tab.ts: partial snapshot legacy helper markers not found")
tab.write_text(tab_text[:start] + tab_text[end:], encoding="utf-8")

replace_once(
    "utils/update-readme.js",
    """  pdf: 'PDF generation (opt-in via --caps=pdf)',
};
""",
    """  pdf: 'PDF generation (opt-in via --caps=pdf)',
  apps: 'MCP Apps dashboard (opt-in via --caps=apps)',
};
""",
    "apps capability",
)
replace_once(
    "utils/update-readme.js",
    """  const startMarker = `<!--- Tools generated by ${filename} -->`;
  const endMarker = '<!--- End of tools generated section -->';
  return updateSection(content, startMarker, endMarker, generatedLines);
}
""",
    """  const startMarker = `<!--- Tools generated by ${filename} -->`;
  const endMarker = '<!--- End of tools generated section -->';
  const toolsHeading = '### Tools';
  const toolsHeadingIndex = content.indexOf(toolsHeading);
  const startMarkerIndex = content.indexOf(startMarker);
  if (
    toolsHeadingIndex === -1 ||
    startMarkerIndex === -1 ||
    startMarkerIndex < toolsHeadingIndex
  ) {
    throw new Error('README tools heading or generated marker not found');
  }
  const normalizedContent = [
    content.slice(0, toolsHeadingIndex + toolsHeading.length),
    '',
    content.slice(startMarkerIndex),
  ].join('\\n');
  return updateSection(
    normalizedContent,
    startMarker,
    endMarker,
    generatedLines
  );
}
""",
    "authoritative tools section",
)
replace_once(
    "utils/update-readme.js",
    """  if (result.error) {
    throw new Error(`Failed to execute command: ${result.error.message}`);
  }

  const output = result.stdout;
""",
    """  if (result.error) {
    throw new Error(`Failed to execute command: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(
      `CLI help command failed (${result.status}): ${result.stderr.toString()}`
    );
  }

  const output = result.stdout;
""",
    "CLI status check",
)
replace_once(
    "README.md",
    "await connection.sever.connect(transport);",
    "await connection.connect(transport);",
    "programmatic API typo",
)
