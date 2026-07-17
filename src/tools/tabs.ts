import { z } from 'zod';
import { expectationSchema } from '../schemas/expectation.js';
import { defineTool } from './tool.js';

const listTabs = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_list',
    title: 'List tabs',
    description: 'List browser tabs with titles and URLs',
    inputSchema: z.object({
      expectation: expectationSchema.describe('Page state config'),
    }),
    type: 'readOnly',
  },
  handle: async (context, _params, response) => {
    await context.ensureTab();
    response.setIncludeTabs();
  },
});
const selectTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_select',
    title: 'Select a tab',
    description: 'Select a tab by index',
    inputSchema: z.object({
      index: z.number().describe('The index of the tab to select'),
      expectation: expectationSchema.describe('Page state after tab switch'),
    }),
    type: 'action',
  },
  handle: async (context, params, response) => {
    await context.selectTab(params.index);
    response.setIncludeSnapshot();
  },
});
const newTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_new',
    title: 'Open a new tab',
    description: 'Open a new tab',
    inputSchema: z.object({
      url: z.string().optional().describe('URL for new tab (optional)'),
      expectation: expectationSchema.describe('Page state of new tab'),
    }),
    type: 'action',
  },
  handle: async (context, params, response) => {
    const tab = await context.newTab();
    if (params.url) {
      await tab.navigate(params.url);
    }
    response.setIncludeSnapshot();
  },
});
const closeTab = defineTool({
  capability: 'core-tabs',
  schema: {
    name: 'browser_tab_close',
    title: 'Close a tab',
    description: 'Close a tab by index or close current tab',
    inputSchema: z.object({
      index: z
        .number()
        .optional()
        .describe('Tab index to close (omit for current)'),
      expectation: expectationSchema.describe('Page state after close'),
    }),
    type: 'destructive',
  },
  handle: async (context, params, response) => {
    await context.closeTab(params.index);
    response.setIncludeSnapshot();
  },
});
export default [listTabs, newTab, selectTab, closeTab];
