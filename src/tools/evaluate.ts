import type * as playwright from 'playwright';
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { elementSelectorSchema } from '../types/selectors.js';
import { quote } from '../utils/codegen.js';
import { defineTabTool } from './tool.js';
import { generateLocator } from './utils.js';

// Enhanced selector schema for browser tools
const selectorsSchema = z
  .array(elementSelectorSchema)
  .min(1)
  .max(5)
  .describe(
    'Array of element selectors (max 5) supporting ref, role, CSS, or text-based selection'
  );

const evaluateSchema = z.object({
  function: z
    .string()
    .describe('JS function: () => {...} or (element) => {...}'),
  selectors: selectorsSchema
    .optional()
    .describe(
      'Optional element selectors. If provided, function receives element as parameter'
    ),
  expectation: expectationSchema.describe(
    'Page state config. false for data extraction, true for DOM changes'
  ),
});
const evaluate = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_evaluate',
    title: 'Evaluate JavaScript',
    description:
      'Evaluate JavaScript expression on page or element and return result',
    inputSchema: evaluateSchema,
    type: 'action',
  },
  handle: async (tab, params, response) => {
    let locator: playwright.Locator | undefined;

    if (params.selectors && params.selectors.length > 0) {
      const resolutionResults = await tab.resolveElementLocators(
        params.selectors
      );
      const successfulResults = resolutionResults.filter(
        (r) => r.locator && !r.error
      );

      if (successfulResults.length === 0) {
        const errors = resolutionResults
          .map((r) => r.error || 'Unknown error')
          .join(', ');
        throw new Error(`Failed to resolve element selectors: ${errors}`);
      }

      locator = successfulResults[0].locator;
      response.addCode(
        `await page.${await generateLocator(locator)}.evaluate(${quote(params.function)});`
      );
    } else {
      response.addCode(`await page.evaluate(${quote(params.function)});`);
    }

    await tab.waitForCompletion(async () => {
      try {
        const expression = params.function;
        const evalResult = locator
          ? await locator.evaluate(async (element, source) => {
              // biome-ignore lint/security/noGlobalEval: evaluating explicit user-provided browser tool input is this tool's purpose.
              const value = eval(`(${source})`);
              const isFunction = typeof value === 'function';
              const result = await (isFunction ? value(element) : value);
              return { result, isFunction };
            }, expression)
          : await tab.page.evaluate(async (source) => {
              // biome-ignore lint/security/noGlobalEval: evaluating explicit user-provided browser tool input is this tool's purpose.
              const value = eval(`(${source})`);
              const isFunction = typeof value === 'function';
              const result = await (isFunction ? value() : value);
              return { result, isFunction };
            }, expression);

        const codeExpression = evalResult.isFunction
          ? expression
          : `() => (${expression})`;
        if (locator) {
          response.addCode(
            `await page.${await generateLocator(locator)}.evaluate(${quote(codeExpression)});`
          );
        } else {
          response.addCode(`await page.evaluate(${quote(codeExpression)});`);
        }
        response.addResult(
          JSON.stringify(evalResult.result, null, 2) ?? 'undefined'
        );
      } catch (error) {
        response.addError(
          `JavaScript evaluation failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  },
});
export default [evaluate];
