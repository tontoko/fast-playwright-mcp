export type DashboardRefreshOperations = {
  updateTabs: () => Promise<void>;
  updatePreview: () => Promise<boolean>;
};

export type DashboardRefreshResult = {
  previewAvailable: boolean;
};

export async function refreshDashboard(
  operations: DashboardRefreshOperations
): Promise<DashboardRefreshResult> {
  await operations.updateTabs();
  return { previewAvailable: await operations.updatePreview() };
}
