import type { components } from '../generated/api.d.ts';

export type PublicRound = components['schemas']['PublicRoundState'];
export type Problem = components['schemas']['Problem'];

export class InvalidResponse extends Error {
  constructor() { super('The response does not match the approved public round contract.'); }
}

function requireValue(condition: unknown): asserts condition {
  if (!condition) throw new InvalidResponse();
}

function closedObject(value: unknown, fields: readonly string[]): Record<string, unknown> {
  requireValue(typeof value === 'object' && value !== null && !Array.isArray(value));
  const object = value as Record<string, unknown>;
  requireValue(Object.keys(object).length === fields.length && fields.every((field) => Object.hasOwn(object, field)));
  return object;
}

export function isOpaqueId(value: unknown): value is string {
  return typeof value === 'string' && /\S/u.test(value);
}

// Validate the calendar separately: Date.parse alone normalizes impossible dates.
// Keep the original string, including every microsecond digit, in the returned DTO.
export function isUtcInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?Z$/.exec(value);
  if (!match) return false;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number) as [number, number, number, number, number, number];
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= (days[month - 1] ?? 0)
    && hour <= 23 && minute <= 59 && second <= 59;
}

const statuses = { PUBLISHED: true, WAITING: true, ACTIVE: true, COMPLETED: true, CANCELLED: true } satisfies Record<PublicRound['status'], true>;

export function parsePublicRound(value: unknown, requestedId: string): PublicRound {
  const round = closedObject(value, ['roundId', 'roundVersion', 'status', 'recruitmentOpensAt', 'publicationAt', 'scheduledStartsAt', 'actualStartedAt', 'completedAt', 'cancelledAt', 'laneCount', 'durations', 'durationsFrozen']);
  requireValue(isOpaqueId(round.roundId) && round.roundId === requestedId);
  requireValue(typeof round.roundVersion === 'string' && /^(0|[1-9][0-9]*)$/.test(round.roundVersion));
  requireValue(typeof round.status === 'string' && Object.hasOwn(statuses, round.status));
  for (const field of ['recruitmentOpensAt', 'publicationAt', 'scheduledStartsAt']) requireValue(isUtcInstant(round[field]));
  for (const field of ['actualStartedAt', 'completedAt', 'cancelledAt']) requireValue(round[field] === null || isUtcInstant(round[field]));
  requireValue(typeof round.laneCount === 'number' && Number.isInteger(round.laneCount) && round.laneCount >= 1 && round.laneCount <= 4);
  requireValue(typeof round.durationsFrozen === 'boolean');
  const durations = closedObject(round.durations, ['preparationSeconds', 'initialBidSeconds', 'followupBidSeconds']);
  // Safe integer is a JS representation check, not an approved product duration limit.
  for (const duration of Object.values(durations)) requireValue(typeof duration === 'number' && Number.isSafeInteger(duration));
  return value as PublicRound;
}

const problemCodes = {
  VALIDATION_FAILED: true, AUTHENTICATION_REQUIRED: true, AUTHENTICATION_FAILED: true,
  ROLE_REQUIRED: true, EMAIL_NOT_VERIFIED: true, CSRF_INVALID: true, RESOURCE_NOT_FOUND: true,
  REQUEST_RECORD_NOT_FOUND: true, CONTENT_CONFLICT: true, UNCONFIRMED_INTENT_EXISTS: true,
  INTENT_NOT_REGISTERED: true, OUTCOME_NOT_FINAL: true, OUTCOME_MISMATCH: true,
  RATE_LIMITED: true, SERVICE_UNAVAILABLE: true, COMMIT_RESULT_UNKNOWN: true,
  RECOVERY_REVIEW_REQUIRED: true, INTERNAL_ERROR: true,
} satisfies Record<Problem['code'], true>;

export function parseProblem(value: unknown): Problem {
  const problem = closedObject(value, ['code', 'message', 'traceId', 'serverTime', 'fieldErrors']);
  requireValue(typeof problem.code === 'string' && Object.hasOwn(problemCodes, problem.code));
  requireValue(typeof problem.message === 'string' && problem.message.length > 0);
  requireValue(isOpaqueId(problem.traceId) && isUtcInstant(problem.serverTime));
  requireValue(Array.isArray(problem.fieldErrors));
  for (const item of problem.fieldErrors) {
    const field = closedObject(item, ['field', 'reason']);
    requireValue(typeof field.field === 'string' && field.field.length > 0 && typeof field.reason === 'string' && field.reason.length > 0);
  }
  return value as Problem;
}

const seoulFormat = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

export function formatSeoul(value: string): string {
  // Formatting is display-only. Never use a browser clock or the formatted Date for state transitions.
  const parts = Object.fromEntries(seoulFormat.formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  const fraction = /\.\d{1,6}Z$/.exec(value)?.[0].slice(0, -1) ?? '';
  return `${parts.year}.${parts.month}.${parts.day} ${parts.hour}:${parts.minute}:${parts.second}${fraction}`;
}
