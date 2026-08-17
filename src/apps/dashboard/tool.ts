import { z } from 'zod';
import { defineTool } from '../../tools/tool.js';
import { DASHBOARD_RESOURCE_URI } from './resource.js';

export const browserDashboard = defineTool({
  capability: 'apps',
  schema: {
    name: 'browser_dashboard',
    title: 'Open browser dashboard',
    description:
      'Open the bundled browser preview and tab-selection dashboard.',
    inputSchema: z.object({}),
    type: 'readOnly',
    _meta: {
      ui: {
        resourceUri: DASHBOARD_RESOURCE_URI,
      },
    },
  },
  handle: (_context, _params, response) => {
    response.addResult('Browser dashboard is available.');
    return Promise.resolve();
  },
});
