import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import type {
  ElementInspectionResult,
  HTMLInspectionOptions,
  HTMLInspectionResult,
} from '../types/html-inspection.js';
import { htmlInspectionOptionsSchema } from '../types/html-inspection.js';
import { HTMLInspector } from '../utilities/html-inspector.js';
import { defineTabTool } from './tool.js';

/**
 * Extended schema for the browser_inspect_html tool
 * Adds optional parameters beyond core HTML inspection options
 */
const browserInspectHtmlSchema = htmlInspectionOptionsSchema.extend({
  includeSuggestions: z
    .boolean()
    .optional()
    .default(false)
    .describe('Include CSS selector suggestions in output'),
  includeChildren: z
    .boolean()
    .optional()
    .default(true)
    .describe('Include child elements in extraction'),
  optimizeForLLM: z
    .boolean()
    .optional()
    .default(false)
    .describe('Optimize extracted HTML for LLM consumption'),
  expectation: expectationSchema
    .optional()
    .describe('Page state config (minimal for HTML inspection)'),
});

// Helper functions to reduce complexity
function formatConfiguration(
  params: z.infer<typeof browserInspectHtmlSchema>
): string {
  let text = '**Configuration:**\n';
  text += `- selectors: ${params.selectors.length} selector(s)\n`;
  text += `- depth: ${params.depth || 2}\n`;
  text += `- format: ${params.format || 'html'}\n`;
  text += `- maxSize: ${params.maxSize || 50_000} bytes\n`;
  text += `- includeAttributes: ${params.includeAttributes !== false}\n`;
  text += `- optimizeForLLM: ${params.optimizeForLLM}\n\n`;
  return text;
}

function formatTiming(timing: HTMLInspectionResult['timing']): string {
  let text = '**Timing:**\n';
  text += `- total: ${timing.totalMs}ms\n`;
  text += `- selector resolution: ${timing.selectorResolutionMs}ms\n`;
  text += `- extraction: ${timing.extractionMs}ms\n\n`;
  return text;
}

function formatStatistics(
  stats: HTMLInspectionResult['stats'],
  totalSizeBytes: number,
  truncated: boolean
): string {
  let text = '**Statistics:**\n';
  text += `- elements found: ${stats.elementsFound}\n`;
  text += `- selectors not found: ${stats.selectorsNotFound}\n`;
  text += `- average depth: ${stats.averageDepth.toFixed(1)}\n`;
  text += `- Total size: ${totalSizeBytes} bytes\n`;
  text += `- truncated: ${truncated}\n\n`;
  return text;
}

function formatElementInfo(
  index: string,
  element: ElementInspectionResult,
  includeChildren = false
): string {
  let selectorInfo = 'unknown';

  // Handle all selector types
  if ('ref' in element.matchedSelector && element.matchedSelector.ref) {
    selectorInfo = `ref=${element.matchedSelector.ref}`;
  } else if ('css' in element.matchedSelector && element.matchedSelector.css) {
    selectorInfo = element.matchedSelector.css;
  } else if (
    'role' in element.matchedSelector &&
    element.matchedSelector.role
  ) {
    selectorInfo = element.matchedSelector.role;
  } else if (
    'text' in element.matchedSelector &&
    element.matchedSelector.text
  ) {
    selectorInfo = element.matchedSelector.text;
  }

  let text = `### Element ${index} (${selectorInfo})\n`;
  text += `**Tag:** ${element.metadata.tagName}\n`;
  text += `**Size:** ${element.metadata.sizeBytes} bytes\n`;

  if (element.error) {
    text += `**Error:** ${element.error}\n\n`;
    return text;
  }

  // Add attributes if available and non-empty
  if (
    element.metadata.attributes &&
    Object.keys(element.metadata.attributes).length > 0
  ) {
    text += `**Attributes:** ${JSON.stringify(element.metadata.attributes)}\n`;
  }

  // Add HTML content in code block
  text += '\n```html\n';
  text += element.html;
  text += '\n```\n\n';

  // Add children info if available
  if (includeChildren && element.children && element.children.length > 0) {
    text += formatChildren(element.children);
  }

  return text;
}

function formatChildren(children: ElementInspectionResult[]): string {
  let text = `**Children (${children.length}):**\n`;
  for (const child of children) {
    text += `- <${child.metadata.tagName}`;
    if (child.metadata.attributes?.id) {
      text += ` id="${child.metadata.attributes.id}"`;
    }
    if (child.metadata.attributes?.class) {
      text += ` class="${child.metadata.attributes.class}"`;
    }
    text += `> (${child.metadata.sizeBytes} bytes)\n`;
  }
  text += '\n';
  return text;
}

