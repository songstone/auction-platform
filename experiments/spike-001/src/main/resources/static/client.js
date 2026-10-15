import { LaneStore } from './lane-store.js';

const params = new URLSearchParams(location.search);
const clientKey = params.get('client') || crypto.randomUUID();
const actorInput = document.querySelector('#actor');
actorInput.value = params.get('actor') || `browser-${crypto.randomUUID()}`;
const connection = document.querySelector('#connection');
const measurements = { clientKey, bid: [], render: [], applied: [], reconnect: [], errors: [], sync: [] };
const outcomes = new Map();
const requests = new Map();
const hasPending = (actor, auction) => [...requests.values()].some(record => record.pending && record.actor === actor && record.auction === auction);
const statusText = { PREPARING: '입찰 준비', INITIAL: '첫 입찰 대기', FOLLOWUP: '후속 입찰 진행', SOLD: '낙찰 확정', UNSOLD: '유찰 확정', CANCELLED: '취소 확정', ENDED: '레인 완료' };
let source, syncing, syncAgain = false, reconnectStart, manualOffline = false;
const store = new LaneStore({ maxBuffer: 256, onChange: render, onGap: reason => sync(reason) });
async function api(path, body) {
  const response = await fetch(path, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? {} : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.code || data.message || `HTTP ${response.status}`), { data, status: response.status });
  return data;
}
function render(lanes, kind, appliedEvent) {
  const eventReceived = appliedEvent?._clientReceivedMono, eventCreated = appliedEvent?.serverMs, eventCommitted = appliedEvent?.committedMs;
  const box = document.querySelector('#lanes');
  for (const lane of lanes) {
    const id = Number(lane.lane);
    let card = document.querySelector(`#lane-${id}`);
    if (!card) {
      card = document.createElement('article'); card.className = 'card'; card.id = `lane-${id}`;
      card.innerHTML = `<h2>${id} 레인</h2><div class="details item"></div><div class="price"></div><div class="status"></div><div class="details deadline"></div><button class="bid" data-lane="${id}">다음 금액 입찰</button><button class="resolve" hidden>원요청 다시 확인</button><div class="outcome" role="status"></div>`;
      card.querySelector('.bid').addEventListener('click', () => bid(id)); card.querySelector('.resolve').addEventListener('click', () => recover(id)); box.append(card);
    }
    card.dataset.version = lane.version; card.dataset.auction = lane.auction;
    card.querySelector('.item').textContent = `상품 ${lane.ordinal ?? lane.auction}`;
    card.querySelector('.price').textContent = lane.hasBid ? `${Number(lane.highestAmount).toLocaleString()}원` : '아직 입찰 없음';
    card.querySelector('.status').textContent = lane.held ? `결과 보류 (${lane.holdReason || '복구 확인 필요'})` : lane.manualStopped ? '진행 중단' : statusText[lane.result || lane.stage] || lane.stage;
    card.querySelector('.deadline').textContent = lane.deadlineMs ? `현재 마감 ${new Date(lane.deadlineMs).toLocaleTimeString('ko-KR', { hour12: false })}` : '현재 마감 없음';
    card.querySelector('.bid').textContent = `${Number(lane.nextAmount).toLocaleString()}원 입찰`;
    card.querySelector('.bid').disabled = hasPending(actorInput.value.trim(), lane.auction);
    card.querySelector('.resolve').hidden = !outcomes.get(id)?.pending;
    card.querySelector('.outcome').textContent = outcomes.get(id)?.text || '본인 입찰 내역 없음';
  }
  const history = document.querySelector('#request-history');
  for (const record of requests.values()) {
    let item = document.querySelector(`#request-${record.key}`);
    if (!item) { item = document.createElement('li'); item.id = `request-${record.key}`; history.append(item); }
    item.textContent = `${record.auction} · ${record.text} `;
    if (record.pending && !record.sending) { const button = document.createElement('button'); button.textContent = '원요청 확인'; button.addEventListener('click', () => recover(record.lane, record.key)); item.append(button); }
  }
  requestAnimationFrame(() => {
    if (['event', 'snapshot'].includes(kind)) measurements.applied.push({ kind, clientDomWallMs: Date.now(), clientDomMonoMs: performance.now(), laneVersions: lanes.map(x => [x.lane, x.version]), boundary: 'DOM_MUTATION_PLUS_RAF_CALLBACK_NOT_PIXEL_PAINT' });
    if (kind === 'event' && eventReceived !== undefined) measurements.render.push({ lane: appliedEvent.lane, version: appliedEvent.version, laneVersions: lanes.map(x => [x.lane, x.version]), receiveToDomMs: performance.now() - eventReceived, boundary: 'SSE_RECEIVE_TO_DOM', serverTimestampToDomProxyMs: Date.now() - Number(eventCreated), committedMs: eventCommitted, clientDomWallMs: Date.now(), proxyBoundary: 'PUBLIC_EVENT_TIMESTAMP_TO_DOM' });
    report();
  });
}
function report() { document.querySelector('#test-report').textContent = JSON.stringify({ stats: store.stats, bidSamples: measurements.bid.length, renders: measurements.render.length, reconnects: measurements.reconnect.length, errors: measurements.errors }, null, 2); }
async function sync(reason = 'manual') {
  if (manualOffline) return;
  if (syncing) { syncAgain = true; return syncing; }
  syncing = (async () => {
    do {
      syncAgain = false; store.beginSync(); const start = performance.now();
      const snapshot = await api('/snapshot'); store.mergeSnapshot(snapshot);
      measurements.sync.push({ reason, elapsedMs: performance.now() - start, versions: store.snapshot().map(x => [x.lane, x.version]) });
      if (reconnectStart !== undefined && !store.buffering) {
        await new Promise(requestAnimationFrame);
        measurements.reconnect.push({ elapsedMs: performance.now() - reconnectStart, boundary: 'SSE_READY_TO_DOM_SNAPSHOT', versions: store.snapshot().map(x => [x.lane, x.version]) }); reconnectStart = undefined;
        for (const record of requests.values()) if (record.pending && !record.sending) recover(record.lane, record.key);
      }
    } while (syncAgain || store.buffering);
    connection.textContent = '연결됨 · 현재 상태 동기화 완료';
  })().catch(error => { measurements.errors.push({ kind: 'snapshot', message: error.message }); connection.textContent = '현재 상태 확인 중'; }).finally(() => { syncing = undefined; report(); });
  return syncing;
}
function connect() {
  manualOffline = false; store.beginSync(); connection.textContent = '연결 중';
  source = new EventSource(`/events?client=${encodeURIComponent(clientKey)}`);
  source.addEventListener('ready', () => { reconnectStart = performance.now(); sync('stream-ready'); });
  source.addEventListener('state', event => { const data = JSON.parse(event.data); data._clientReceivedMono = performance.now(); store.receive(data); });
  source.addEventListener('heartbeat', event => store.checkVersions(JSON.parse(event.data).versions));
  source.onerror = () => { store.beginSync(); connection.textContent = '연결 복구 중'; };
  document.querySelector('#disconnect').textContent = '연결 끊기';
}
function disconnect() {
  manualOffline = true; source?.close(); store.beginSync(); connection.textContent = '연결 끊김';
  document.querySelector('#disconnect').textContent = '연결 다시 열기';
}
async function bid(id) {
  const lane = store.lanes.get(id), actor = actorInput.value.trim(), key = crypto.randomUUID();
  const clicked = performance.now();
  if (!lane || !actor || hasPending(actor, lane.auction)) return;
  const record = { lane: id, pending: true, sending: true, actor, key, auction: lane.auction, amount: lane.nextAmount, clicked, text: '처리 확인 중' };
  outcomes.set(id, record); requests.set(key, record); render(store.snapshot(), 'bid-pending');
  try {
    await api('/intents', { actor, key, auction: lane.auction, amount: lane.nextAmount });
    let result = await api('/bids', { actor, key, lane: id, auction: lane.auction, amount: lane.nextAmount });
    const deadline = performance.now() + 10000;
    while (result.outcome === 'PENDING') {
      if (performance.now() >= deadline) throw new Error('Observation timeout; original request remains unconfirmed');
      await new Promise(resolve => setTimeout(resolve, 10));
      result = await api(`/requests?actor=${encodeURIComponent(actor)}&key=${encodeURIComponent(key)}`);
    }
    if (!['ACCEPTED', 'REJECTED'].includes(result.outcome)) throw new Error('Original final decision unavailable');
    await finalDisplay(id, result);
  } catch (error) {
    measurements.errors.push({ kind: 'bid', key, message: error.message });
    record.sending = false; record.text = `처리 확인 중 · ${error.message}`; render(store.snapshot(), 'unconfirmed');
  }
}
async function finalDisplay(id, result) {
  const record = requests.get(result.key) || outcomes.get(id);
  record.text = result.outcome === 'ACCEPTED' ? `본인 원입찰 승인 · 요청 ${record.key.slice(0, 8)}` : `본인 원입찰 거절 · ${result.code}`;
  render(store.snapshot(), 'bid-final'); await new Promise(requestAnimationFrame);
  if (!record.finalDisplayed) measurements.bid.push({ lane: id, auction: record.auction, key: record.key, outcome: result.outcome, code: result.code, clickToDomMs: performance.now() - record.clicked, boundary: 'DOM_CLICK_INTENT_BID_FINAL_RENDER' });
  record.finalDisplayed = true;
  await api('/ack', { actor: record.actor, key: record.key }); record.pending = false; record.sending = false; render(store.snapshot(), 'ack');
}
async function recover(id, key = outcomes.get(id)?.key) {
  const record = requests.get(key); if (!record?.pending || record.sending) return;
  record.sending = true;
  try {
    let result = await api(`/requests?actor=${encodeURIComponent(record.actor)}&key=${encodeURIComponent(record.key)}`);
    if (result.outcome === 'NOT_FOUND') {
      await api('/intents', { actor: record.actor, key: record.key, auction: record.auction, amount: record.amount });
      result = await api('/bids', { actor: record.actor, key: record.key, lane: id, auction: record.auction, amount: record.amount });
    }
    if (['ACCEPTED', 'REJECTED'].includes(result.outcome)) await finalDisplay(id, result);
    else { record.text = '처리 확인 중 · 원요청 판정 대기'; render(store.snapshot(), 'pending-query'); }
  } catch (error) { record.text = `처리 확인 중 · ${error.message}`; render(store.snapshot(), 'pending-query'); }
  finally { record.sending = false; }
}
document.querySelector('#refresh').addEventListener('click', () => sync('manual'));
actorInput.addEventListener('change', () => render(store.snapshot(), 'actor-change'));
document.querySelector('#disconnect').addEventListener('click', () => manualOffline ? connect() : disconnect());
setInterval(() => { if (!manualOffline && source?.readyState === EventSource.OPEN) sync('periodic-silent-loss-check'); }, 5000);
window.spike = { store, measurements, sync, connect, disconnect, clientKey, get state() { return store.snapshot(); } };
connect();
