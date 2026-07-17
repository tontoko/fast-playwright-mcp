import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
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
  page = JSON.parse(await readFile(values.fixture, 'utf8')) as ReviewThreadPage;
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