// Helper function to format full response
function formatFullResponse(
  params: z.infer<typeof browserInspectHtmlSchema>,
  result: HTMLInspectionResult,
  suggestions: string[]
): string {
  let text = '## HTML Inspection Results\n\n';
  text += formatConfiguration(params);
  text += formatTiming(result.timing);
  text += formatStatistics(
    result.stats,
    result.totalSizeBytes,
    result.truncated
  );

  // Add extracted HTML content
  if (result.stats.elementsFound > 0) {
    text += '**Extracted HTML Content:**\n\n';
    for (const [index, element] of Object.entries(result.elements)) {
      text += formatElementInfo(index, element, params.includeChildren);
    }
  } else {
    text += '**No elements found matching the provided selectors.**\n\n';
  }

  // Add CSS selector suggestions
  if (params.includeSuggestions && suggestions.length > 0) {
    text += '**CSS Selector Suggestions:**\n';
    const limitedSuggestions = suggestions.slice(0, 10);
    for (const suggestion of limitedSuggestions) {
      text += `- ${suggestion}\n`;
    }
    text += '\n';
  }

  // Add performance and usage suggestions
  if (result.suggestions && result.suggestions.length > 0) {
    text += '**Suggestions:**\n';
    for (const suggestion of result.suggestions) {
      text += `- ${suggestion}\n`;
    }
    text += '\n';
  }

  return text;
}

// Helper function to perform inspection
async function performInspection(
  inspector: HTMLInspector,
  params: z.infer<typeof browserInspectHtmlSchema>
): Promise<{ result: HTMLInspectionResult; suggestions: string[] }> {
  const inspectionOptions: HTMLInspectionOptions = {
    selectors: params.selectors,
    depth: params.depth,
    includeStyles: params.includeStyles,
    maxSize: params.maxSize,
    format: params.format,
    includeAttributes: params.includeAttributes,
    preserveWhitespace: params.preserveWhitespace,
    excludeSelector: params.excludeSelector,
  };

  const inspectionResult = await inspector.extractHTML(inspectionOptions);
  const finalResult = params.optimizeForLLM
    ? await inspector.optimizeForLLM(inspectionResult)
    : inspectionResult;

  let suggestions: string[] = [];
  if (params.includeSuggestions) {
    const cssSuggestions = inspector.suggestCSSSelectors(finalResult);
    suggestions = cssSuggestions.map(
      (s) => `${s.selector} (confidence: ${s.confidence}) - ${s.description}`
    );
  }

  return { result: finalResult, suggestions };
}

/**
 * Browser HTML inspection tool
 * Extracts and analyzes HTML content from web pages with intelligent filtering and optimization
 */
export const browserInspectHtml = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_inspect_html',
    title: 'HTML inspection',
    description:
      'Extract filtered HTML with configurable depth, output format, size limits, and automatic truncation.',
    inputSchema: browserInspectHtmlSchema,
    type: 'readOnly',
  },
  handle: async (tab, params, response) => {
    try {
      const inspector = new HTMLInspector(tab.page);
      const { result: finalResult, suggestions } = await performInspection(
        inspector,
        params
      );

      // Format response
      const responseText = formatFullResponse(params, finalResult, suggestions);

      // Set the response content
      response.addResult(responseText);

      // Add code generation comment
      response.addCode('// HTML inspection completed');
      if (finalResult.stats.elementsFound > 0) {
        response.addCode(
          `// Extracted ${finalResult.stats.elementsFound} element(s) in ${finalResult.timing.totalMs}ms`
        );
      }

      // Add snapshot if requested in expectation
      if (params.expectation?.includeSnapshot) {
        const snapshot = await tab.captureSnapshot();
        response.setTabSnapshot(snapshot);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      response.addResult(`## HTML Inspection Error

An error occurred during HTML inspection: ${errorMessage}

**Troubleshooting:**
- Verify that the page has loaded completely
- Check that the provided selectors are valid CSS selectors or roles
- Ensure the elements exist on the current page
- Consider reducing the depth or size limits if the page is very large

Use browser_snapshot to see the current page state.`);

      response.addCode(`// HTML inspection failed: ${errorMessage}`);

      throw error;
    }
  },
});

export default [browserInspectHtml];
