import type * as playwright from 'playwright';
import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import {
  type ElementSelector,
  elementSelectorSchema,
  isCSSSelector,
  isRefSelector,
  isRoleSelector,
  isTextSelector,
} from '../types/selectors.js';
import { quote } from '../utils/codegen.js';
import { defineTabTool } from './tool.js';
import { generateLocator } from './utils.js';

function selectorCode(selector: ElementSelector): string | undefined {
  if (isCSSSelector(selector)) {
    return `locator(${quote(selector.css)})`;
  }
  if (isRoleSelector(selector)) {
    const options = selector.text ? `, { name: ${quote(selector.text)} }` : '';
    return `getByRole(${quote(selector.role)}${options})`;
  }
  if (isTextSelector(selector)) {
    const textLocator = `getByText(${quote(selector.text)})`;
    return selector.tag
      ? `locator(${quote(selector.tag)}).${textLocator}`
      : textLocator;
  }
  if (isRefSelector(selector)) {
    return;
  }
  return;
}

async function refSelectorCode(
  tab: Parameters<Parameters<typeof defineTabTool>[0]['handle']>[0],
  locator: playwright.Locator
): Promise<string | undefined> {
  const text = (await locator.textContent().catch(() => null))
    ?.replace(/\s+/gu, ' ')
    .trim();
  if (!(text && text.length <= 200)) {
    return;
  }
  return (await tab.page.getByText(text).count()) === 1
    ? `getByText(${quote(text)})`
    : undefined;
}

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
    let generatedLocator: string | undefined;
    if (params.selectors && params.selectors.length > 0) {
      const resolutionResults = await tab.resolveElementLocators(
        params.selectors
      );
      const successfulResults = resolutionResults.filter(
        (result) => result.locator && !result.error
      );
      if (successfulResults.length === 0) {
        const errors = resolutionResults
          .map((result) => result.error || 'Unknown error')
          .join(', ');
        throw new Error(`Failed to resolve element selectors: ${errors}`);
      }
      const selected = successfulResults[0];
      locator = selected.locator;
      generatedLocator =
        selectorCode(selected.selector) ??
        (await refSelectorCode(tab, locator)) ??
        (await generateLocator(locator));
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
        response.addCode(
          locator
            ? `await page.${generatedLocator}.evaluate(${quote(codeExpression)});`
            : `await page.evaluate(${quote(codeExpression)});`
        );
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
