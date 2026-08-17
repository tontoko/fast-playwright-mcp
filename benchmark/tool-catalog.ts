import { parseArgs } from 'node:util';
import type { ToolProfile } from '../config.js';
import { resolveConfig } from '../src/config.js';
import { toMcpTool } from '../src/mcp/tool.js';
import { ToolVisibility } from '../src/tools/catalog/visibility.js';
import { createToolRegistry } from '../src/tools.js';

export type ToolCatalogMeasurement = {
  toolCount: number;
  bytes: number;
  estimatedTokens: number;
  maxDescriptionLength: number;
  largestTools: { name: string; bytes: number }[];
};

export type ToolCatalogReport = Record<ToolProfile, ToolCatalogMeasurement>;

function measureProfile(profile: ToolProfile): ToolCatalogMeasurement {
  const config = resolveConfig({ toolProfile: profile });
  const visibility = new ToolVisibility(profile);
  const registry = createToolRegistry(config, {
    visibility,
    notifyChanged: async () => {
      // Catalog measurement has no connected client to notify.
    },
    executeTarget: async () => ({ content: [] }),
  });
  const tools = visibility
    .visible(registry)
    .map(({ tool }) => toMcpTool(tool.schema));
  const bytes = Buffer.byteLength(JSON.stringify({ tools }), 'utf8');
  const largestTools = tools
    .map((tool) => ({
      name: tool.name,
      bytes: Buffer.byteLength(JSON.stringify(tool), 'utf8'),
    }))
    .sort(
      (left, right) =>
        right.bytes - left.bytes || left.name.localeCompare(right.name)
    )
    .slice(0, 10);
  return {
    toolCount: tools.length,
    bytes,
    estimatedTokens: Math.ceil(bytes / 4),
    maxDescriptionLength: Math.max(
      0,
      ...tools.map((tool) => tool.description?.length ?? 0)
    ),
    largestTools,
  };
}

export function measureToolCatalogs(): ToolCatalogReport {
  return {
    adaptive: measureProfile('adaptive'),
    minimal: measureProfile('minimal'),
    full: measureProfile('full'),
  };
}

export function assertToolCatalogBudget(report: ToolCatalogReport): void {
  const adaptive = report.adaptive;
  if (adaptive.toolCount !== 7) {
    throw new Error(
      `Adaptive catalog must expose exactly 7 tools, got ${adaptive.toolCount}`
    );
  }
  if (adaptive.toolCount > 8) {
    throw new Error(
      `Adaptive catalog exceeds the 8-tool ceiling: ${adaptive.toolCount}`
    );
  }
  if (adaptive.bytes > 12_000) {
    throw new Error(`Adaptive catalog exceeds 12,000 bytes: ${adaptive.bytes}`);
  }
  if (adaptive.bytes > report.full.bytes * 0.25) {
    throw new Error(
      `Adaptive catalog exceeds 25% of full catalog: ${adaptive.bytes}/${report.full.bytes}`
    );
  }
  if (adaptive.maxDescriptionLength > 180) {
    throw new Error(
      `Adaptive tool description exceeds 180 characters: ${adaptive.maxDescriptionLength}`
    );
  }
}

function printReport(report: ToolCatalogReport): void {
  const lines = ['profile\ttools\tbytes\testimated tokens'];
  for (const profile of ['adaptive', 'minimal', 'full'] as const) {
    const value = report[profile];
    lines.push(
      `${profile}\t${value.toolCount}\t${value.bytes}\t${value.estimatedTokens}`
    );
  }
  lines.push('', 'Largest full-profile tools:');
  for (const item of report.full.largestTools) {
    lines.push(`${item.name}\t${item.bytes}`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
}

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      check: { type: 'boolean', default: false },
      json: { type: 'boolean', default: false },
    },
    allowPositionals: true,
  });
  const report = measureToolCatalogs();
  if (values.check) {
    assertToolCatalogBudget(report);
  }
  if (values.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    printReport(report);
  }
  process.exit(0);
}
