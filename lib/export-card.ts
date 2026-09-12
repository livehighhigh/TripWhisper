import {
  formatFetchedAt,
  resolveProvenance,
  stopExportLabel,
} from './content';
import { dateAt, type Journey } from './journey';
// A code-rendered itinerary document, not a screenshot of the interface.
export async function exportDayCard(j: Journey, index: number) {
  const day = j.days[index];
  if (!day) throw Error('找不到所选日期');
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw Error('此浏览器不支持图片导出，请使用打印功能。');
  const font = '"PingFang SC", "Microsoft YaHei", Arial, sans-serif';
  function wrap(text: string, width: number, size: number) {
    ctx!.font = `${size}px ${font}`;
    const lines: string[] = [];
    let line = '';
    for (const c of text) {
      if (c === '\n' || ctx!.measureText(line + c).width > width) {
        lines.push(line);
        line = c === '\n' ? '' : c;
      } else line += c;
    }
    if (line) lines.push(line);
    return lines;
  }
  const rows = day.stops.map((s) => {
    const p = resolveProvenance(s);
    return {
      stop: s,
      names: wrap(s.name, 760, 34),
      address: wrap(s.address, 760, 25),
      transport: wrap(s.transport, 760, 26),
      provenance: wrap(
        `${stopExportLabel(s)}  ·  来源 ${p.sourceUrl || '未提供来源链接'}  ·  ${formatFetchedAt(p.fetchedAt)}`,
        760,
        22,
      ),
    };
  });
  const heights = rows.map(
    (r) =>
      100 +
      r.names.length * 45 +
      r.address.length * 35 +
      r.transport.length * 37 +
      r.provenance.length * 30 +
      36,
  );
  const title = wrap(day.title, 940, 48);
  canvas.height =
    310 + title.length * 62 + heights.reduce((a, b) => a + b + 22, 0) + 235;
  ctx.fillStyle = '#f1f6f9';
  ctx.fillRect(0, 0, 1080, canvas.height);
  ctx.fillStyle = '#084f69';
  ctx.fillRect(0, 0, 1080, 265 + title.length * 62);
  function text(
    value: string,
    x: number,
    y: number,
    size: number,
    color = '#183343',
    weight = 'normal',
  ) {
    ctx!.fillStyle = color;
    ctx!.font = `${weight} ${size}px ${font}`;
    ctx!.fillText(value, x, y);
  }
  text('TripWhisper  /  DAILY FIELD NOTES', 60, 68, 28, '#c5e3ec');
  text(
    `DAY ${String(index + 1).padStart(2, '0')} · ${day.city}`,
    60,
    127,
    30,
    '#c5e3ec',
  );
  title.forEach((line, i) =>
    text(line, 60, 204 + i * 62, 48, '#ffffff', 'bold'),
  );
  text(
    `${dateAt(j.profile.date, index)}  ·  ${j.profile.people} 人同行  ·  行程版本 ${j.version}`,
    60,
    250 + title.length * 62,
    25,
    '#c5e3ec',
  );
  let y = 310 + title.length * 62;
  rows.forEach((r, i) => {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(40, y, 1000, heights[i], 18);
    ctx.fill();
    text(r.stop.time, 70, y + 55, 29, '#08758c', 'bold');
    text(r.stop.end, 70, y + 92, 22, '#688593');
    let ty = y + 55;
    r.names.forEach((line) => {
      text(line, 230, ty, 34, '#173e4e', 'bold');
      ty += 45;
    });
    r.address.forEach((line) => {
      text(line, 230, ty, 25, '#5c7b8b');
      ty += 35;
    });
    ty += 10;
    r.transport.forEach((line) => {
      text(line, 230, ty, 26);
      ty += 37;
    });
    text(
      (r.stop.locked ? '已锁定 · 时间保留 · ' : '') + stopExportLabel(r.stop),
      230,
      ty + 8,
      23,
      '#08758c',
    );
    ty += 40;
    r.provenance.forEach((line) => {
      text(line, 230, ty, 22, '#688593');
      ty += 30;
    });
    y += heights[i] + 22;
  });
  text('出发前，再确认一下。', 60, y + 38, 29, '#084f69', 'bold');
  text(
    '开放时间、天气、班次和票价未实时核验；示范估值不是报价。',
    60,
    y + 84,
    24,
    '#58717f',
  );
  text(
    '这张图是离线行动参考，最新调整请回到网页查看。',
    60,
    y + 123,
    24,
    '#58717f',
  );
  text('TripWhisper · 把期待，变成每一天。', 60, y + 181, 24, '#58717f');
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(Error('图片生成失败，请重试。'))),
      'image/png',
    ),
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `TripWhisper-Day${index + 1}-${dateAt(j.profile.date, index)}.png`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
