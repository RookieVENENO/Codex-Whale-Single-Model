import fs from 'node:fs';
import { observeAccountDebit, issueAccountNotice, acknowledgeAccountNotices } from './account-notices.mjs';
import { decimalAdd, decimalSum } from './money-precision.mjs';
import path from 'node:path';
import { readJson, writeJson, dayKey } from './paths.mjs';

const initialLedger = () => ({ version: 1, date: '', observed: 0, firstObservation: null, lastObservation: null,
  dayBaseline: null, correction: null, correctionLog: [], history: {}, events: [] });

function observationOf(value) {
  if (!value || !Number.isFinite(value.at)) return null;
  return {
    balance: Number.isFinite(value.balance) ? value.balance : null,
    used: Number.isFinite(value.used) ? value.used : null,
    at: value.at,
    counter: value.counter === 'used' ? 'used' : value.counter === 'balance' ? 'balance' : null,
    ...(typeof value.meterKey === 'string' ? { meterKey: value.meterKey } : {}),
    ...(value.meterVersion === 2 ? { meterVersion: 2 } : {}),
  };
}

function effectiveTotal(row) {
  if (row?.correction && Number.isFinite(Number(row.correction.amount))) return Number(row.correction.amount);
  return Number.isFinite(Number(row?.total ?? row?.observed)) ? Number(row.total ?? row.observed) : 0;
}

function correctionRevision(day, row) {
  return [day, row?.observed ?? row?.total ?? 0, row?.last?.at ?? row?.lastObservation?.at ?? 0,
    row?.correction?.at ?? 0].join(':');
}

function adjustment(value, required = false) {
  if (value === '' || value === null || value === undefined) {
    if (required) throw new Error('请填写本统计区间的累计到账金额，未充值请填 0');
    return '0';
  }
  const text = String(value);
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,8})?$/.test(text)) throw new Error('金额须为非负数，最多保留 8 位小数');
  return text;
}

