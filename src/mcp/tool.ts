/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export type ToolSchema<Input extends z.Schema> = {
  name: string;
  title: string;
  description: string;
  inputSchema: Input;
  type: 'readOnly' | 'destructive';
};

const OMITTED_SCHEMA_KEYS = new Set(['description', '$schema']);

/**
 * Remove annotation-only prose from a JSON Schema without changing validation
 * semantics. MCP clients inject the complete tools/list response into model
 * context, so repeating every nested Zod description has a significant token
 * cost. Property names, types, required fields, enums, defaults, constraints,
 * and references are preserved.
 */
export function compactJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactJsonSchema);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const compacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (OMITTED_SCHEMA_KEYS.has(key)) {
      continue;
    }
    compacted[key] = compactJsonSchema(child);
  }
  return compacted;
}

export function toMcpTool<T extends z.Schema>(tool: ToolSchema<T>): Tool {
  const jsonSchema = zodToJsonSchema(tool.inputSchema, {
    strictUnions: true,
  });

  return {
    name: tool.name,
    description: tool.description,
    inputSchema: compactJsonSchema(jsonSchema) as Tool['inputSchema'],
    annotations: {
      title: tool.title,
      readOnlyHint: tool.type === 'readOnly',
      destructiveHint: tool.type === 'destructive',
      openWorldHint: true,
    },
  };
}
