(() => {
  'use strict';
  function node(parent, tag, text, cls) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (cls) element.className = cls;
    parent.append(element);
    return element;
  }
  function money(value, currency) {
    if (!Number.isFinite(Number(value))) return '—';
    try { return window.WhaleMoney?.formatMoney(Number(value), currency) || Number(value).toFixed(2) + ' ' + currency; }
    catch { return Number(value).toFixed(2) + ' ' + currency; }
  }
  function when(value) {
    const time = new Date(Number(value));
    return Number.isFinite(time.getTime()) ? time.toLocaleString() : '未知';
  }
  async function request(url, options) {
    const response = await fetch(url, { cache: 'no-store', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || data.ok === false) throw new Error(data.error || '余额校正请求失败');
    return data;
  }
  function open() {
    const dialog = document.createElement('dialog');
    dialog.className = 'whale-v3-dialog whale-adjust-dialog';
    node(dialog, 'h2', '余额校正');
    node(dialog, 'p', '用于核对充值和余额调整对“今日已观测消耗”的影响。保存只修改本地校正视图，不改写原始观测记录、账户余额或服务商账单。');
    const status = node(dialog, 'p', '正在读取记账日期…', 'whale-dashboard-note');
    status.setAttribute('role', 'status');
    const form = node(dialog, 'div');
    const dayLabel = node(form, 'label', '记账日期');
    const day = node(dayLabel, 'select');
    const dataBox = node(form, 'pre', '', 'connection-preview');
    dataBox.style.whiteSpace = 'pre-wrap';
    const creditsLabel = node(form, 'label', '本统计区间累计到账金额（含充值、赠金）');
    const credits = node(creditsLabel, 'input');
    credits.type = 'number'; credits.min = '0'; credits.step = '0.00000001'; credits.value = '0';
    const debitsLabel = node(form, 'label', '非调用造成的余额减少');
    const debits = node(debitsLabel, 'input');
    debits.type = 'number'; debits.min = '0'; debits.step = '0.00000001'; debits.value = '0';
    const confirmLabel = node(form, 'label');
    const confirmed = node(confirmLabel, 'input');
    confirmed.type = 'checkbox';
    confirmLabel.append(document.createTextNode(' 我已核对本统计区间的全部余额调整'));
    const preview = node(form, 'p', '选择日期后显示校正预览', 'whale-dashboard-note');
    const actions = node(dialog, 'div', '', 'dialog-actions');
    const save = node(actions, 'button', '保存校正');
    save.className = 'primary';
    const reset = node(actions, 'button', '撤销该日校正');
    const refresh = node(actions, 'button', '刷新');
    const close = node(actions, 'button', '关闭');
    let current = null;
    function selected() { return current?.days?.find(item => item.day === day.value) || null; }
    function paint() {
      const item = selected();
      if (!item) {
        dataBox.textContent = '暂无可用记账日期。';
        save.disabled = reset.disabled = true;
        return;
      }
      dataBox.textContent = [
        '原始观测消费：' + money(item.observed, item.currency),
        '当前显示消费：' + money(item.total, item.currency),
        '统计起点：' + when(item.baseline?.at),
        '起点余额：' + money(item.baseline?.balance, item.currency),
        '最近观测：' + when(item.last?.at),
        '当前余额：' + money(item.last?.balance, item.currency),
        item.corrected ? '状态：已校正，可撤销' : '状态：未校正',
      ].join('\n');
      save.disabled = !item.canCorrect;
      reset.disabled = !item.corrected;
      credits.disabled = debits.disabled = confirmed.disabled = !item.canCorrect;
      const amount = item.baseline && item.last
        ? Number(item.baseline.balance) + Number(credits.value || 0) - Number(debits.value || 0) - Number(item.last.balance)
        : NaN;
      preview.textContent = !item.canCorrect ? item.reason : Number.isFinite(amount) && amount >= 0
        ? '校正后消费：' + money(amount, item.currency)
        : '校正后为负数，请核对金额和统计起点';
    }
    async function load() {
      status.textContent = '正在读取记账日期…';
      save.disabled = reset.disabled = true;
      try {
        current = await request('/dsh-whale/balance-adjustments.json');
        const keep = day.value;
        day.replaceChildren();
        for (const item of current.days || []) {
          const option = document.createElement('option');
          option.value = item.day;
          option.textContent = item.day + (item.corrected ? ' · 已校正' : '') + (item.canCorrect ? '' : ' · 数据不完整');
          day.append(option);
        }
        if (keep && current.days?.some(item => item.day === keep)) day.value = keep;
        status.textContent = current.days?.length ? '仅支持余额类接口；累计消耗类接口没有可反推的开头余额。' : '暂时没有可校正的余额观测。';
        paint();
      } catch (error) {
        status.textContent = error.message;
      }
    }
    async function submit(action) {
      const item = selected();
      if (!item) return;
      save.disabled = reset.disabled = true;
      try {
        const result = await request('/dsh-whale/balance-adjustments.json', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            day: item.day, revision: item.revision, action,
            credits: credits.value || '0', otherDebits: debits.value || '0', confirmed: confirmed.checked,
          }),
        });
        status.textContent = action === 'reset' ? '已撤销该日校正。' : '校正已保存。';
        await load();
        window.dispatchEvent(new CustomEvent('whale-balance-corrected', { detail: result }));
      } catch (error) {
        status.textContent = error.message;
      } finally {
        const next = selected();
        save.disabled = !next?.canCorrect;
        reset.disabled = !next?.corrected;
      }
    }
    day.addEventListener('change', () => { confirmed.checked = false; credits.value = '0'; debits.value = '0'; paint(); });
    credits.addEventListener('input', paint); debits.addEventListener('input', paint);
    refresh.onclick = load; save.onclick = () => submit('save'); reset.onclick = () => submit('reset');
    close.onclick = () => dialog.close();
    dialog.onclose = () => dialog.remove();
    document.body.append(dialog);
    dialog.showModal?.(); dialog.setAttribute('open', '');
    load();
  }
  function mount() {
    const actions = document.querySelector('.whale-dashboard-actions');
    if (!actions || actions.querySelector('[data-whale-adjust]')) return;
    const button = document.createElement('button');
    button.dataset.whaleAdjust = '1';
    button.textContent = '余额校正';
    button.onclick = open;
    actions.append(button);
  }
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', () => setTimeout(mount, 0), { once: true });
  else setTimeout(mount, 0);
  window.WhaleBalanceAdjustment = { open };
})();
