import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TARGET = path.join(ROOT, 'assets', 'upstream');
const COMMIT = '5247dd6813d6e4430728f39ccc63d43cda046022';
const BASE = 'https://raw.githubusercontent.com/MeteorNOX/DeepSeek-Balance-Whale-Widget/' + COMMIT + '/assets/';
const FILES = [
  ['DSniang1.png', 'DSniang1.png', 'DCC456613DBB1102A4B7EF636A8B622371E33B763489D6249C434FB54248BA5C'],
  ['DSniang02.png', 'DSniang02.png', 'BFCDAC201B183BD31CC154A9D5425DFA5C946FBBC4D6584B890B7E538776EB0D'],
  ['rua.gif', 'rua.gif', '0B9DD76DB4EA86CE3D3B07A56054AD33F25F6EB7A320472A4810859F183FC332'],
  ['bubble-petpet.gif', 'bubble-petpet.gif', '0B9DD76DB4EA86CE3D3B07A56054AD33F25F6EB7A320472A4810859F183FC332'],
  ['bubble-yue-money.gif', 'bubble-money1.gif', 'D3C8DF0F63F840292C68596B5E3F3E8CEB70C4FA612581737A9B0E3C653BDC8C'],
  ['Ya1.mp3', 'Ya1.mp3', '0AD8F934AE5FA3CBD42745E086A56AA6532766618C6A620B860A795BDC7689F9'],
  ['Ya2.mp3', 'Ya2.mp3', '1A8998077E5E306C3088BB442CE36617261DD58200754F457469A520801C565B'],
  ['D1.mp3', 'D1.mp3', '626C0FB5DBFB2529331B98B80FA29961EFBCBEF6A454B36328481B61D8A0C7BE'],
  ['D2.mp3', 'D2.mp3', '8327A07DA3EC17F42EC6DDDEC8F6E2862055C7BFA5E15E3908442C517FD0F22D'],
];

const args = new Set(process.argv.slice(2));
const checkOnly = args.has('--check');
if (!checkOnly && !args.has('--accept-upstream-terms')) {
  process.stderr.write('素材不在本项目公开发行范围内。\n' +
    '请先阅读原项目 PROVENANCE.md，确认仅随该插件使用、不再许可、as-is，并自行承担相关风险。\n' +
    '确认后运行：node scripts/fetch-upstream-assets.mjs --accept-upstream-terms\n');
  process.exitCode = 2;
} else {
  fs.mkdirSync(TARGET, { recursive: true });
  const rows = [];
  for (const [local, source, expected] of FILES) {
    const file = path.join(TARGET, local);
    let state = 'missing';
    if (fs.existsSync(file)) state = hash(file) === expected ? 'ready' : 'mismatch';
    rows.push({ local, source, state });
    if (checkOnly || state === 'ready') continue;
    const response = await fetch(BASE + source, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error('下载失败：' + local + '（HTTP ' + response.status + '）');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > 8 * 1024 * 1024) throw new Error('素材大小异常：' + local);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) throw new Error('素材大小异常：' + local);
    const actual = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
    if (actual !== expected) throw new Error('校验失败，未写入：' + local);
    const temp = file + '.' + process.pid + '.tmp';
    try {
      fs.writeFileSync(temp, bytes, { flag: 'wx', mode: 0o600 });
      fs.renameSync(temp, file);
    } catch (error) {
      try { fs.unlinkSync(temp); } catch {}
      throw error;
    }
    rows[rows.length - 1].state = 'fetched';
  }
  for (const row of rows) process.stdout.write(row.local + '\t' + row.state + '\n');
  if (!checkOnly) process.stdout.write('\n素材已写入本地忽略目录。请重启挂件；发布或提交前确认 git status 不包含 assets/upstream。\n');
}

function hash(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
}
