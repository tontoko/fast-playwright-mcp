import type {
  ImageContent,
  TextContent,
} from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';

export type ToolEffect = 'readOnly' | 'action' | 'destructive';

export type ToolResponse = {
  content: (TextContent | ImageContent)[];
  isError?: boolean;
};

export type ToolSchema<
  Input extends z.ZodTypeAny = z.ZodTypeAny,
> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: ToolEffect;
};
