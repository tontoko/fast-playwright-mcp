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
import type { ToolSchema } from './types.js';

export type { ToolEffect, ToolSchema } from './types.js';

const OMITTED_SCHEMA_KEYS = new Set(['description', '$schema']);
const SCHEMA_MAP_KEYS = new Set([
  '$defs',
  'definitions',
  'dependentSchemas',
  'patternProperties',
  'properties',
]);
const SCHEMA_ARRAY_KEYS = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);
const SCHEMA_VALUE_KEYS = new Set([
  'additionalItems',
  'additionalProperties',
  'contains',
  'contentSchema',
  'else',
  'if',
  'items',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
]);
const mcpToolCache = new WeakMap<object, Tool>();

function compactSchemaMap(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, schema]) => [
      key,
      compactJsonSchema(schema),
    ])
  );
}

function compactDependencies(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, dependency]) => [
      key,
      Array.isArray(dependency) ? dependency : compactJsonSchema(dependency),
    ])
  );
}

function compactSchemaValue(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(compactJsonSchema)
    : compactJsonSchema(value);
}

export function compactJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(compactJsonSchema);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const compacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    if (OMITTED_SCHEMA_KEYS.has(key) && typeof child === 'string') {
      continue;
    }
    if (SCHEMA_MAP_KEYS.has(key)) {
      compacted[key] = compactSchemaMap(child);
    } else if (SCHEMA_ARRAY_KEYS.has(key) || SCHEMA_VALUE_KEYS.has(key)) {
      compacted[key] = compactSchemaValue(child);
    } else if (key === 'dependencies') {
      compacted[key] = compactDependencies(child);
    } else {
      compacted[key] = child;
    }
  }
  return compacted;
}

export function toMcpTool<T extends z.Schema>(tool: ToolSchema<T>): Tool {
  const cached = mcpToolCache.get(tool);
  if (cached) {
    return cached;
  }

  const jsonSchema = zodToJsonSchema(tool.inputSchema, {
    strictUnions: true,
  });
  const result = Object.freeze({
    name: tool.name,
    description: tool.description,
    inputSchema: compactJsonSchema(jsonSchema) as Tool['inputSchema'],
    annotations: {
      title: tool.title,
      readOnlyHint: tool.type === 'readOnly',
      destructiveHint: tool.type === 'destructive',
      openWorldHint: true,
    },
  }) as Tool;
  mcpToolCache.set(tool, result);
  return result;
}
