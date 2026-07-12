import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type {
  Resource,
  ResourceContents,
  ServerCapabilities,
} from '@modelcontextprotocol/sdk/types.js';
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ManualPromise } from '../manual-promise.js';
import { logUnhandledError, mcpServerDebug } from '../utils/log.js';
import { logRequest } from '../utils/request-logger.js';
import { toMcpTool } from './tool.js';
import type { ToolResponse, ToolSchema } from './types.js';

export type { Server } from '@modelcontextprotocol/sdk/server/index.js';
export type { ToolResponse, ToolSchema } from './types.js';

const DEFAULT_PING_TIMEOUT = 5000;

export type ClientCapabilities = {
  roots?: {
    listRoots?: boolean;
  };
};

export type ToolHandler = (
  toolName: string,
  params: Record<string, unknown>
) => Promise<ToolResponse>;

export interface ServerBackend {
  name: string;
  version: string;
  supportsToolListChanges?: boolean;
  initialize?(server: Server): Promise<void>;
  tools(): ToolSchema[];
  resolveTool?(name: string): ToolSchema | undefined;
  callTool(
    schema: ToolSchema,
    rawArguments: Record<string, unknown> | undefined,
    signal?: AbortSignal
  ): Promise<ToolResponse>;
  resources?(): Resource[];
  readResource?(uri: string): Promise<ResourceContents[]>;
  serverClosed?(): void;
}

export type ServerBackendFactory = () => ServerBackend;

export async function connect(
  serverBackendFactory: ServerBackendFactory,
  transport: Transport,
  runHeartbeat: boolean
) {
  const backend = serverBackendFactory();
  const server = createServer(backend, runHeartbeat);
  await server.connect(transport);
}

export function createServer(
  backend: ServerBackend,
  runHeartbeat: boolean
): Server {
  const initializedPromise = new ManualPromise<void>();
  const listResources = backend.resources;
  const readResource = backend.readResource;
  const supportsResources = Boolean(listResources && readResource);
  const capabilities: ServerCapabilities = {
    tools: backend.supportsToolListChanges ? { listChanged: true } : {},
    ...(supportsResources ? { resources: {} } : {}),
  };
  const server = new Server(
    { name: backend.name, version: backend.version },
    { capabilities }
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: backend.tools().map((tool) => toMcpTool(tool)),
  }));

  if (listResources && readResource) {
    server.setRequestHandler(ListResourcesRequestSchema, () => ({
      resources: listResources(),
    }));
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => ({
      contents: await readResource(request.params.uri),
    }));
  }

  let heartbeatRunning = false;
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    await initializedPromise;
    if (runHeartbeat && !heartbeatRunning) {
      heartbeatRunning = true;
      startHeartbeat(server);
    }

    const errorResult = (...messages: string[]): ToolResponse => ({
      content: [
        { type: 'text', text: `### Result\n${messages.join('\n')}` },
      ],
      isError: true,
    });
    const tool =
      backend.resolveTool?.(request.params.name) ??
      backend.tools().find((candidate) => candidate.name === request.params.name);
    if (!tool) {
      return errorResult(`Error: Tool "${request.params.name}" not found`);
    }

    try {
      logRequest(request.params.name, request.params.arguments ?? {});
      return await backend.callTool(
        tool,
        request.params.arguments || {},
        extra.signal
      );
    } catch (error) {
      return errorResult(String(error));
    }
  });

  addServerListener(server, 'initialized', () => {
    backend
      .initialize?.(server)
      .then(() => initializedPromise.resolve())
      .catch(logUnhandledError);
  });
  addServerListener(server, 'close', () => backend.serverClosed?.());
  return server;
}

export function resolveHeartbeatTimeout(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PING_TIMEOUT;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed
    : DEFAULT_PING_TIMEOUT;
}

function startHeartbeat(server: Server) {
  const timeout = resolveHeartbeatTimeout(
    process.env.PLAYWRIGHT_MCP_PING_TIMEOUT_MS
  );
  if (timeout === 0) {
    return;
  }

  const beat = async () => {
    try {
      await Promise.race([
        server.ping(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('ping timeout')), timeout)
        ),
      ]);
      setTimeout(beat, 3000);
    } catch (error) {
      mcpServerDebug('Heartbeat ping failed:', error);
      try {
        await server.close();
      } catch (closeError) {
        mcpServerDebug(
          'Failed to close server after heartbeat failure:',
          closeError
        );
      }
    }
  };
  beat().catch((error) => {
    mcpServerDebug('Heartbeat initialization failed:', error);
  });
}

function addServerListener(
  server: Server,
  event: 'close' | 'initialized',
  listener: () => void
) {
  const oldListener = server[`on${event}`];
  server[`on${event}`] = () => {
    oldListener?.();
    listener();
  };
}
