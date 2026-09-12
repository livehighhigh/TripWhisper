export type Profile = {
  date: string;
  days: number;
  people: number;
  budget: number;
  hotel: string;
  interests: string[];
  slow: boolean;
  luggage: boolean;
  booked: boolean;
};
export type ContentOrigin = 'demo' | 'user';
export type ContentStatus = 'unverified';
export type Provenance = {
  origin: ContentOrigin;
  status: ContentStatus;
  sourceUrl: string;
  fetchedAt: string;
};
export type Stop = {
  id: string;
  time: string;
  end: string;
  name: string;
  local: string;
  address: string;
  kind: string;
  transport: string;
  cost: number;
  story: string;
  tip: string;
  url?: string;
  outdoor?: boolean;
  locked?: boolean;
  provenance?: Provenance;
};
export type Day = {
  title: string;
  city: string;
  stops: Stop[];
  reason: string;
};
export type Journey = {
  profile: Profile;
  days: Day[];
  version: number;
  applied: string[];
};
export const initialProfile: Profile = {
  date: '2026-10-12',
  days: 5,
  people: 2,
  budget: 800,
  hotel: 'Milano Centrale',
  interests: ['艺术与建筑', '湖畔自然'],
  slow: false,
  luggage: true,
  booked: true,
};
export const sources = {
  duomo: 'https://www.duomomilano.it/en/',
  brera: 'https://pinacotecabrera.org/en/',
  ferry: 'https://www.navigazionelaghi.it/en/',
  metro: 'https://www.atm.it/en/',
  train: 'https://www.trenord.it/en/',
};
const duomo: Stop = {
  id: 'duomo',
  time: '09:30',
  end: '11:30',
  name: '米兰大教堂',
  local: 'Duomo di Milano',
  address: 'Piazza del Duomo, Milano',
  kind: '建筑',
  transport: '从住宿地查询前往 Duomo 的交通，预留至少 45 分钟',
  cost: 30,
  story:
    '从 14 世纪开始建造的哥特式教堂。先观察正立面的雕塑，再留意内部的彩绘玻璃。',
  tip: '教堂参观需留意肩膀及膝部遮盖要求；屋顶参观以所购票种为准。',
  url: sources.duomo,
};
const gallery: Stop = {
  id: 'gallery',
  time: '12:00',
  end: '13:30',
  name: '拱廊散步与午餐',
  local: 'Galleria Vittorio Emanuele II',
  address: 'Piazza del Duomo, Milano',
  kind: '餐饮',
  transport: '从大教堂广场步行约 5 分钟；午餐自行选择',
  cost: 25,
  story: '玻璃穹顶下的十字形拱廊，是认识米兰商业与城市生活的一个入口。',
  tip: '菜单标价之外留意 coperto（餐位费）；点餐前确认。',
};
const brera: Stop = {
  id: 'brera',
  time: '15:00',
  end: '17:00',
  name: '布雷拉美术馆',
  local: 'Pinacoteca di Brera',
  address: 'Via Brera 28, Milano',
  kind: '艺术',
  transport: '从拱廊步行约 20 分钟；怕累可查询公共交通',
  cost: 20,
  story:
    '把时间留给少数作品。先看人物的目光与姿态，再读作品说明，感受意大利绘画的叙事方式。',
  tip: '需自行查阅日期对应的开放与预约信息；周一改为街区散步。',
  url: sources.brera,
};
const district: Stop = {
  id: 'district',
  time: '15:00',
  end: '16:30',
  name: '布雷拉街区漫步',
  local: 'Quartiere Brera',
  address: 'Via Brera, Milano',
  kind: '街区',
  transport: '从市中心步行约 20 分钟',
  cost: 8,
  story: '小画廊、书店和石板路交织在一起。留一段没有打卡任务的时间。',
  tip: '小路铺面不平，拉行李时优先选择宽阔道路。',
  outdoor: true,
};
const castle: Stop = {
  id: 'castle',
  time: '10:00',
  end: '12:00',
  name: '斯福尔扎城堡周边',
  local: 'Castello Sforzesco',
  address: 'Piazza Castello, Milano',
  kind: '历史',
  transport: '查询地铁至 Cairoli 或 Cadorna，按住宿位置选择',
  cost: 0,
  story: '城堡与周边街道适合一起看：权力中心如何逐渐变成市民的公共空间？',
  tip: '本项仅安排外围；博物馆参观须另查开放时间。',
  outdoor: true,
};
const park: Stop = {
  id: 'park',
  time: '14:30',
  end: '16:00',
  name: '森皮奥内公园',
  local: 'Parco Sempione',
  address: 'Parco Sempione, Milano',
  kind: '自然',
  transport: '从城堡步行约 10 分钟',
  cost: 0,
  story: '在城市绿地里慢下来，观察当地人的日常，而不只是看景点。',
  tip: '雨天替换为附近室内休息；请留意现场开放情况。',
  outdoor: true,
};
const como: Stop = {
  id: 'como',
  time: '09:00',
  end: '11:30',
  name: '乘火车前往科莫',
  local: 'Como San Giovanni',
  address: 'Como San Giovanni, Como',
  kind: '交通',
  transport:
    '从 Milano Centrale 查前往 Como S. Giovanni 的列车；含候车预留约 90 分钟',
  cost: 15,
  story: '这一天只看科莫镇与近岸景色，避免把多个湖边小镇塞进同一天。',
  tip: '往返车次、站点及末班车须在出发前核实。',
  url: sources.train,
};
const lake: Stop = {
  id: 'lake',
  time: '12:00',
  end: '14:00',
  name: '科莫老城午餐与湖边',
  local: 'Piazza Cavour, Como',
  address: 'Piazza Cavour, Como',
  kind: '自然',
  transport: '火车站至湖边步行约 15—20 分钟；行李留在米兰住宿处',
  cost: 25,
  story: '先从湖岸理解地形。湖边城镇、山坡与码头的位置，会直接影响旅行节奏。',
  tip: '并非所有湖畔住宿都平坦易达。预订前逐段检查码头到住宿的路线。',
  outdoor: true,
};
const ferry: Stop = {
  id: 'ferry',
  time: '14:30',
  end: '16:00',
  name: '湖上短途游船（可选）',
  local: 'Navigazione Lago di Como',
  address: 'Piazza Cavour, Como',
  kind: '游船',
  transport: '从湖边步行至码头；现场确认可返回科莫的短途航线',
  cost: 20,
  story: '从水上回望湖岸，留意建筑如何贴着山势展开。',
  tip: '没有实时船班；无合适往返航班或风雨时跳过，并提前返程。',
  url: sources.ferry,
  outdoor: true,
};
const returnTrip: Stop = {
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
  tip: '示范交通预算已计入上午；并非真实车票价格。',
  url: sources.train,
};
const canal: Stop = {
  id: 'canal',
  time: '16:00',
  end: '18:00',
  name: '纳维利运河边散步',
  local: 'Navigli',
  address: 'Alzaia Naviglio Grande, Milano',
  kind: '街区',
  transport: '查询地铁至 Porta Genova，再步行约 10 分钟',
  cost: 15,
  story: '运河曾经承担运输任务。傍晚沿水边走一段，看城市如何在工作之后放松。',
  tip: '饮品与小食范围因店而异，点单前询问；餐饮消费由自己决定。',
  outdoor: true,
};
const cafe: Stop = {
  id: 'cafe',
  time: '14:30',
  end: '16:00',
  name: '附近咖啡馆休息',
  local: 'Caffè · near your current stop',
  address: 'Piazza del Duomo, Milano',
  kind: '休息',
  transport: '在上一站附近自行选择室内咖啡馆，无需跨城移动',
  cost: 10,
  story: '把一段空白留给窗外的城市，也留给自己的感受。',
  tip: '这是休息建议，不是已核实的特定店铺或预订。',
};
const lunch: Stop = {
  ...gallery,
  id: 'lunch',
  time: '12:30',
  end: '14:00',
  name: '附近午餐，自由选择',
  local: 'Pranzo',
  transport: '在上一站步行约 10 分钟范围内选择',
  address: 'Piazza Castello, Milano',
};
export function dateAt(date: string, offset: number) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
export function generate(p: Profile, memories: string[] = []): Journey {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
    !Number.isFinite(new Date(p.date).getTime()) ||
    dateAt(p.date, 0) !== p.date ||
    !Number.isInteger(p.days) ||
    p.days < 3 ||
    p.days > 5 ||
    !Number.isInteger(p.people) ||
    !Number.isFinite(p.budget) ||
    p.people < 1 ||
    p.people > 8 ||
    p.budget < 1
  )
    throw new Error('请填写有效日期、3—5 天、1—8 人和大于 0 的预算。');
  const slow = p.slow || memories.includes('更喜欢慢节奏');
  const art = p.interests.includes('艺术与建筑');
  const templates: Day[] = [
    {
      title: '从大教堂，到布雷拉的街角',
      city: 'MILANO',
      stops: [{ ...duomo, locked: p.booked }, gallery, art ? brera : district],
      reason: art
        ? '你选择了艺术与建筑，为美术馆留出完整时段。'
        : '街区探索优先，不把每个时段都安排成参观。',
    },
    {
      title: '城堡、公园与不赶路的午后',
      city: 'MILANO',
      stops: [castle, lunch, park],
      reason: '以相邻区域为主，减少来回穿城。',
    },
    {
      title: '把一天留给科莫湖',
      city: 'COMO',
      stops: [como, lake, ferry, returnTrip],
      reason: p.luggage
        ? '大件行李留在米兰住宿处，采用轻装往返；请先与住宿方确认寄存。'
        : '安排同城往返，避免在一天里追逐多个湖边小镇。',
    },
    {
      title: '布雷拉的另一个下午',
      city: 'MILANO',
      stops: [
        { ...district, time: '10:00', end: '12:00' },
        { ...gallery, time: '12:30', end: '14:00' },
        canal,
      ],
      reason: '留出咖啡、书店和临时发现的空间。',
    },
    {
      title: '最后一杯咖啡，再见米兰',
      city: 'MILANO',
      stops: [
        { ...cafe, time: '10:00', end: '11:30' },
        { ...gallery, time: '12:00', end: '13:30' },
      ],
      reason: '返程航班尚未提供；下午留白，不代为估算机场出发时间。',
    },
  ];
  if (!p.interests.includes('湖畔自然'))
    templates[2] = {
      title: '留在米兰，细看一座城',
      city: 'MILANO',
      stops: [
        { ...brera, time: '10:00', end: '12:00' },
        lunch,
        { ...district, time: '15:00', end: '16:30' },
      ],
      reason: '没有选择湖畔自然，改为留在米兰的城市探索。',
    };
  if (p.interests.includes('街区生活'))
    templates[1] = {
      ...templates[1],
      stops: [castle, lunch, { ...district, time: '14:30', end: '16:00' }],
      reason: '根据街区生活偏好，把下午留给布雷拉街区。',
    };
  const days = templates.slice(0, p.days).map((d, i) => {
    let stops = d.stops.map((s) => ({ ...s }));
    if (new Date(dateAt(p.date, i) + 'T12:00:00Z').getUTCDay() === 1)
      stops = stops.map((s) =>
        s.id === 'brera' ? { ...district, time: s.time, end: s.end } : s,
      );
    if (slow)
      stops = stops.filter((s) => !['park', 'ferry', 'canal'].includes(s.id));
    return {
      ...d,
      stops,
      reason: d.reason + (slow ? ' 已按慢节奏减少可选活动。' : ''),
    };
  });
  return {
    profile: { ...p },
    days,
    version: 1,
    applied: memories.filter((x) => x === '更喜欢慢节奏'),
  };
}
export function adjust(
  j: Journey,
  index: number,
  mode: 'rain' | 'rest',
): Journey {
  if (!j.days[index]) throw new Error('找不到这一天');
  const copy = structuredClone(j);
  const d = copy.days[index];
  d.stops = d.stops.map((s) => {
    if (s.locked || s.kind === '交通') return s;
    if (
      (mode === 'rain' && s.outdoor) ||
      (mode === 'rest' &&
        ['艺术', '街区', '自然', '游船', '历史'].includes(s.kind))
    )
      return {
        ...cafe,
        id: s.id + '-' + mode,
        time: s.time,
        end: s.end,
        address: s.address,
        name: mode === 'rain' ? '附近室内休息与自由午餐' : '减少步行，原地休息',
        cost: 10,
        transport: '在上一站附近选择室内场所，具体店铺请现场确认',
      };
    return s;
  });
  d.reason =
    mode === 'rain'
      ? '按你提供的下雨情况，将可替换的户外活动改为附近室内休息。'
      : '减少参观与步行，把可选活动换成附近休息。';
  copy.version += 1;
  return copy;
}
export function estimate(j: Journey) {
  return (
    j.days.reduce((a, d) => a + d.stops.reduce((b, s) => b + s.cost, 0), 0) *
    j.profile.people
  );
}
export function directions(s: Stop) {
  return (
    'https://www.google.com/maps/search/?api=1&query=' +
    encodeURIComponent(s.address)
  );
}
