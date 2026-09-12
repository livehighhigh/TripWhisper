import { estimate, type Journey, type Stop } from './journey';
import { fromMinutes, isFixedStop, toMinutes } from './replan';

export const HEALTH_BUFFER = 15;
const MIN_SPAN = 30;
const DAY_END = 21 * 60;

export type HealthKind =
  | 'overlap'
  | 'buffer'
  | 'locked-conflict'
  | 'lodging'
  | 'missing-return'
  | 'info';

export type HealthFinding = {
  id: string;
  kind: HealthKind;
  severity: 'error' | 'warn' | 'info';
  title: string;
  rationale: string;
  suggestion: string;
  dayIndex?: number;
  stopIds: string[];
  fixable: boolean;
};

export type HealthChange = {
  action: 'shifted' | 'shortened' | 'removed' | 'hotel' | 'inserted';
  name: string;
  dayIndex?: number;
  fromTime?: string;
  fromEnd?: string;
  toTime?: string;
  toEnd?: string;
  reason: string;
};

export type HealthPreview = {
  next: Journey;
  baseVersion: number;
  selected: string[];
  changes: HealthChange[];
  tradeoffs: string[];
  remaining: HealthFinding[];
  budgetFrom: number;
  budgetTo: number;
};

export const SAMPLE_PROBLEM_PLAN = `住宿：

第1天
09:30-11:30 米兰大教堂 〔已订〕
10:30-12:30 拱廊散步与午餐
12:40-14:00 附近咖啡馆休息

第2天
10:00-12:00 斯福尔扎城堡周边
11:00-13:00 附近午餐，自由选择
`;

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function padTime(value: string) {
  const match = value.trim().match(TIME);
  if (!match) throw new Error(`无法识别时间「${value}」。请使用 HH:MM。`);
  return match[1].padStart(2, '0') + ':' + match[2];
}

function dayLabel(index: number) {
  return `第 ${index + 1} 天`;
}

function stopById(stops: Stop[], id: string) {
  return stops.find((s) => s.id === id);
}

function lockReason(stop: Stop) {
  if (stop.locked) return '已订项目';
  if (stop.kind === '交通') return '交通时段';
  return '锁定项';
}

function looksLikeTransit(name: string) {
  return /火车|列车|返回|前往科莫|返程/.test(name);
}

function genericStop(
  name: string,
  time: string,
  end: string,
  locked: boolean,
  transit: boolean,
  address: string,
  index: number,
): Stop {
  return {
    id: 'pasted-' + index + '-' + name.slice(0, 12),
    time,
    end,
    name,
    local: name,
    address: address || '待补充',
    kind: locked ? '我的预订' : transit ? '交通' : '活动',
    transport: '来自文字计划的安排，实际交通时长请自行核实。',
    cost: 0,
    story: '这是粘贴或编辑后的文字计划，不是实时核验结果。',
    tip: '请自行核实开放时间、交通与库存。演示数据不能当作现场事实。',
    locked,
  };
}

function takeMatch(pool: Stop[], name: string) {
  const exact = pool.findIndex((s) => s.name === name);
  const i =
    exact >= 0 ? exact : pool.findIndex((s) => s.name.includes(name) || name.includes(s.name));
  if (i < 0) return null;
  return pool.splice(i, 1)[0];
}

export function serializeJourney(journey: Journey) {
  const lines = [`住宿：${journey.profile.hotel}`, ''];
  journey.days.forEach((day, i) => {
    lines.push(`第${i + 1}天 · ${day.title}`);
    for (const stop of day.stops) {
      const tags = [
        stop.locked ? '〔已订〕' : '',
        stop.kind === '交通' && !stop.locked ? '〔交通〕' : '',
      ]
        .filter(Boolean)
        .join(' ');
      lines.push(
        `${stop.time}-${stop.end} ${stop.name}${tags ? ' ' + tags : ''}`,
      );
    }
    lines.push('');
  });
  return lines.join('\n').trim() + '\n';
}

