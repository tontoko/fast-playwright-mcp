import type { AnyTool } from '../tool.js';

export type ToolGroup =
  | 'bootstrap'
  | 'navigation'
  | 'interaction'
  | 'inspection'
  | 'diagnostics'
  | 'network'
  | 'storage'
  | 'testing'
  | 'devtools'
  | 'vision'
  | 'pdf'
  | 'apps';

export type UpstreamSource = {
  repository: string;
  commit: string;
  path: string;
};

export type ToolRegistration = {
  tool: AnyTool;
  group: ToolGroup;
  aliases: readonly string[];
  keywords: readonly string[];
  bootstrap: boolean;
  upstreamSource?: UpstreamSource;
};

export type RegistrationOverrides = Record<
  string,
  Partial<Omit<ToolRegistration, 'tool'>>
>;
