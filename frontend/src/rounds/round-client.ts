import { InvalidResponse, isOpaqueId, parseProblem, parsePublicRound } from './round-contract.ts';
import type { PublicRound } from './round-contract.ts';

export type RoundError = 'not-found' | 'unavailable' | 'invalid-link' | 'network' | 'unexpected';
export type RoundState = { kind: 'loading' } | { kind: 'ready'; round: PublicRound } | { kind: 'error'; error: RoundError };

export class RoundRequestError extends Error {
  readonly kind: RoundError;
  constructor(kind: RoundError) { super(kind); this.kind = kind; }
}

export function publicRoundPath(roundId: string): string {
  if (!isOpaqueId(roundId)) throw new RoundRequestError('invalid-link');
  return `/api/v1/rounds/${encodeURIComponent(roundId)}`;
}

export async function fetchPublicRound(roundId: string, signal: AbortSignal, fetcher: typeof fetch = fetch): Promise<PublicRound> {
  const path = publicRoundPath(roundId);
  let response: Response;
  try {
    response = await fetcher(path, { signal, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new RoundRequestError('network');
  }
  if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new InvalidResponse();
  if (!response.headers.get('cache-control')?.split(',').some((directive) => directive.trim().toLowerCase() === 'no-store')) throw new InvalidResponse();
  let body: unknown;
  try { body = await response.json(); } catch { throw new InvalidResponse(); }
  if (response.status === 200) return parsePublicRound(body, roundId);
  const problem = parseProblem(body);
  if (response.status === 404 && problem.code === 'RESOURCE_NOT_FOUND') throw new RoundRequestError('not-found');
  if (response.status === 503 && problem.code === 'SERVICE_UNAVAILABLE') throw new RoundRequestError('unavailable');
  if (response.status === 400 && problem.code === 'VALIDATION_FAILED') throw new RoundRequestError('invalid-link');
  throw new RoundRequestError('unexpected');
}

// Used by the view and tested with deferred requests: even an abort-ignoring old
// response cannot replace the current round or turn an unmounted view into an error.
export function createRoundLoader(notify: (state: RoundState) => void, read = fetchPublicRound) {
  let generation = 0;
  let controller: AbortController | undefined;
  return {
    async load(roundId: string): Promise<void> {
      const current = ++generation;
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      notify({ kind: 'loading' });
      try {
        const round = await read(roundId, signal);
        if (current === generation && !signal.aborted) notify({ kind: 'ready', round });
      } catch (error) {
        if (current === generation && !signal.aborted) notify({ kind: 'error', error: error instanceof RoundRequestError ? error.kind : 'unexpected' });
      }
    },
    dispose() { generation++; controller?.abort(); },
  };
}