export function parsePlanText(base: Journey, text: string): Journey {
  const next = structuredClone(base);
  const raw = text.replace(/\r\n/g, '\n');
  if (!raw.trim()) throw new Error('请粘贴或编辑计划文本后再检查。');

  const hotelLine = raw.match(/^[ \t]*住宿[ \t]*[:：][ \t]*(.*)$/m);
  if (hotelLine) next.profile.hotel = hotelLine[1].trim();

  const blocks = raw.split(/^[ \t]*(?:第[ \t]*(\d+)[ \t]*天|Day[ \t]*(\d+))[^\n]*/gim);
  // split keeps capture groups: [preamble, n1, n2, body, n1, n2, body, ...]
  const parsedDays = new Map<number, { time: string; end: string; name: string; locked: boolean; transit: boolean }[]>();

  if (blocks.length === 1) {
    const stops = parseStopLines(blocks[0]);
    if (stops.length) parsedDays.set(0, stops);
  } else {
    for (let i = 1; i < blocks.length; i += 3) {
      const dayNo = Number(blocks[i] || blocks[i + 1]);
      const body = blocks[i + 2] || '';
      if (!Number.isInteger(dayNo) || dayNo < 1)
        throw new Error('天数编号无法识别。请写成「第1天」或「Day 1」。');
      if (dayNo > next.days.length)
        throw new Error(
          `文字里的第 ${dayNo} 天超出当前行程（共 ${next.days.length} 天），原行程未改动。`,
        );
      parsedDays.set(dayNo - 1, parseStopLines(body));
    }
  }

  if (!parsedDays.size && !hotelLine)
    throw new Error('没有识别到住宿行或「HH:MM-HH:MM 名称」活动行，原行程未改动。');

  let created = 0;
  for (const [dayIndex, lines] of parsedDays) {
    if (!lines.length)
      throw new Error(`${dayLabel(dayIndex)} 没有可识别的活动行，原行程未改动。`);
    const unused = [...next.days[dayIndex].stops];
    const extras = next.days.flatMap((d) => d.stops);
    next.days[dayIndex].stops = lines.map((line) => {
      const found =
        takeMatch(unused, line.name) || takeMatch(extras, line.name);
      if (found) {
        return {
          ...found,
          time: line.time,
          end: line.end,
          locked: line.locked || found.locked,
          kind: line.transit ? '交通' : found.kind,
        };
      }
      created += 1;
      return genericStop(
        line.name,
        line.time,
        line.end,
        line.locked,
        line.transit,
        next.profile.hotel,
        created,
      );
    });
  }
  return next;
}

function parseStopLines(body: string) {
  const stops: {
    time: string;
    end: string;
    name: string;
    locked: boolean;
    transit: boolean;
  }[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (!line || /^住宿\s*[:：]/.test(line)) continue;
    const match = line.match(
      /^(\d{1,2}:\d{2})\s*[-–—~]\s*(\d{1,2}:\d{2})\s+(.+)$/,
    );
    if (!match) {
      if (/^\d{1,2}:\d{2}/.test(line))
        throw new Error(`无法解析「${line}」。请写成 09:30-11:30 名称。`);
      continue;
    }
    const time = padTime(match[1]);
    const end = padTime(match[2]);
    if (end <= time)
      throw new Error(`「${match[3]}」的结束时间必须晚于开始时间。`);
    let rest = match[3].trim();
    const locked = /〔已订〕|\[已订\]|\blocked\b|已订/.test(rest);
    const transit = /〔交通〕|\[交通\]/.test(rest) || looksLikeTransit(rest);
    rest = rest
      .replace(/〔已订〕|\[已订\]|〔交通〕|\[交通\]|\blocked\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!rest) throw new Error('活动行缺少名称，原行程未改动。');
    stops.push({ time, end, name: rest, locked, transit });
  }
  return stops;
}

