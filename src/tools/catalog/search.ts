import type { ToolEffect } from '../../mcp/types.js';
import type { ToolRegistry } from './registry.js';
import type { ToolGroup, ToolRegistration } from './types.js';

export type ToolSearchResult = {
  name: string;
  title: string;
  summary: string;
  group: ToolGroup;
  type: ToolEffect;
  score: number;
};

const GATEWAY_NAMES = new Set([
  'browser_tools',
  'browser_query',
  'browser_execute',
]);

function score(registration: ToolRegistration, query: string): number {
  const name = registration.tool.schema.name.toLowerCase();
  const title = registration.tool.schema.title.toLowerCase();
  const description = registration.tool.schema.description.toLowerCase();
  if (name === query) {
    return 100;
  }
  if (registration.aliases.some((alias) => alias === query)) {
    return 90;
  }
  if (name.includes(query)) {
    return 70;
  }
  if (registration.aliases.some((alias) => alias.includes(query))) {
    return 60;
  }
  if (title.includes(query)) {
    return 50;
  }
  if (registration.keywords.some((keyword) => keyword === query)) {
    return 30;
  }
  if (description.includes(query)) {
    return 10;
  }
  return 0;
}

export function searchTools(
  registry: ToolRegistry,
  rawQuery: string,
  limit = 6
): ToolSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) {
    return [];
  }
  return registry.registrations
    .filter(
      ({ tool }) =>
        !GATEWAY_NAMES.has(tool.schema.name) || tool.schema.name === query
    )
    .map((registration) => ({
      registration,
      score: score(registration, query),
    }))
    .filter(({ score: value }) => value > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.registration.tool.schema.name.localeCompare(
          right.registration.tool.schema.name
        )
    )
    .slice(0, Math.max(1, Math.min(limit, 20)))
    .map(({ registration, score: value }) => ({
      name: registration.tool.schema.name,
      title: registration.tool.schema.title,
      summary: registration.tool.schema.description,
      group: registration.group,
      type: registration.tool.schema.type,
      score: value,
    }));
}
