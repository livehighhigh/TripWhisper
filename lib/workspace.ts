import {
  dateAt,
  type Journey,
  type Stop,
  type Profile,
  generate,
} from './journey';
import { inspectJourney } from './health';
export type BookingInput = {
  date: string;
  name: string;
  address: string;
  time: string;
  end: string;
  cost: string;
  url: string;
};
const timeMinutes = (s: string) =>
  Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
export function previewBooking(j: Journey, b: BookingInput, id: string) {
  const i = j.days.findIndex((_, n) => dateAt(j.profile.date, n) === b.date);
  if (i < 0) throw Error('预订日期不在当前行程内，请先调整行程日期。');
  if (!b.name.trim() || !b.address.trim())
    throw Error('请填写预订名称和地址。');
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end) ||
    b.end <= b.time
  )
    throw Error('请填写同一天内有效的开始和结束时间。');
  const cents = parseMoney(b.cost);
  let url: string | undefined;
  if (b.url.trim()) {
    try {
      const u = new URL(b.url);
      if (u.protocol !== 'https:') throw Error();
      url = u.href;
    } catch {
      throw Error('预订链接必须是有效的 https:// 地址。');
    }
  }
  const overlap = j.days[i].stops.filter(
    (s) =>
      timeMinutes(s.time) < timeMinutes(b.end) + 15 &&
      timeMinutes(s.end) + 15 > timeMinutes(b.time),
  );
  if (overlap.some((s) => s.locked || s.kind === '交通'))
    throw Error(
      '与已锁定预订或交通时段冲突（含 15 分钟缓冲）。请先修改预订时间或交通安排。',
    );
  const stop: Stop = {
    id: 'booking-' + id,
    time: b.time,
    end: b.end,
    name: b.name.trim(),
    local: b.name.trim(),
    address: b.address.trim(),
    kind: '我的预订',
    transport:
      '按实际地址查询路线，至少提前 15 分钟到达；跨区域请增加交通时间。',
    cost: cents / 100,
    story: '你手动录入的预订，系统不会改变其日期和时间。',
    tip: '请自行保管票券，日期与入场规则以实际订单为准。此处没有代订或支付。',
    url,
    locked: true,
  };
  const next = structuredClone(j);
  const removedIds = new Set(overlap.map((s) => s.id));
  next.days[i].stops = [
    ...next.days[i].stops.filter((s) => !removedIds.has(s.id)),
    stop,
  ].sort((a, b) => a.time.localeCompare(b.time));
  next.version++;
  return { next, removed: overlap.map((s) => s.name), day: i };
}
export function regenerateWithBookings(
  p: Profile,
  memories: string[],
  old: Journey,
) {
  let next = generate(p, memories);
  const bookings = old.days.flatMap((d, i) =>
    d.stops
      .filter((s) => s.kind === '我的预订')
      .map((s) => ({ date: dateAt(old.profile.date, i), stop: s })),
  );
  for (const b of bookings) {
    const input = {
      date: b.date,
      name: b.stop.name,
      address: b.stop.address,
      time: b.stop.time,
      end: b.stop.end,
      cost: String(b.stop.cost),
      url: b.stop.url || '',
    };
    next = previewBooking(next, input, b.stop.id.replace(/^booking-/, '')).next;
  }
  next.version = old.version + 1;
  return next;
}
export function auditJourney(j: Journey) {
  return inspectJourney(j).map((f) => f.title);
}
export function parseMoney(value: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(value))
    throw Error('金额请输入非负数字，最多两位小数。');
  const [whole, fraction = ''] = value.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}
export type Expense = {
  id: string;
  date: string;
  name: string;
  category: string;
  currency: 'EUR' | 'CNY';
  amountMinor: number;
  rate: number;
  eurMinor: number;
};
export function createExpense(
  input: {
    date: string;
    name: string;
    category: string;
    currency: 'EUR' | 'CNY';
    amount: string;
    rate: string;
  },
  id: string,
): Expense {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date) ||
    !Number.isFinite(new Date(input.date).getTime()) ||
    dateAt(input.date, 0) !== input.date
  )
    throw Error('请选择消费日期。');
  if (!input.name.trim()) throw Error('请填写这笔消费的名称。');
  if (!['EUR', 'CNY'].includes(input.currency)) throw Error('暂不支持此币种。');
  const amountMinor = parseMoney(input.amount);
  if (amountMinor <= 0) throw Error('消费金额需要大于 0。');
  const rate = Number(input.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100)
    throw Error('请输入有效汇率（1 欧元对应的人民币）。');
  return {
    id,
    date: input.date,
    name: input.name.trim(),
    category: input.category,
    currency: input.currency,
    amountMinor,
    rate,
    eurMinor:
      input.currency === 'EUR' ? amountMinor : Math.round(amountMinor / rate),
  };
}
export function dailyExpenses(items: Expense[]) {
  return items.reduce<Record<string, number>>((s, e) => {
    s[e.date] = (s[e.date] || 0) + e.eurMinor;
    return s;
  }, {});
}
export function safeExpense(value: unknown): value is Expense {
  const e = value as Expense;
  return (
    !!e &&
    typeof e.id === 'string' &&
    typeof e.date === 'string' &&
    typeof e.name === 'string' &&
    typeof e.category === 'string' &&
    ['EUR', 'CNY'].includes(e.currency) &&
    Number.isInteger(e.amountMinor) &&
    e.amountMinor > 0 &&
    Number.isInteger(e.eurMinor) &&
    e.eurMinor >= 0 &&
    Number.isFinite(e.rate) &&
    e.rate > 0
  );
}