export function inspectJourney(journey: Journey): HealthFinding[] {
  const findings: HealthFinding[] = [];
  if (!journey.profile.hotel.trim()) {
    findings.push({
      id: 'lodging',
      kind: 'lodging',
      severity: 'warn',
      title: '住宿位置尚未填写',
      rationale: '出发与返程路线需要一个住宿参考点；当前偏好里的住宿文本为空。',
      suggestion:
        '在左侧补上住宿位置并勾选此项。确认后只写入行程记录，不会按地址算路。',
      stopIds: [],
      fixable: true,
    });
  }

  journey.days.forEach((day, dayIndex) => {
    const ordered = [...day.stops].sort((a, b) => a.time.localeCompare(b.time));
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i];
        const b = ordered[j];
        const pair = [a, b];
        const overlap =
          toMinutes(a.time) < toMinutes(b.end) &&
          toMinutes(b.time) < toMinutes(a.end);
        const gap = toMinutes(b.time) - toMinutes(a.end);
        const adjacent = j === i + 1;
        const lockedPair = pair.some(isFixedStop);
        if (overlap) {
          findings.push(
            lockedPair
              ? lockedFinding(dayIndex, a, b, 'overlap')
              : {
                  id: `overlap:${dayIndex}:${a.id}:${b.id}`,
                  kind: 'overlap',
                  severity: 'error',
                  title: `${dayLabel(dayIndex)} ${a.name} 与 ${b.name} 时间重叠`,
                  rationale: `${a.name} ${a.time}–${a.end} 与 ${b.name} ${b.time}–${b.end} 有交叉，同一人无法同时出现在两处。`,
                  suggestion: `把较晚的灵活活动移到 ${a.end} 之后并留出 ${HEALTH_BUFFER} 分钟缓冲。已订与交通时段不会被移动。`,
                  dayIndex,
                  stopIds: [a.id, b.id],
                  fixable: pair.some((s) => !isFixedStop(s)),
                },
          );
          continue;
        }
        if (adjacent && gap < HEALTH_BUFFER) {
          findings.push(
            lockedPair
              ? lockedFinding(dayIndex, a, b, 'buffer')
              : {
                  id: `buffer:${dayIndex}:${a.id}:${b.id}`,
                  kind: 'buffer',
                  severity: 'warn',
                  title: `${dayLabel(dayIndex)} ${a.name} 与 ${b.name} 缓冲不足`,
                  rationale: `两项仅间隔 ${gap} 分钟，少于约定的 ${HEALTH_BUFFER} 分钟衔接缓冲。`,
                  suggestion: `将后者开始时间调整到 ${a.end} 之后 ${HEALTH_BUFFER} 分钟。跨区域仍需自行核实交通。`,
                  dayIndex,
                  stopIds: [a.id, b.id],
                  fixable: pair.some((s) => !isFixedStop(s)),
                },
          );
        }
      }
    }
    if (day.city === 'COMO' && !day.stops.some((s) => s.id === 'return')) {
      findings.push({
        id: `missing-return:${dayIndex}`,
        kind: 'missing-return',
        severity: 'warn',
        title: `${dayLabel(dayIndex)} 缺少返回米兰的安排`,
        rationale: '科莫日没有 id 为 return 的返程交通，晚上可能无法接上米兰住宿。',
        suggestion: `插入 17:00–19:00 返回米兰的示范交通；若与已订项目冲突则不会强行插入。`,
        dayIndex,
        stopIds: [],
        fixable: true,
      });
    }
  });

  findings.push({
    id: 'info-unverified',
    kind: 'info',
    severity: 'info',
    title: '天气、开放时间与余票尚未自动核验',
    rationale:
      '体检只根据行程内的时间表和锁定标记做规则检查。米兰 / 科莫示范内容不是现场营业或班次事实。',
    suggestion: '请自行打开官网或「认识目的地」中的链接核实。此项不能自动修复。',
    stopIds: [],
    fixable: false,
  });
  return findings;
}

function lockedFinding(
  dayIndex: number,
  a: Stop,
  b: Stop,
  mode: 'overlap' | 'buffer',
): HealthFinding {
  const bothFixed = isFixedStop(a) && isFixedStop(b);
  const rationale =
    mode === 'overlap'
      ? `${a.name}（${lockReason(a)}，${a.time}–${a.end}）与 ${b.name}（${lockReason(b)}，${b.time}–${b.end}）时间交叉。`
      : `${a.name} 结束后到 ${b.name} 开始不足 ${HEALTH_BUFFER} 分钟，已订或交通时段需要完整缓冲。`;
  return {
    id: `locked:${dayIndex}:${a.id}:${b.id}`,
    kind: 'locked-conflict',
    severity: 'error',
    title: `${dayLabel(dayIndex)} 锁定预订或交通存在冲突`,
    rationale,
    suggestion: bothFixed
      ? '两项都是已订或交通，系统不会自动改时段。请回到「我的预订」修改时间，或改文字计划后重新检查。'
      : `保留${lockReason(isFixedStop(a) ? a : b)}，把灵活活动移到锁定结束之后并留 ${HEALTH_BUFFER} 分钟。`,
    dayIndex,
    stopIds: [a.id, b.id],
    fixable: !bothFixed,
  };
}

