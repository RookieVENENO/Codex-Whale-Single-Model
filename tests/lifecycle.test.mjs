import test from 'node:test';
import assert from 'node:assert/strict';
import { MCPLeaseRegistry } from '../runtime/lifecycle.mjs';

function clock(start = 1000) {
  let now = start;
  const jobs = new Set();
  const timers = {
    now: () => now,
    setTimer(fn, ms) {
      const job = { at: now + ms, fn, unref() {} };
      jobs.add(job);
      return job;
    },
    clearTimer(job) { jobs.delete(job); },
    async advance(ms) {
      const until = now + ms;
      for (;;) {
        const next = [...jobs].filter(job => job.at <= until).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        jobs.delete(next);
        now = next.at;
        await next.fn();
      }
      now = until;
    },
  };
  return timers;
}

test('only the last MCP lease stops the shared widget after the grace period', async () => {
  const timers = clock();
  let stops = 0;
  const registry = new MCPLeaseRegistry({
    enabled: () => true, graceMs: 2500, ttlMs: 45000, now: timers.now,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, onEmpty: () => { stops++; },
  });
  const a = registry.acquire(), b = registry.acquire();
  assert.equal(a.active, 1); assert.equal(b.active, 2);
  assert.equal(registry.release(a.id).active, 1);
  await timers.advance(3000);
  assert.equal(stops, 0, 'one live session keeps the widget running');
  assert.ok(registry.release(b.id).stopsInMs > 0);
  await timers.advance(3000);
  assert.equal(stops, 1);
  registry.close();
});

test('a reconnecting MCP session cancels the pending stop', async () => {
  const timers = clock();
  let stops = 0;
  const registry = new MCPLeaseRegistry({
    enabled: () => true, graceMs: 2500, ttlMs: 45000, now: timers.now,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, onEmpty: () => { stops++; },
  });
  const first = registry.acquire();
  registry.release(first.id);
  await timers.advance(1000);
  const second = registry.acquire();
  await timers.advance(3000);
  assert.equal(stops, 0);
  registry.release(second.id);
  await timers.advance(3000);
  assert.equal(stops, 1);
  registry.close();
});

test('standalone mode and scheduler ownership never trigger automatic shutdown', async () => {
  const timers = clock();
  let enabled = false, stops = 0;
  const registry = new MCPLeaseRegistry({
    enabled: () => enabled, graceMs: 500, ttlMs: 5000, now: timers.now,
    setTimer: timers.setTimer, clearTimer: timers.clearTimer, onEmpty: () => { stops++; },
  });
  const lease = registry.acquire();
  registry.release(lease.id);
  await timers.advance(1000);
  assert.equal(stops, 0);
  enabled = true;
  const managed = registry.acquire();
  enabled = false;
  registry.release(managed.id);
  await timers.advance(1000);
  assert.equal(stops, 0);
  registry.close();
});
