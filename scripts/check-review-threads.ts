import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolveWorkspaceInputPath } from './path-policy.js';
import {
  assertReviewThreadsReady,
  fetchReviewThreads,
  type ReviewThreadPage,
} from './review-threads/check.js';

const { values } = parseArgs({
  options: {
    repository: { type: 'string' },
    pr: { type: 'string' },
    fixture: { type: 'string' },
  },
});
let page: ReviewThreadPage;
if (values.fixture) {
  const fixturePath = await resolveWorkspaceInputPath(values.fixture, {
    extension: '.json',
    label: '--fixture',
  });
  const fixtureText = await readFile(fixturePath, 'utf8'); // NOSONAR
  page = JSON.parse(fixtureText) as ReviewThreadPage;
} else {
  if (!(values.repository && values.pr && process.env.GITHUB_TOKEN)) {
    throw new Error('--repository, --pr, and GITHUB_TOKEN are required');
  }
  page = await fetchReviewThreads(
    values.repository,
    Number(values.pr),
    process.env.GITHUB_TOKEN
  );
}
assertReviewThreadsReady(page);
process.stdout.write('Review thread check passed.\n');