export function previewHealthFixes(
  journey: Journey,
  findingIds: string[],
  options: { hotel?: string; adopt?: boolean } = {},
): HealthPreview {
  const selected = [...new Set(findingIds)];
  if (!selected.length && !options.adopt)
    throw new Error('请先勾选要预览的修复。');

  const catalog = new Map(inspectJourney(journey).map((f) => [f.id, f]));
  const next = structuredClone(journey);
  const changes: HealthChange[] = [];
  const tradeoffs: string[] = [];

  const ordered = selected
    .map((id) => catalog.get(id))
    .filter((f): f is HealthFinding => !!f)
    .sort((a, b) => {
      const rank = (k: HealthKind) =>
        k === 'lodging'
          ? 0
          : k === 'locked-conflict'
            ? 1
            : k === 'overlap'
              ? 2
              : k === 'buffer'
                ? 3
                : k === 'missing-return'
                  ? 4
                  : 5;
      return (
        rank(a.kind) - rank(b.kind) ||
        (a.dayIndex ?? 0) - (b.dayIndex ?? 0) ||
        a.id.localeCompare(b.id)
      );
    });

  for (const id of selected) {
    if (!catalog.has(id))
      tradeoffs.push(`未找到问题 ${id}，已跳过，原行程未写入。`);
  }

  for (const finding of ordered) {
    if (finding.kind === 'lodging') {
      const hotel = (options.hotel ?? '').trim();
      if (!hotel) {
        tradeoffs.push('住宿位置仍为空，未写入。请先填写再预览。');
        continue;
      }
      next.profile.hotel = hotel;
      changes.push({
        action: 'hotel',
        name: hotel,
        reason: `写入住宿位置「${hotel}」。只作记录，不会按地址重新算路。`,
      });
      continue;
    }
    if (finding.kind === 'missing-return' && finding.dayIndex != null) {
      insertReturn(next, finding.dayIndex, changes, tradeoffs);
      continue;
    }
    if (finding.dayIndex == null || finding.stopIds.length < 2) {
      if (!finding.fixable)
        tradeoffs.push(`${finding.title}：此项不能自动修复。`);
      continue;
    }
    resolvePair(next, finding, changes, tradeoffs);
  }

  for (const day of next.days) {
    day.stops.sort((a, b) => a.time.localeCompare(b.time));
  }

  if (!changes.length && !options.adopt) {
    throw new Error('没有可应用的修复，原行程保持不变。');
  }

  next.version = journey.version + 1;
  return {
    next,
    baseVersion: journey.version,
    selected,
    changes,
    tradeoffs: [...new Set(tradeoffs)],
    remaining: inspectJourney(next).filter((f) => f.kind !== 'info' || f.id === 'info-unverified'),
    budgetFrom: estimate(journey),
    budgetTo: estimate(next),
  };
}

function insertReturn(
  next: Journey,
  dayIndex: number,
  changes: HealthChange[],
  tradeoffs: string[],
) {
  const day = next.days[dayIndex];
  if (!day) return;
  if (day.stops.some((s) => s.id === 'return')) {
    tradeoffs.push('当天已有返回米兰安排，未重复插入。');
    return;
  }
  const stop: Stop = {
    id: 'return',
    time: '17:00',
    end: '19:00',
    name: '返回米兰',
    local: 'Milano Centrale',
    address: 'Milano Centrale, Milano',
    kind: '交通',
    transport: '从 Como S. Giovanni 查询返回 Milano Centrale 的列车',
    cost: 0,
    story: '给返程留出余量，晚餐在住宿附近自行安排。',
    tip: '示范交通时段，不是已购车票。请自行核实末班车。',
  };
  const clash = day.stops.some(
    (s) =>
      isFixedStop(s) &&
      toMinutes(s.time) < toMinutes(stop.end) + HEALTH_BUFFER &&
      toMinutes(s.end) + HEALTH_BUFFER > toMinutes(stop.time),
  );
  if (clash) {
    tradeoffs.push('返回米兰会碰到已订或交通时段，未插入。请改时间后重试。');
    return;
  }
  day.stops.push(stop);
  changes.push({
    action: 'inserted',
    name: stop.name,
    dayIndex,
    toTime: stop.time,
    toEnd: stop.end,
    reason: '补上科莫日返回米兰的示范交通。',
  });
}

