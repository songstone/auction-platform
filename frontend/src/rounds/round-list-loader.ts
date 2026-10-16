import { fetchPublicRoundPage, RoundRequestError } from './round-client.ts';
import type { RoundError } from './round-client.ts';
import type { PublicRoundPage } from './round-contract.ts';

export type RoundListState =
  | { kind: 'loading' }
  | { kind: 'error'; error: RoundError }
  | { kind: 'ready'; page: PublicRoundPage; loadingMore: boolean; error: RoundError | null };

// One pending page at a time. A retry keeps the failed cursor and already shown
// rows; a refresh starts a new generation. Disposal also invalidates responses
// from transports that ignore AbortSignal (for example, a response already read).
export function createRoundListLoader(notify: (state: RoundListState) => void, read = fetchPublicRoundPage) {
  let state: RoundListState = { kind: 'loading' };
  let generation = 0;
  let controller: AbortController | undefined;
  let disposed = false;

  function publish(next: RoundListState) { state = next; notify(next); }

  async function request(cursor: string | null, previous?: PublicRoundPage): Promise<void> {
    const current = ++generation;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    publish(previous ? { kind: 'ready', page: previous, loadingMore: true, error: null } : { kind: 'loading' });
    try {
      const page = await read(cursor, signal);
      if (disposed || current !== generation || signal.aborted) return;
      // The list can change between reads. Preserve server order and exact IDs,
      // showing an item once even if it occurs again across page boundaries.
      const seen = new Set<string>();
      const items = [...(previous?.items ?? []), ...page.items].filter((round) => {
        if (seen.has(round.roundId)) return false;
        seen.add(round.roundId);
        return true;
      });
      publish({ kind: 'ready', page: { items, nextCursor: page.nextCursor }, loadingMore: false, error: null });
    } catch (error) {
      if (disposed || current !== generation || signal.aborted) return;
      const kind = error instanceof RoundRequestError ? error.kind : 'unexpected';
      publish(previous ? { kind: 'ready', page: previous, loadingMore: false, error: kind } : { kind: 'error', error: kind });
    }
  }

  return {
    async refresh(): Promise<void> {
      if (!disposed) await request(null);
    },
    async more(): Promise<void> {
      if (!disposed && state.kind === 'ready' && !state.loadingMore && state.page.nextCursor !== null) {
        await request(state.page.nextCursor, state.page);
      }
    },
    dispose() { disposed = true; generation++; controller?.abort(); },
  };
}
