import { fileURLToPath } from 'node:url';
import type {
  Resource,
  ResourceContents,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import {
  dashboardResources,
  readDashboardResource,
} from './apps/dashboard/resource.js';
import type { BrowserContextFactory } from './browser-context-factory.js';
import type { FullConfig } from './config.js';
import { Context } from './context.js';
import type * as mcpServer from './mcp/server.js';
import { Response } from './response.js';
import { SessionLog } from './session-log.js';
import { createCatalogTools } from './tools/catalog/gateways.js';
import { ToolRegistry, registerTools } from './tools/catalog/registry.js';
import { ToolVisibility } from './tools/catalog/visibility.js';
import type { AnyTool } from './tools/tool.js';
import { defineTool } from './tools/tool.js';
import { filteredTools } from './tools.js';
import { browserServerBackendDebug, logUnhandledError } from './utils/log.js';
import { packageJSON } from './utils/package.js';

type NonEmptyArray<T> = [T, ...T[]];
export type FactoryList = NonEmptyArray<BrowserContextFactory>;

const DISALLOWED_GATEWAY_TARGETS = new Set([
  'browser_tools',
  'browser_query',
  'browser_execute',
  'browser_batch_execute',
]);

type ToolListServer = mcpServer.Server & {
  sendToolListChanged?: () => Promise<void>;
};

export class BrowserServerBackend implements mcpServer.ServerBackend {
  name = 'Playwright';
  version = packageJSON.version;
  readonly supportsToolListChanges: boolean;
  readonly resources?: () => Resource[];
  readonly readResource?: (uri: string) => Promise<ResourceContents[]>;

  private readonly _registry: ToolRegistry;
  private readonly _visibility: ToolVisibility;
  private _context: Context | undefined;
  private _sessionLog: SessionLog | undefined;
  private _server: mcpServer.Server | undefined;
  private readonly _config: FullConfig;
  private _browserContextFactory: BrowserContextFactory;

  constructor(config: FullConfig, factories: FactoryList) {
    this._config = config;
    this._browserContextFactory = factories[0];
    this._visibility = new ToolVisibility(config.toolProfile);
    this.supportsToolListChanges = config.toolProfile !== 'full';
    if (config.capabilities?.includes('apps')) {
      this.resources = dashboardResources;
      this.readResource = readDashboardResource;
    }

    const baseTools = filteredTools(config);
    if (factories.length > 1) {
      baseTools.push(this._defineContextSwitchTool(factories));
    }

    let registry: ToolRegistry;
    const catalogTools = createCatalogTools({
      registry: () => registry,
      visibility: this._visibility,
      notifyChanged: () => this._notifyToolsChanged(),
      executeTarget: (name, args, expected, signal) =>
        this._executeTarget(name, args, expected, signal),
    });
    registry = new ToolRegistry([
      ...registerTools(baseTools),
      ...registerTools(catalogTools, {
        browser_tools: { group: 'bootstrap', bootstrap: true },
        browser_query: { group: 'bootstrap', bootstrap: true },
        browser_execute: { group: 'bootstrap', bootstrap: true },
      }),
    ]);
    this._registry = registry;
  }

  async initialize(server: mcpServer.Server): Promise<void> {
    this._server = server;
    const capabilities =
      server.getClientCapabilities() as mcpServer.ClientCapabilities;
    let rootPath: string | undefined;
    if (
      capabilities.roots &&
      (server.getClientVersion()?.name === 'Visual Studio Code' ||
        server.getClientVersion()?.name === 'Visual Studio Code - Insiders')
    ) {
      const { roots } = await server.listRoots();
      const firstRootUri = roots[0]?.uri;
      rootPath = firstRootUri
        ? fileURLToPath(new URL(firstRootUri))
        : undefined;
    }

    this._sessionLog = this._config.saveSession
      ? await SessionLog.create(this._config, rootPath)
      : undefined;
    this._context = new Context({
      tools: this._registry.registrations.map(({ tool }) => tool),
      config: this._config,
      browserContextFactory: this._browserContextFactory,
      sessionLog: this._sessionLog,
      clientInfo: { ...server.getClientVersion(), rootPath },
    });
  }

  tools(): mcpServer.ToolSchema[] {
    return this._visibility
      .visible(this._registry)
      .map(({ tool }) => tool.schema);
  }

  resolveTool(name: string): mcpServer.ToolSchema | undefined {
    return this._registry.get(name)?.tool.schema;
  }

  async callTool(
    schema: mcpServer.ToolSchema,
    rawArguments: Record<string, unknown> | undefined,
    signal?: AbortSignal
  ): Promise<mcpServer.ToolResponse> {
    const registration = this._registry.get(schema.name);
    if (!registration) {
      throw new Error(`Tool not found: ${schema.name}`);
    }
    return this._executeRegistration(
      registration.tool,
      rawArguments,
      signal,
      true
    );
  }

  serverClosed() {
    this._context?.dispose().catch(logUnhandledError);
  }

  private async _executeTarget(
    name: string,
    rawArguments: Record<string, unknown> | undefined,
    expected: 'readOnly' | 'action',
    signal?: AbortSignal
  ): Promise<mcpServer.ToolResponse> {
    if (DISALLOWED_GATEWAY_TARGETS.has(name)) {
      throw new Error(`Tool cannot be dispatched through a gateway: ${name}`);
    }
    const registration = this._registry.require(name);
    const effect = registration.tool.schema.type;
    if (expected === 'readOnly' && effect !== 'readOnly') {
      throw new Error(`browser_query only accepts read-only tools: ${name}`);
    }
    if (expected === 'action' && effect === 'readOnly') {
      throw new Error(`browser_execute requires an action tool: ${name}`);
    }
    return this._executeRegistration(
      registration.tool,
      rawArguments,
      signal,
      false
    );
  }

  private async _executeRegistration(
    tool: AnyTool,
    rawArguments: Record<string, unknown> | undefined,
    signal: AbortSignal | undefined,
    manageRunningState: boolean
  ): Promise<mcpServer.ToolResponse> {
    if (!this._context) {
      throw new Error('Context not initialized. Call initialize() first.');
    }

    const context = this._context;
    const parsedArguments = tool.schema.inputSchema.parse(rawArguments || {});
    const response = new Response(
      context,
      tool.schema.name,
      parsedArguments,
      parsedArguments.expectation
    );

    if (manageRunningState) {
      context.setRunningTool(true);
    }
    browserServerBackendDebug(`Executing tool: ${tool.schema.name}`);
    try {
      const rawResponse = await tool.handle(
        context,
        parsedArguments,
        response,
        signal
      );
      if (rawResponse) {
        return context.redactToolResponse(rawResponse);
      }
      await response.finish();
      this._sessionLog?.logResponse(response);
      browserServerBackendDebug(
        `Tool ${tool.schema.name} completed successfully`
      );
    } catch (error: unknown) {
      browserServerBackendDebug(
        `Error executing tool ${tool.schema.name}:`,
        error
      );
      response.addError(String(error));
    } finally {
      if (manageRunningState) {
        context.setRunningTool(false);
      }
    }
    return response.serialize();
  }

  private async _notifyToolsChanged(): Promise<void> {
    const send = (this._server as ToolListServer | undefined)
      ?.sendToolListChanged;
    if (!send) {
      return;
    }
    try {
      await send.call(this._server);
    } catch (error) {
      browserServerBackendDebug(
        'Failed to notify the client about tool-list changes:',
        error
      );
    }
  }

  private _defineContextSwitchTool(factories: FactoryList): AnyTool {
    const factoryNames = factories.map((factory) => factory.name) as [
      string,
      ...string[],
    ];
    const factoryNameSchema = z.enum(factoryNames);
    return defineTool({
      capability: 'core',
      schema: {
        name: 'browser_connect',
        title: 'Connect to a browser context',
        description: 'Switch between configured browser connection methods.',
        inputSchema: z.object({
          name: factoryNameSchema.optional(),
          method: factoryNameSchema.optional(),
        }),
        type: 'action',
      },
      handle: async (_context, params, response) => {
        if (params.name && params.method && params.name !== params.method) {
          response.addError(
            `Conflicting connection methods: name="${params.name}" and method="${params.method}"`
          );
          return;
        }
        const requestedName = params.name ?? params.method ?? factories[0].name;
        const selectedFactory = factories.find(
          (factory) => factory.name === requestedName
        );
        if (!selectedFactory) {
          response.addError(`Unknown connection method: ${requestedName}`);
          return;
        }
        await this._setContextFactory(selectedFactory);
        response.addResult('Successfully changed connection method.');
      },
    });
  }

  private async _setContextFactory(newFactory: BrowserContextFactory) {
    if (this._context) {
      const options = {
        ...this._context.options,
        browserContextFactory: newFactory,
      };
      await this._context.dispose();
      this._context = new Context(options);
    }
    this._browserContextFactory = newFactory;
  }
}
