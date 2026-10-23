import { randomUUID } from 'node:crypto';

// MCP servers are per-chat processes; the widget runtime is shared. A lease
// therefore represents one live MCP session, and only the last expired or
// released lease may stop the shared runtime.
export class MCPLeaseRegistry {
  constructor({
    enabled = () => false,
    graceMs = 2500,
    ttlMs = 45000,
    now = Date.now,
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    onEmpty = () => {},
  } = {}) {
    this.enabled = enabled;
    this.graceMs = Math.max(250, Number(graceMs) || 2500);
    this.ttlMs = Math.max(5000, Number(ttlMs) || 45000);
    this.now = now;
    this.setTimer = setTimer;
    this.clearTimer = clearTimer;
    this.onEmpty = onEmpty;
    this.leases = new Map();
    this.stopTimer = null;
    this.expiryTimer = null;
    this.emptyAfter = 0;
    this.everAcquired = false;
    this.stopped = false;
  }
  canStop() {
    try { return this.enabled() === true; } catch { return false; }
  }
  scheduleExpiry() {
    if (this.expiryTimer) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    if (this.stopped || !this.leases.size) return;
    const next = Math.min(...[...this.leases.values()].map(item => item.expiresAt));
    this.expiryTimer = this.setTimer(() => {
      this.expiryTimer = null;
      this.prune();
    }, Math.max(1, next - this.now()));
    this.expiryTimer?.unref?.();
  }
  cancelStop() {
    if (!this.stopTimer) return;
    this.clearTimer(this.stopTimer);
    this.stopTimer = null;
    this.emptyAfter = 0;
  }
  scheduleStop() {
    if (this.stopped || this.stopTimer || this.leases.size || !this.everAcquired || !this.canStop()) return;
    this.emptyAfter = this.now() + this.graceMs;
    this.stopTimer = this.setTimer(async () => {
      this.stopTimer = null;
      if (this.stopped || this.leases.size || !this.canStop()) { this.emptyAfter = 0; return; }
      this.emptyAfter = 0;
      try { await this.onEmpty(); } catch {}
    }, this.graceMs);
    this.stopTimer?.unref?.();
  }
  acquire() {
    if (this.stopped) throw new Error('挂件生命周期服务已经关闭');
    const id = randomUUID();
    const expiresAt = this.now() + this.ttlMs;
    this.leases.set(id, { id, expiresAt });
    this.everAcquired = true;
    this.cancelStop();
    this.scheduleExpiry();
    return { id, active: this.leases.size, expiresAt, managed: this.canStop() };
  }
  heartbeat(id) {
    const lease = this.leases.get(id);
    if (!lease) return null;
    lease.expiresAt = this.now() + this.ttlMs;
    this.scheduleExpiry();
    return { id, active: this.leases.size, expiresAt: lease.expiresAt, managed: this.canStop() };
  }
  release(id) {
    const released = this.leases.delete(id);
    this.scheduleExpiry();
    this.scheduleStop();
    return {
      released,
      active: this.leases.size,
      managed: this.canStop(),
      stopsInMs: released && this.leases.size === 0 && this.stopTimer ? Math.max(0, this.emptyAfter - this.now()) : 0,
    };
  }
  prune() {
    const now = this.now();
    let removed = 0;
    for (const [id, lease] of this.leases) {
      if (lease.expiresAt <= now) {
        this.leases.delete(id);
        removed++;
      }
    }
    this.scheduleExpiry();
    this.scheduleStop();
    return { removed, active: this.leases.size };
  }
  status() {
    this.prune();
    return {
      active: this.leases.size,
      managed: this.canStop(),
      stopScheduledAt: this.stopTimer ? this.emptyAfter : null,
      ttlMs: this.ttlMs,
      graceMs: this.graceMs,
    };
  }
  close() {
    this.stopped = true;
    this.cancelStop();
    if (this.expiryTimer) this.clearTimer(this.expiryTimer);
    this.expiryTimer = null;
    this.leases.clear();
  }
}
