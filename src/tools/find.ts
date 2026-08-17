import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { regexMatchedLineIndices } from '../utils/bounded-regex.js';
import { defineTabTool } from './tool.js';

const findSchema = z.object({
  query: z.string().min(1).max(500),
  regex: z.boolean().optional().default(false),
  caseSensitive: z.boolean().optional().default(false),
  maxResults: z.number().int().min(1).max(50).optional().default(10),
  contextLines: z.number().int().min(0).max(5).optional().default(1),
  expectation: expectationSchema.optional(),
});

type LineRange = {
  start: number;
  end: number;
};

function substringMatchedLineIndices(
  lines: readonly string[],
  query: string,
  caseSensitive: boolean
): number[] {
  const needle = caseSensitive ? query : query.toLowerCase();
  const matched: number[] = [];
  for (const [index, line] of lines.entries()) {
    const haystack = caseSensitive ? line : line.toLowerCase();
    if (haystack.includes(needle)) {
      matched.push(index);
    }
  }
  return matched;
}

function mergeRanges(ranges: LineRange[]): LineRange[] {
  const merged: LineRange[] = [];
  for (const range of ranges) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, range.end);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

function formatMatches(lines: string[], ranges: LineRange[]): string {
  return ranges
    .map((range, index) => {
      const body = lines
        .slice(range.start, range.end + 1)
        .map((line) => `  ${line}`)
        .join('\n');
      return `Match ${index + 1} (lines ${range.start + 1}-${
        range.end + 1
      }):\n${body}`;
    })
    .join('\n\n');
}

export const browserFind = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_find',
    title: 'Find in page snapshot',
    description:
      'Search the current accessibility snapshot and return compact matching context.',
    inputSchema: findSchema,
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    const snapshot = await tab.page.ariaSnapshot({ mode: 'ai' });
    const lines = snapshot.split('\n');
    const matchedIndices = params.regex
      ? await regexMatchedLineIndices(
          lines,
          params.query,
          params.caseSensitive ? 'u' : 'iu'
        )
      : substringMatchedLineIndices(lines, params.query, params.caseSensitive);
    const ranges: LineRange[] = [];
    for (const index of matchedIndices) {
      ranges.push({
        start: Math.max(0, index - params.contextLines),
        end: Math.min(lines.length - 1, index + params.contextLines),
      });
      if (ranges.length >= params.maxResults) {
        break;
      }
    }

    if (ranges.length === 0) {
      response.addResult(`No snapshot matches for: ${params.query}`);
      return;
    }
    response.addResult(formatMatches(lines, mergeRanges(ranges)));
  },
});
