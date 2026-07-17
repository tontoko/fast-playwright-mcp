import type * as playwright from 'playwright';
import { z } from 'zod';
import type { Response } from '../response.js';
import { expectationSchema } from '../schemas/expectation.js';
import type { Tab } from '../tab.js';
import { elementSelectorSchema } from '../types/selectors.js';
import { formatObject } from '../utils/codegen.js';
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

const screenshotSchema = z
  .object({
    type: z
      .enum(['png', 'jpeg'])
      .default('png')
      .describe('Image format for the screenshot. Default is png.'),
    filename: z
      .string()
      .optional()
      .describe(
        'File name to save the screenshot to. Defaults to `page-{timestamp}.{png|jpeg}` if not specified.'
      ),
    selectors: selectorsSchema
      .optional()
      .describe(
        'Optional element selectors for element screenshots. If not provided, viewport screenshot will be taken.'
      ),
    scale: z
      .enum(['css', 'device'])
      .optional()
      .default('css')
      .describe('Use CSS pixels or device pixels for the screenshot.'),
    fullPage: z
      .boolean()
      .optional()
      .describe(
        'When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Cannot be used with element screenshots.'
      ),
    expectation: expectationSchema.describe('Additional page state config'),
  })
  .refine(
    (data) => {
      return !(data.fullPage && data.selectors && data.selectors.length > 0);
    },
    {
      message: 'fullPage cannot be used with element screenshots.',
      path: ['fullPage'],
    }
  );

type ScreenshotParams = z.output<typeof screenshotSchema>;

async function prepareFileName(
  context: Tab['context'],
  filename: string | undefined,
  fileType: string
): Promise<string> {
  const defaultName = `page-${new Date().toISOString()}.${fileType}`;
  return await context.outputFile(filename ?? defaultName);
}

function createScreenshotOptions(
  fileType: string,
  fileName: string,
  fullPage: boolean | undefined,
  scale: 'css' | 'device'
): playwright.PageScreenshotOptions {
  return {
    type: fileType as 'png' | 'jpeg',
    quality: fileType === 'png' ? undefined : 90,
    scale,
    path: fileName,
    ...(fullPage !== undefined && { fullPage }),
  };
}

function isElementScreenshotRequest(params: ScreenshotParams): boolean {
  return !!(params.selectors && params.selectors.length > 0);
}

function getScreenshotTarget(
  params: ScreenshotParams,
  isElementScreenshot: boolean
): string {
  if (isElementScreenshot) {
    return 'element';
  }
  return params.fullPage ? 'full page' : 'viewport';
}

async function getScreenshotLocator(
  tab: Tab,
  params: ScreenshotParams,
  isElementScreenshot: boolean
): Promise<playwright.Locator | null> {
  if (!(isElementScreenshot && params.selectors)) {
    return null;
  }

  const resolutionResults = await tab.resolveElementLocators(params.selectors);
  const successfulResults = resolutionResults.filter(
    (r) => r.locator && !r.error
  );

  if (successfulResults.length === 0) {
    const errors = resolutionResults
      .map((r) => r.error || 'Unknown error')
      .join(', ');
    throw new Error(
      `Failed to resolve element selectors for screenshot: ${errors}`
    );
  }

  return successfulResults[0].locator;
}

async function addScreenshotCode(
  response: Response,
  locator: playwright.Locator | null,
  options: playwright.PageScreenshotOptions
): Promise<void> {
  if (locator) {
    response.addCode(
      `await page.${await generateLocator(locator)}.screenshot(${formatObject(options)});`
    );
  } else {
    response.addCode(`await page.screenshot(${formatObject(options)});`);
  }
}

async function takeScreenshot(
  tab: Tab,
  locator: playwright.Locator | null,
  options: playwright.PageScreenshotOptions
): Promise<Buffer> {
  return locator
    ? await locator.screenshot(options)
    : await tab.page.screenshot(options);
}

const screenshot = defineTabTool({
  capability: 'core',
  schema: {
    name: 'browser_take_screenshot',
    title: 'Take a screenshot',
    description: 'Take a screenshot of current page and return image data',
    inputSchema: screenshotSchema,
    type: 'action',
  },
  handle: async (tab, params, response) => {
    const fileType = params.type ?? 'png';
    const fileName = await prepareFileName(
      tab.context,
      params.filename,
      fileType
    );
    const options = createScreenshotOptions(
      fileType,
      fileName,
      params.fullPage,
      params.scale
    );

    const isElementScreenshot = isElementScreenshotRequest(params);
    const screenshotTarget = getScreenshotTarget(params, isElementScreenshot);

    response.addCode(
      `// Screenshot ${screenshotTarget} and save it as ${fileName}`
    );

    const locator = await getScreenshotLocator(
      tab,
      params,
      isElementScreenshot
    );
    await addScreenshotCode(response, locator, options);

    const buffer = await takeScreenshot(tab, locator, options);
    await tab.context.finalizeOutputFile(fileName);

    response.addResult(
      `Took the ${screenshotTarget} screenshot and saved it as ${fileName}`
    );

    // https://github.com/microsoft/playwright-mcp/issues/817
    // Never return large images to LLM, saving them to the file system is enough.
    if (!params.fullPage) {
      response.addImage({
        contentType: fileType === 'png' ? 'image/png' : 'image/jpeg',
        data: buffer,
      });
    }
  },
});
export default [screenshot];
