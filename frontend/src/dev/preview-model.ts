import type { components } from '../generated/api.d.ts';
import { examples } from '../generated/contract-examples.ts';

type Schema = components['schemas'];
export type PreviewState = {
  baseline: Schema['AuctionSnapshot'];
  round: Schema['PublicRoundState'];
  lanes: Schema['PublicLaneState'][];
  needsResync: boolean;
  notice: string;
  lastEventType: string | null;
  serverTimeSample: string;
};

export function createPreviewState(): PreviewState {
  const baseline: Schema['AuctionSnapshot'] = structuredClone(examples.SnapshotFourLanes);
  return {
    baseline,
    round: baseline.round,
    lanes: baseline.lanes,
    needsResync: false,
    notice: '고정 snapshot 예제를 읽었습니다. 실제 서버와 연결하지 않습니다.',
    lastEventType: null,
    serverTimeSample: baseline.serverTime,
  };
}

export function compareCounters(left: string, right: string): -1 | 0 | 1 {
  if (!/^(0|[1-9][0-9]*)$/.test(left) || !/^(0|[1-9][0-9]*)$/.test(right)) {
    throw new Error('Invalid contract counter.');
  }
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function resync(state: PreviewState, type: string, reason: string): PreviewState {
  return { ...state, needsResync: true, lastEventType: type, notice: `${reason} snapshot 재동기화가 필요합니다(모의).` };
}

// This reducer consumes approved payload fixtures only, never an unvalidated network response.
// No EventSource, replay barrier, cursor advancement, retry timer, or server ACK is implemented here.
export function applyPreviewEvent(state: PreviewState, event: Schema['StreamEvent']): PreviewState {
  if (state.needsResync) return { ...state, notice: '재동기화 전의 이벤트는 적용하지 않습니다. snapshot 예제로 초기화하세요.' };
  if (event.schemaVersion !== 1 || event.roundId !== state.baseline.roundId) {
    return resync(state, event.type, '스키마 또는 회차가 다릅니다.');
  }
  if (event.type === 'stream.resync-required') return resync(state, event.type, event.reason);
  if (event.streamEpoch !== state.baseline.streamEpoch) return resync(state, event.type, 'streamEpoch가 다릅니다.');

  if (event.type === 'stream.heartbeat') {
    const sameVersions = compareCounters(event.roundVersion, state.round.roundVersion) === 0
      && event.laneVersions.length === state.lanes.length
      && state.lanes.every((lane) => event.laneVersions.some((watermark) => watermark.laneId === lane.laneId
        && compareCounters(watermark.laneVersion, lane.laneVersion) === 0));
    if (!sameVersions) return resync(state, event.type, 'heartbeat와 적용 버전이 다릅니다.');
    return { ...state, serverTimeSample: event.serverTime, lastEventType: event.type, notice: 'heartbeat 예제 확인. 업무 상태와 커서는 바꾸지 않습니다.' };
  }

  const current = event.type === 'round.state.changed' ? state.round : state.lanes.find((lane) => lane.laneId === event.data.laneId);
  if (!current) return resync(state, event.type, 'snapshot에 없는 레인입니다.');
  const oldVersion = 'roundVersion' in current ? current.roundVersion : current.laneVersion;
  const newVersion = event.type === 'round.state.changed' ? event.data.roundVersion : event.data.laneVersion;
  const comparison = compareCounters(newVersion, oldVersion);
  if (comparison === 0 && stableJson(current) !== stableJson(event.data)) return resync(state, event.type, '같은 scope·버전에 다른 내용이 있습니다.');
  if (comparison <= 0) return { ...state, lastEventType: event.type, notice: '이미 반영한 버전의 예제입니다. 공개 상태를 덮어쓰지 않습니다.' };
  if (BigInt(newVersion) !== BigInt(oldVersion) + 1n) return resync(state, event.type, '버전 공백을 발견했습니다.');
  return {
    ...state,
    ...(event.type === 'round.state.changed'
      ? { round: event.data }
      : { lanes: state.lanes.map((lane) => lane.laneId === event.data.laneId ? event.data : lane) }),
    lastEventType: event.type,
    notice: '같은 scope의 다음 버전 예제를 적용했습니다. 실제 SSE 수신은 아닙니다.',
  };
}
