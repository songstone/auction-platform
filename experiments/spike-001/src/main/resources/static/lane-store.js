/** Experiment only: full public snapshots and monotonic, independent lane versions. */
export class LaneStore {
  constructor({ maxBuffer = 256, onChange = () => {}, onGap = () => {} } = {}) {
    this.lanes = new Map();
    this.buffer = [];
    this.buffering = true;
    this.overflow = false;
    this.maxBuffer = maxBuffer;
    this.onChange = onChange;
    this.onGap = onGap;
    this.stats = { applied: 0, oldOrDuplicate: 0, gaps: 0, overflow: 0, snapshots: 0 };
  }
  beginSync() { this.buffering = true; }
  receive(lane) {
    if (!lane || !Number.isInteger(Number(lane.lane ?? lane.laneId)) || !Number.isSafeInteger(Number(lane.version))) {
      this.onGap('invalid-event'); return false;
    }
    if (this.buffering) {
      if (this.buffer.length >= this.maxBuffer) {
        this.buffer = []; this.overflow = true; this.stats.overflow++;
      }
      this.buffer.push(lane); return false;
    }
    return this.apply(lane);
  }
  apply(lane) {
    const id = Number(lane.lane ?? lane.laneId), version = Number(lane.version);
    const current = this.lanes.get(id);
    if (current && version <= Number(current.version)) {
      this.stats.oldOrDuplicate++; return false;
    }
    if (!current || version !== Number(current.version) + 1) {
      this.stats.gaps++; this.beginSync(); this.buffer.push(lane); this.onGap('version-gap'); return false;
    }
    this.lanes.set(id, structuredClone(lane)); this.stats.applied++; this.onChange(this.snapshot(), 'event', lane); return true;
  }
  mergeSnapshot(snapshot) {
    const incoming = Array.isArray(snapshot) ? snapshot : snapshot.lanes;
    if (!Array.isArray(incoming)) throw new Error('Snapshot must contain lanes');
    for (const lane of incoming) {
      const id = Number(lane.lane ?? lane.laneId), version = Number(lane.version);
      if (!Number.isInteger(id) || !Number.isSafeInteger(version)) throw new Error('Invalid snapshot version');
      const current = this.lanes.get(id);
      if (!current || version >= Number(current.version)) this.lanes.set(id, structuredClone(lane));
    }
    const pending = this.buffer.splice(0), overflow = this.overflow;
    this.overflow = false; this.buffering = false; this.stats.snapshots++;
    this.onChange(this.snapshot(), 'snapshot');
    pending.sort((a, b) => Number(a.lane ?? a.laneId) - Number(b.lane ?? b.laneId) || Number(a.version) - Number(b.version));
    for (const lane of pending) this.receive(lane);
    if (overflow) { this.beginSync(); this.onGap('buffer-overflow'); }
    return !this.buffering;
  }
  checkVersions(versions) {
    for (const [id, version] of Object.entries(versions || {})) {
      if (Number(version) > Number(this.lanes.get(Number(id))?.version ?? -1)) {
        this.stats.gaps++; this.beginSync(); this.onGap('heartbeat-version'); return false;
      }
    }
    return true;
  }
  snapshot() { return [...this.lanes.values()].sort((a, b) => Number(a.lane ?? a.laneId) - Number(b.lane ?? b.laneId)); }
}
