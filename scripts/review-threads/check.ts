export type ReviewThreadPage = {
  isDraft: boolean;
  reviewThreads: {
    nodes: { isResolved: boolean; isOutdated?: boolean; path?: string }[];
    pageInfo?: { hasNextPage: boolean; endCursor?: string | null };
  };
};

export function unresolvedThreadCount(page: ReviewThreadPage): number {
  return page.reviewThreads.nodes.filter((thread) => !thread.isResolved).length;
}

const QUERY =
  'query ReviewThreads($owner:String!,$name:String!,$number:Int!,$after:String){repository(owner:$owner,name:$name){pullRequest(number:$number){isDraft reviewThreads(first:100,after:$after){nodes{isResolved isOutdated path} pageInfo{hasNextPage endCursor}}}}}';

type GraphPayload = {
  data?: { repository?: { pullRequest?: ReviewThreadPage } };
  errors?: { message: string }[];
};

async function fetchPage(
  owner: string,
  name: string,
  number: number,
  token: string,
  after: string | null
): Promise<ReviewThreadPage> {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: QUERY,
      variables: { owner, name, number, after },
    }),
  });
  if (!response.ok) {
    throw new Error(`GitHub GraphQL request failed: ${response.status}`);
  }
  const payload = (await response.json()) as GraphPayload;
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((item) => item.message).join('; '));
  }
  const page = payload.data?.repository?.pullRequest;
  if (!page) {
    throw new Error('Pull request not found');
  }
  return page;
}

async function collectPages(
  owner: string,
  name: string,
  number: number,
  token: string,
  after: string | null,
  collected: ReviewThreadPage['reviewThreads']['nodes']
): Promise<ReviewThreadPage> {
  const page = await fetchPage(owner, name, number, token, after);
  const nodes = [...collected, ...page.reviewThreads.nodes];
  const next = page.reviewThreads.pageInfo?.hasNextPage
    ? (page.reviewThreads.pageInfo.endCursor ?? null)
    : null;
  if (next) {
    return await collectPages(owner, name, number, token, next, nodes);
  }
  return { isDraft: page.isDraft, reviewThreads: { nodes } };
}

export async function fetchReviewThreads(
  repository: string,
  number: number,
  token: string
): Promise<ReviewThreadPage> {
  const [owner, name] = repository.split('/');
  if (!(owner && name)) {
    throw new Error('repository must use owner/name format');
  }
  return await collectPages(owner, name, number, token, null, []);
}

export function assertReviewThreadsReady(page: ReviewThreadPage): void {
  const count = unresolvedThreadCount(page);
  if (count && !page.isDraft) {
    throw new Error(`Pull request has ${count} unresolved review thread(s)`);
  }
}
