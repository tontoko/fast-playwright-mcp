import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTabTool } from './tool.js';

type SnapshotPage = {
  _snapshotForAI(): Promise<{ full: string }>;
};

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

function createMatcher(
  query: string,
  regex: boolean,
  caseSensitive: boolean
): (line: string) => boolean {
  if (!regex) {
    const needle = caseSensitive ? query : query.toLowerCase();
    return (line) =>
      (caseSensitive ? line : line.toLowerCase()).includes(needle);
  }

  let pattern: RegExp;
  try {
    pattern = new RegExp(query, caseSensitive ? 'u' : 'iu');
  } catch (error) {
    throw new Error(
      `Invalid regular expression: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
  return (line) => pattern.test(line);
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
    const snapshot = await (
      tab.page as unknown as SnapshotPage
    )._snapshotForAI();
    const lines = snapshot.full.split('\n');
    const matches = createMatcher(
      params.query,
      params.regex,
      params.caseSensitive
    );
    const ranges: LineRange[] = [];
    for (const [index, line] of lines.entries()) {
      if (!matches(line)) {
        continue;
      }
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