export class UsageLedger {
  constructor(dataDir) { this.dataDir = dataDir; }
  file(scope) {
    if (!/^[a-f0-9]{24}-[A-Z]{3}$/.test(scope)) throw new Error('记账账户标识无效');
    return path.join(this.dataDir, 'ledgers', scope + '.json');
  }
  scopes() {
    try { return fs.readdirSync(path.join(this.dataDir, 'ledgers')).filter(name => /^[a-f0-9]{24}-[A-Z]{3}\.json$/.test(name)).map(name => name.slice(0, -5)).sort(); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }
  load(scope) { return readJson(this.file(scope), initialLedger()); }
  save(scope, ledger) { writeJson(this.file(scope), ledger); }
  rollover(led, now) {
    const today = dayKey(now);
    if (led.date !== today) {
      if (led.date) {
        const observed = Number(led.observed) || 0;
        led.history[led.date] = {
          total: effectiveTotal({ observed, correction: led.correction }),
          observed,
          since: led.firstObservation,
          baseline: observationOf(led.dayBaseline),
          last: observationOf(led.lastObservation),
          correction: led.correction || null,
        };
      }
      const carried = observationOf(led.lastObservation);
      // Keep the last meter reading across midnight. The interval spanning
      // midnight belongs to its observation date; it is not a per-request bill.
      led.date = today; led.observed = 0; led.observedExact = '0'; led.firstObservation = null;
      led.dayBaseline = carried; led.correction = null;
    }
    return led;
  }
  observe(scope, sample, now = Date.now()) {
    if (sample.stale || sample.ok === false || sample.canObserve === false || ['unconfirmed', 'unsupported'].includes(sample.balanceStatus)) return this.load(scope);
    const led = this.rollover(this.load(scope), now);
    const balance = Number.isFinite(sample.totalBalance) ? sample.totalBalance : null;
    const used = Number.isFinite(sample.totalUsed) ? sample.totalUsed : null;
    if (balance === null && used === null) return this.load(scope);
    const last = led.lastObservation;
    let delta = '0';
    const meterKey = typeof sample.meterKey === 'string' && /^[a-f0-9]{64}$/.test(sample.meterKey) ? sample.meterKey : null;
    // A newer reading can legitimately reset to zero. Ordering is handled by
    // the service, while a changed adapter/scale starts a new meter baseline.
    const compatible = sample.meterVersion === 2
      ? last?.meterVersion === 2 && !!meterKey && last.meterKey === meterKey
      : !meterKey || !last?.meterKey || last.meterKey === meterKey;
    if (last && compatible) {
      if (used !== null && last.used !== null && used >= last.used) delta = decimalAdd(used, last.used, true);
      else if (used === null && last.used === null && balance !== null && last.balance !== null) delta = last.balance >= balance ? decimalAdd(last.balance, balance, true) : '0';
    }
    observeAccountDebit(led, { delta, meterKey, mode: used !== null ? 'used' : balance !== null ? 'balance' : 'unavailable',
      at: now, intervalStart: last?.at ?? now, concurrentCount: sample.concurrentCount });
    led.observedExact = decimalAdd(Number(led.observedExact) === led.observed ? led.observedExact : led.observed, delta);
    led.observed = Number(led.observedExact);
    led.dayBaseline ||= {
      balance, used, at: now, counter: used !== null ? 'used' : balance !== null ? 'balance' : null,
      ...(meterKey ? { meterKey } : {}), ...(sample.meterVersion === 2 ? { meterVersion: 2 } : {}),
    };
    led.firstObservation ||= now;
    led.lastObservation = { balance, used, at: now, ...(meterKey ? { meterKey } : {}),
      ...(sample.meterVersion === 2 ? { meterVersion: 2 } : {}),
      counter: used !== null ? 'used' : balance !== null ? 'balance' : null,
      ...(/^[a-f0-9]{64}$/.test(sample.configurationKey || '') ? { configurationKey: sample.configurationKey } : {}) };
    this.save(scope, led); return led;
  }
  accountNotice(scope, meterKey) {
    const led = this.load(scope), result = issueAccountNotice(led, scope, meterKey);
    if (result.changed) this.save(scope, led);
    return result.notice;
  }
  acknowledgeNotices(scope, meterKey, ids) {
    const led = this.load(scope), result = acknowledgeAccountNotices(led, meterKey, ids);
    if (result.changed) this.save(scope, led);
    return result.acknowledged;
  }
  append(scope, event) {
    const led = this.load(scope);
    if (led.events.some(e => this.sameEvent(e, event))) return false;
    led.events.push({ ...event, day: dayKey(event.ts) });
    led.events = led.events.slice(-8000);
    this.save(scope, led); return true;
  }
  sameEvent(existing, event) {
    return existing.id === event.id || !!(event.sessionId && event.turnId &&
      existing.id?.endsWith(event.sessionId + ':' + event.turnId));
  }
  find(scope, event) { return this.load(scope).events.find(e => this.sameEvent(e, event)) || null; }
  revise(scope, id, patch) {
    const led = this.load(scope), index = led.events.findIndex(e => e.id === id);
    if (index < 0) return null;
    const before = led.events[index];
    if (Object.entries(patch).every(([key, value]) => JSON.stringify(before[key]) === JSON.stringify(value))) return before;
    const next = { ...before, ...patch, id: before.id, ts: before.ts, day: before.day, revision: (before.revision || 0) + 1 };
    led.events[index] = next; this.save(scope, led); return next;
  }
  correctionDays(scope, now = Date.now()) {
    const led = this.rollover(this.load(scope), now);
    const today = dayKey(now);
    const dates = [...new Set([led.date || today, ...Object.keys(led.history || {})])].sort().reverse();
    return dates.map(day => {
      const current = day === led.date;
      const row = current ? led : led.history[day];
      if (!row) return null;
      const baseline = observationOf(current ? led.dayBaseline : row.baseline);
      const last = observationOf(current ? led.lastObservation : row.last);
      const observed = Number((current ? led.observed : row.observed ?? row.total) || 0);
      const correction = (current ? led.correction : row.correction) || null;
      const canCorrect = !!baseline && !!last && baseline.counter === 'balance' && last.counter === 'balance' &&
        (!baseline.meterKey || !last.meterKey || baseline.meterKey === last.meterKey);
      return {
        day, currency: scope.slice(-3), observed,
        total: effectiveTotal({ observed, correction }), corrected: !!correction,
        correction, canCorrect,
        reason: canCorrect ? null : '该日缺少可核对的开头与当前余额，无法自动重算',
        baseline, last,
        revision: correctionRevision(day, { observed, last, correction }),
      };
    }).filter(Boolean);
  }
  reconcile(scope, input, now = Date.now()) {
    const led = this.rollover(this.load(scope), now);
    const day = String(input?.day || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('请选择有效的记账日期');
    const current = day === led.date;
    const row = current ? led : led.history?.[day];
    if (!row) throw new Error('这一天没有余额观测记录，无法校正');
    const baseline = observationOf(current ? led.dayBaseline : row.baseline);
    const last = observationOf(current ? led.lastObservation : row.last);
    const observed = Number((current ? led.observed : row.observed ?? row.total) || 0);
    const old = (current ? led.correction : row.correction) || null;
    if (input?.revision !== correctionRevision(day, { observed, last, correction: old })) {
      const error = new Error('余额或校正记录已更新，请重新打开校正窗口后核对金额');
      error.status = 409;
      throw error;
    }
    const action = input?.action === 'reset' ? 'reset' : 'save';
    let correction = null;
    if (action === 'save') {
      if (input?.confirmed !== true) throw new Error('请先确认已核对本统计区间的全部余额调整');
      if (!baseline || !last || baseline.counter !== 'balance' || last.counter !== 'balance' ||
          (baseline.meterKey && last.meterKey && baseline.meterKey !== last.meterKey)) {
        throw new Error('该日缺少同一余额口径的开头与当前余额，无法保存校正');
      }
      const credits = adjustment(input.credits, true);
      const otherDebits = adjustment(input.otherDebits);
      const exact = decimalAdd(decimalAdd(decimalAdd(baseline.balance, credits), otherDebits, true), last.balance, true);
      const amount = Number(exact);
      if (!Number.isFinite(amount) || amount < 0 || !/^[0-9]+(?:\.[0-9]+)?$/.test(exact)) {
        throw new Error('校正后消费为负或超出范围，请核对统计起点与累计到账金额');
      }
      correction = { at: now, amount, observed, credits: Number(credits), otherDebits: Number(otherDebits) };
    }
    const log = current ? (led.correctionLog ||= []) : (row.correctionLog ||= []);
    log.push({ at: now, previous: old, next: correction });
    if (log.length > 50) log.splice(0, log.length - 50);
    if (current) led.correction = correction; else { row.correction = correction; row.total = effectiveTotal(row); }
    this.save(scope, led);
    return this.correctionDays(scope, now).find(item => item.day === day);
  }
  records(scope, now = Date.now()) {
    const led = this.rollover(this.load(scope), now);
    const today = dayKey(now);
    const modelsFor = day => {
      const models = new Map();
      for (const e of led.events) {
        if (e.day !== day || e.source !== 'configured-pricing-estimate') continue;
        models.set(e.model, decimalAdd(models.get(e.model) || 0, e.cost || 0));
      }
      return [...models].map(([model, cost]) => ({ model: model + '（估算）', cost: Number(cost) })).sort((a, b) => b.cost - a.cost);
    };
    const rowFor = day => day === today ? led : Object.hasOwn(led.history, day) ? led.history[day] : null;
    const totalDay = day => {
      const row = rowFor(day);
      return row === null ? null : effectiveTotal(row);
    };
    const days7 = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const date = dayKey(d), total = totalDay(date);
      days7.push({ date, total, totalState: total === null ? 'unknown' : rowFor(date)?.correction ? 'corrected' : 'observed', models: modelsFor(date) });
    }
    const days = [...new Set([today, ...Object.keys(led.history), ...led.events.map(e => e.day)])].sort().reverse();
    const missingSummaryDays = days.filter(date => totalDay(date) === null);
    const todayCorrection = led.correction || null;
    return { ok: true, today: { total: totalDay(today), observed: led.observed, correction: todayCorrection,
      corrected: !!todayCorrection, models: modelsFor(today), since: led.firstObservation }, days7,
      total7: decimalSum(days7.map(d => d.total || 0)),
      total7Complete: days7.every(d => d.total !== null),
      all: { days: days.map(date => ({
        date, total: totalDay(date), totalState: totalDay(date) === null ? 'unknown' : rowFor(date)?.correction ? 'corrected' : 'observed',
        observed: Number((rowFor(date)?.observed ?? rowFor(date)?.total) || 0),
        corrected: !!rowFor(date)?.correction, models: modelsFor(date),
      })),
        total: decimalSum(days.map(day => totalDay(day) || 0)), totalComplete: missingSummaryDays.length === 0,
        missingSummaryDays, events: led.events.slice(-500).reverse().map(normalizeTurnCost), storedEventCount: led.events.length, detailLimit: 500 },
      usageSource: 'observed-api-debits', note: '每日合计来自同密钥累计消耗或余额差值；停机或跨午夜的观测间隔归入再次观测日，不能拆成精确逐请求账单。日汇总长期保留，明细最多保留 8000 条、页面提供最近 500 条。旧版已删除的日汇总显示未知，不冒充零消费；模型金额为配置价格估算。' };
  }
}

export function usageDefaults() {
  return {
    taskEnd: { on: false, sel: '' },
    alert: { on: true, below: 5, msg: '余额已低于 {currency}{below}', lines: [
      { type: 'text', text: '老大～你的 API 余额', size: 5, bold: true },
      { type: 'text', text: '已经不足 {currency}{below} 啦', size: 6, bold: true, rgb: 'rouge' },
      { type: 'image', imgId: 'bimg_yue_money', size: 6, imgScale: 0.3 },
      { type: 'link', text: '打开当前 API 账单', url: '/provider-dashboard', size: 2, color: '#ffffff', bgRgb: 'indigo' },
    ], autoClose: false, ttlSec: 6 },
    budget: { on: true, amount: 10, msg: '今日已观测用量达到 {currency}{amount}', lines: [
      { type: 'text', text: '今天已观测用量超过', size: 6, bold: true },
      { type: 'text', text: '{currency}{amount}', size: 7, bold: true, rgb: 'rouge' },
    ], autoClose: false, ttlSec: 6 },
  };
}

// Compatibility is a read projection: original history and daily totals remain intact.
export function normalizeTurnCost(event) {
  if (event?.source !== 'shared-key-interval') return event;
  return { ...event, accountIntervalAmount: event.accountIntervalAmount ?? event.amount ?? event.cost ?? null,
    accountIntervalCurrency: event.accountIntervalCurrency || event.currency,
    amount: null, cost: null, costState: 'unknown', source: 'token-only', label: '本轮费用未知:',
    note: '旧记录金额仅为同密钥账户期间扣费，无法归属本轮。' };
}
