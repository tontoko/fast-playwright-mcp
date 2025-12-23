import type * as playwright from 'playwright';
import type { Response } from '../response.js';
import type { Tab } from '../tab.js';
import type { ElementSelector } from '../types/selectors.js';

/**
 * Shared result from element resolution
 */
export interface ElementResolutionResult {
  locator: playwright.Locator;
  // Add any other shared properties if needed
}

/**
 * Resolves element selectors and handles common error scenarios
 * @param tab The browser tab
 * @param selectors Array of element selectors to resolve
 * @param errorMessage Custom error message prefix for failures
 * @returns The first successfully resolved locator
 */
export async function resolveFirstElement(
  tab: Tab,
  selectors: ElementSelector[],
  errorMessage = 'Failed to resolve element selectors'
): Promise<ElementResolutionResult> {
  const resolutionResults = await tab.resolveElementLocators(selectors);
  const successfulResults = resolutionResults.filter(
    (r) => r.locator && !r.error
  );

  if (successfulResults.length === 0) {
    const errors = resolutionResults
      .map((r) => r.error || 'Unknown error')
      .join(', ');
    throw new Error(`${errorMessage}: ${errors}`);
  }

  return { locator: successfulResults[0].locator };
}

/**
 * Handles snapshot capturing based on expectation parameters
 * @param tab The browser tab
 * @param expectation The expectation object that may contain snapshot settings
 * @param response The tool response to update with snapshot
 */
export async function handleSnapshotExpectation(
  tab: Tab,
  expectation:
    | {
        includeSnapshot?: boolean;
        snapshotOptions?: { selector?: string; maxLength?: number };
      }
    | undefined,
  response: Response
): Promise<void> {
  if (expectation?.includeSnapshot) {
    const { selector, maxLength } = expectation.snapshotOptions ?? {};
    const newSnapshot =
      selector || maxLength
        ? await tab.capturePartialSnapshot(selector, maxLength)
        : await tab.captureSnapshot();
    response.setTabSnapshot(newSnapshot);
  }
}

/**
 * Resolves two separate selector arrays for drag operations
 * @param tab The browser tab
 * @param startSelectors Array of start element selectors
 * @param endSelectors Array of end element selectors
 * @returns Object with start and end locators
 */
export async function resolveDragElements(
  tab: Tab,
  startSelectors: ElementSelector[],
  endSelectors: ElementSelector[]
): Promise<{
  startLocator: playwright.Locator;
  endLocator: playwright.Locator;
}> {
  const [startResults, endResults] = await Promise.all([
    tab.resolveElementLocators(startSelectors),
    tab.resolveElementLocators(endSelectors),
  ]);

  const startSuccessful = startResults.filter((r) => r.locator && !r.error);
  const endSuccessful = endResults.filter((r) => r.locator && !r.error);

  if (startSuccessful.length === 0) {
    const errors = startResults
      .map((r) => r.error || 'Unknown error')
      .join(', ');
    throw new Error(`Failed to resolve start element selectors: ${errors}`);
  }

  if (endSuccessful.length === 0) {
    const errors = endResults.map((r) => r.error || 'Unknown error').join(', ');
    throw new Error(`Failed to resolve end element selectors: ${errors}`);
  }

  return {
    startLocator: startSuccessful[0].locator,
    endLocator: endSuccessful[0].locator,
  };
}