function resolvePair(
  next: Journey,
  finding: HealthFinding,
  changes: HealthChange[],
  tradeoffs: string[],
) {
  const day = next.days[finding.dayIndex!];
  const a = stopById(day.stops, finding.stopIds[0]);
  const b = stopById(day.stops, finding.stopIds[1]);
  if (!a || !b) {
    tradeoffs.push(`${finding.title} 涉及的活动已不在当天，已跳过。`);
    return;
  }
  const earlier =
    toMinutes(a.time) <= toMinutes(b.time) ? a : b;
  const later = earlier === a ? b : a;
  if (isFixedStop(earlier) && isFixedStop(later)) {
    tradeoffs.push(
      `${earlier.name} 与 ${later.name} 均为已订或交通，未改时段。`,
    );
    return;
  }
  const target = isFixedStop(later) ? earlier : later;
  const anchor = target === later ? earlier : later;
  const duration = toMinutes(target.end) - toMinutes(target.time);
  let start: number;
  let end: number;
  if (target === later) {
    start = toMinutes(anchor.end) + HEALTH_BUFFER;
    end = start + duration;
  } else {
    end = toMinutes(anchor.time) - HEALTH_BUFFER;
    start = end - duration;
    if (start < 0) {
      tradeoffs.push(
        `${target.name} 无法再往前挪，且对方为锁定项，未改时段。`,
      );
      return;
    }
  }
  applyTime(day, target, start, end, changes, tradeoffs);
}

function applyTime(
  day: Journey['days'][number],
  target: Stop,
  start: number,
  end: number,
  changes: HealthChange[],
  tradeoffs: string[],
) {
  const original = { time: target.time, end: target.end, name: target.name };
  let nextStart = start;
  let nextEnd = end;
  let shortened = false;

  const others = day.stops.filter((s) => s.id !== target.id);
  const prevFixed = others
    .filter((s) => isFixedStop(s) && toMinutes(s.end) <= nextStart + 24 * 60)
    .sort((a, b) => toMinutes(b.end) - toMinutes(a.end))[0];
  if (prevFixed) {
    const floor = toMinutes(prevFixed.end) + HEALTH_BUFFER;
    if (nextStart < floor) {
      const duration = nextEnd - nextStart;
      nextStart = floor;
      nextEnd = nextStart + duration;
    }
  }
  const nextFixed = others
    .filter((s) => isFixedStop(s) && toMinutes(s.time) >= toMinutes(original.time))
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time))[0];
  if (nextFixed) {
    const deadline = toMinutes(nextFixed.time) - HEALTH_BUFFER;
    if (nextEnd > deadline) {
      if (deadline - nextStart >= MIN_SPAN) {
        nextEnd = deadline;
        shortened = true;
        tradeoffs.push(
          `为衔接锁定的 ${nextFixed.name}（${nextFixed.time}），已压缩 ${target.name}。`,
        );
      } else {
        day.stops = day.stops.filter((s) => s.id !== target.id);
        changes.push({
          action: 'removed',
          name: target.name,
          fromTime: original.time,
          fromEnd: original.end,
          reason: `无法在锁定的 ${nextFixed.name} 前保留 ${MIN_SPAN} 分钟，已移除灵活活动。`,
        });
        return;
      }
    }
  }
  if (nextStart >= DAY_END) {
    day.stops = day.stops.filter((s) => s.id !== target.id);
    changes.push({
      action: 'removed',
      name: target.name,
      fromTime: original.time,
      fromEnd: original.end,
      reason: '顺延后已超过当天可安排时段，已移除。',
    });
    return;
  }
  if (nextEnd > DAY_END) {
    if (DAY_END - nextStart >= MIN_SPAN) {
      nextEnd = DAY_END;
      shortened = true;
      tradeoffs.push(`${target.name} 已压缩，以免拖到 21:00 之后。`);
    } else {
      day.stops = day.stops.filter((s) => s.id !== target.id);
      changes.push({
        action: 'removed',
        name: target.name,
        fromTime: original.time,
        fromEnd: original.end,
        reason: '顺延后过晚，已移除。',
      });
      return;
    }
  }

  target.time = fromMinutes(nextStart);
  target.end = fromMinutes(nextEnd);
  changes.push({
    action: shortened ? 'shortened' : 'shifted',
    name: target.name,
    fromTime: original.time,
    fromEnd: original.end,
    toTime: target.time,
    toEnd: target.end,
    reason: shortened
      ? '为衔接锁定预订或交通，已压缩停留时间。'
      : `已调整到 ${target.time}–${target.end}，避开重叠并保留 ${HEALTH_BUFFER} 分钟缓冲。`,
  });
}

export function journeysDifferForHealth(a: Journey, b: Journey) {
  const pack = (j: Journey) =>
    JSON.stringify({
      hotel: j.profile.hotel,
      days: j.days.map((d) =>
        d.stops.map((s) => [s.id, s.time, s.end, s.name, !!s.locked, s.kind]),
      ),
    });
  return pack(a) !== pack(b);
}
