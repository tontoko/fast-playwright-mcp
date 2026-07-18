import { z } from 'zod';
import { toMcpTool } from '../../mcp/tool.js';
import type { ToolResponse } from '../../mcp/types.js';
import { type AnyTool, defineTool } from '../tool.js';
import type { ToolRegistry } from './registry.js';
import { searchTools } from './search.js';
import type { ToolGroup } from './types.js';
import type { ToolVisibility } from './visibility.js';

const toolGroupSchema = z.enum([
  'bootstrap',
  'navigation',
  'interaction',
  'inspection',
  'diagnostics',
  'network',
  'storage',
  'testing',
  'devtools',
  'vision',
  'pdf',
  'apps',
]);

const catalogSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('search'),
    query: z.string().min(1).max(200),
    limit: z.number().int().min(1).max(20).optional().default(6),
    includeSchema: z.boolean().optional().default(false),
  }),
  z.object({
    action: z.literal('enable'),
    tools: z.array(z.string()).max(50).optional(),
    groups: z.array(toolGroupSchema).max(20).optional(),
  }),
  z.object({
    action: z.literal('disable'),
    tools: z.array(z.string()).max(50).optional(),
    groups: z.array(toolGroupSchema).max(20).optional(),
  }),
  z.object({ action: z.literal('reset') }),
  z.object({ action: z.literal('status') }),
]);

const dispatchSchema = z.object({
  tool: z.string().min(1),
  arguments: z.record(z.unknown()).optional().default({}),
});

export type CatalogGatewayOptions = {
  registry: () => ToolRegistry;
  visibility: ToolVisibility;
  notifyChanged: () => Promise<void>;
  executeTarget: (
    name: string,
    args: Record<string, unknown> | undefined,
    expected: 'readOnly' | 'action',
    signal?: AbortSignal
  ) => Promise<ToolResponse>;
};

function resultText(payload: unknown): ToolResponse {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
  };
}

function compareToolNames(left: string, right: string): number {
  return left.localeCompare(right);
}

function collectNames(
  registry: ToolRegistry,
  tools: readonly string[] | undefined,
  groups: readonly ToolGroup[] | undefined
): string[] {
  const names = new Set(tools ?? []);
  for (const group of groups ?? []) {
    for (const registration of registry.byGroup(group)) {
      names.add(registration.tool.schema.name);
    }
  }
  return [...names].sort(compareToolNames);
}

export function createCatalogTools(options: CatalogGatewayOptions): AnyTool[] {
  const browserTools = defineTool({
    capability: 'core',
    schema: {
      name: 'browser_tools',
      title: 'Discover browser tools',
      description:
        'Search and manage the session-visible browser tool catalog.',
      inputSchema: catalogSchema,
      type: 'action',
    },
    handle: async (_context, params, _response) => {
      const registry = options.registry();
      switch (params.action) {
        case 'search': {
          const results = searchTools(registry, params.query, params.limit).map(
            (item) => ({
              ...item,
              ...(params.includeSchema
                ? {
                    inputSchema: toMcpTool(
                      registry.require(item.name).tool.schema
                    ).inputSchema,
                  }
                : {}),
            })
          );
          return resultText({ results });
        }
        case 'enable': {
          const names = collectNames(
            registry,
            params.tools,
            params.groups as ToolGroup[] | undefined
          );
          const changed = options.visibility.enableTools(registry, names);
          if (changed) {
            await options.notifyChanged();
          }
          return resultText({
            changed,
            visibleTools: options.visibility
              .visibleNames(registry)
              .sort(compareToolNames),
          });
        }
        case 'disable': {
          const names = collectNames(
            registry,
            params.tools,
            params.groups as ToolGroup[] | undefined
          );
          const changed = options.visibility.disableTools(registry, names);
          if (changed) {
            await options.notifyChanged();
          }
          return resultText({
            changed,
            visibleTools: options.visibility
              .visibleNames(registry)
              .sort(compareToolNames),
          });
        }
        case 'reset': {
          const changed = options.visibility.reset();
          if (changed) {
            await options.notifyChanged();
          }
          return resultText({
            changed,
            visibleTools: options.visibility
              .visibleNames(registry)
              .sort(compareToolNames),
          });
        }
        case 'status':
          return resultText({
            profile: options.visibility.profile,
            visibleTools: options.visibility
              .visibleNames(registry)
              .sort(compareToolNames),
            registeredToolCount: registry.registrations.length,
          });
        default:
          throw new Error('Unsupported catalog action');
      }
    },
  });

  const browserQuery = defineTool({
    capability: 'core',
    schema: {
      name: 'browser_query',
      title: 'Run a read-only browser tool',
      description:
        'Run a registered read-only browser tool with schema validation.',
      inputSchema: dispatchSchema,
      type: 'readOnly',
    },
    handle: async (_context, params, _response, signal) =>
      options.executeTarget(params.tool, params.arguments, 'readOnly', signal),
  });

  const browserExecute = defineTool({
    capability: 'core',
    schema: {
      name: 'browser_execute',
      title: 'Run a browser action tool',
      description:
        'Run a registered action or destructive browser tool with validation.',
      inputSchema: dispatchSchema,
      type: 'action',
    },
    handle: async (_context, params, _response, signal) =>
      options.executeTarget(params.tool, params.arguments, 'action', signal),
  });

  return [browserTools, browserQuery, browserExecute];
}
