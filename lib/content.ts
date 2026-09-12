import {
  sources,
  type ContentOrigin,
  type ContentStatus,
  type Journey,
  type Provenance,
  type Stop,
} from './journey';

/** 米兰 / 科莫示范内容包最近一次在仓库内核对的时间。不是实时检索。 */
export const DEMO_CONTENT_FETCHED_AT = '2026-09-01T00:00:00.000Z';
export const YESMILANO = 'https://www.yesmilano.it/en';
export const VISITCOMO = 'https://www.visitcomo.eu/en/';

export function demoProvenance(sourceUrl: string): Provenance {
  return {
    origin: 'demo',
    status: 'unverified',
    sourceUrl,
    fetchedAt: DEMO_CONTENT_FETCHED_AT,
  };
}

export function userProvenance(
  sourceUrl: string,
  fetchedAt: string,
): Provenance {
  return {
    origin: 'user',
    status: 'unverified',
    sourceUrl,
    fetchedAt,
  };
}

const DEMO_SOURCE_BY_ID: Record<string, string> = {
  duomo: sources.duomo,
  gallery: YESMILANO,
  brera: sources.brera,
  district: YESMILANO,
  castle: YESMILANO,
  park: YESMILANO,
  como: sources.train,
  lake: VISITCOMO,
  ferry: sources.ferry,
  return: sources.train,
  canal: YESMILANO,
  cafe: YESMILANO,
  lunch: YESMILANO,
};

export function demoSourceUrl(id: string): string {
  if (/-(rain|rest)$/.test(id)) return YESMILANO;
  return DEMO_SOURCE_BY_ID[id] || YESMILANO;
}

function isProvenance(value: unknown): value is Provenance {
  if (!value || typeof value !== 'object') return false;
  const p = value as Provenance;
  return (
    (p.origin === 'demo' || p.origin === 'user') &&
    p.status === 'unverified' &&
    typeof p.sourceUrl === 'string' &&
    typeof p.fetchedAt === 'string'
  );
}

export function resolveProvenance(stop: Stop): Provenance {
  if (isProvenance(stop.provenance)) {
    if (stop.provenance.origin === 'user') {
      return {
        ...stop.provenance,
        sourceUrl: stop.provenance.sourceUrl || stop.url || '',
      };
    }
    return {
      ...stop.provenance,
      sourceUrl:
        stop.provenance.sourceUrl || stop.url || demoSourceUrl(stop.id),
    };
  }
  if (stop.kind === '我的预订') {
    return userProvenance(stop.url || '', '');
  }
  return demoProvenance(stop.url || demoSourceUrl(stop.id));
}

export function originLabel(origin: ContentOrigin): string {
  return origin === 'user' ? '你录入的' : '示范内容';
}

export function statusLabel(status: ContentStatus): string {
  return status === 'unverified' ? '待核验' : status;
}

export function timeFieldLabel(origin: ContentOrigin): string {
  return origin === 'user'
    ? '录入/记录时间'
    : '示范内容编入时间（非实时检索）';
}

export function formatFetchedAt(iso: string): string {
  if (!iso.trim()) return '尚未记录核验时间';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '尚未记录核验时间';
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

export function stopExportLabel(stop: Stop): string {
  const p = resolveProvenance(stop);
  return `${originLabel(p.origin)} · ${statusLabel(p.status)}`;
}

export function costCaption(stop: Stop): string {
  const p = resolveProvenance(stop);
  const kind = p.origin === 'user' ? '你记下的金额' : '示范估值';
  return `${kind} €${stop.cost} / 人 · 待核验，不是实时票价`;
}

export function preserveUserProvenance(
  prev: Journey,
  next: Journey,
  now = new Date().toISOString(),
): Journey {
  const prevById = new Map(
    prev.days.flatMap((d) => d.stops).map((s) => [s.id, s]),
  );
  return {
    ...next,
    days: next.days.map((d) => ({
      ...d,
      stops: d.stops.map((s) => {
        if (s.kind !== '我的预订') return s;
        const old = prevById.get(s.id);
        const prior = old ? resolveProvenance(old) : undefined;
        return {
          ...s,
          provenance: userProvenance(
            s.url || prior?.sourceUrl || '',
            prior?.fetchedAt || now,
          ),
        };
      }),
    })),
  };
}

export type LabeledStop = Stop & {
  provenance: Provenance;
  exportLabels: {
    origin: string;
    status: string;
    sourceUrl: string;
    fetchedAt: string;
    costKind: 'user-recorded-not-live' | 'demo-estimate-not-live';
  };
};

export function labelStopForExport(stop: Stop): LabeledStop {
  const provenance = resolveProvenance(stop);
  return {
    ...stop,
    provenance,
    exportLabels: {
      origin: originLabel(provenance.origin),
      status: statusLabel(provenance.status),
      sourceUrl: provenance.sourceUrl || '未提供来源链接',
      fetchedAt: formatFetchedAt(provenance.fetchedAt),
      costKind:
        provenance.origin === 'user'
          ? 'user-recorded-not-live'
          : 'demo-estimate-not-live',
    },
  };
}

export function exportTripPayload(
  journey: Journey,
  extras: {
    memories: string[];
    saved: { date: string; text: string }[];
    expenses: unknown[];
    checks: string[];
  },
  exportedAt = new Date().toISOString(),
) {
  return {
    schema: 1,
    exportedAt,
    contentNotice:
      '示范内容不是实时营业、班次、票价或余票。标为「待核验」的信息须出发前自行核实。「你录入的」只表示来源是用户记录，同样未做实时核验。',
    journey: {
      ...journey,
      days: journey.days.map((d) => ({
        ...d,
        stops: d.stops.map(labelStopForExport),
      })),
    },
    memories: extras.memories,
    saved: extras.saved,
    expenses: extras.expenses,
    checks: extras.checks,
    expenseOrigin: {
      origin: 'user' as const,
      status: 'unverified' as const,
      originLabel: originLabel('user'),
      statusLabel: statusLabel('unverified'),
    },
  };
}

export type ExplorePlaceCard = {
  name: string;
  tag: string;
  desc: string;
  provenance: Provenance;
};

export const explorePlaceCards: ExplorePlaceCard[] = [
  {
    name: '米兰大教堂',
    tag: '城市的起点',
    desc: '广场、哥特式建筑与玻璃拱廊集中在市中心。适合安排在同一半天。开放与票种以官网为准，此处不作为实时营业信息。',
    provenance: demoProvenance(sources.duomo),
  },
  {
    name: '布雷拉',
    tag: '艺术与小街道',
    desc: '美术馆与街区一起看。预约、闭馆日和票价须在官网核验；本卡只提供方向，不报实时场次。',
    provenance: demoProvenance(sources.brera),
  },
  {
    name: '科莫湖',
    tag: '轻装的一日往返',
    desc: '先探索科莫镇。是否游船、当天船班与末班船须在官网核验后自行决定；此处没有实时班次。行李多时减少换住宿。',
    provenance: demoProvenance(sources.ferry),
  },
  {
    name: '米兰公共交通',
    tag: '从住处开始查路线',
    desc: '地铁、公交与电车以 ATM 公布的线路、票种和运营信息为准。本站不提供实时到站或余票。',
    provenance: demoProvenance(sources.metro),
  },
];

export const handbookTransportCards: {
  title: string;
  body: string;
  links: { href: string; label: string }[];
  provenance: Provenance;
}[] = [
  {
    title: '先确定站名，再选车票',
    body: '米兰市内交通查看 ATM；前往科莫的区域火车查看 Trenord。把出发站、到达站、日期和返程计划放在一起确认，不要只凭目的地名称买票。下列时刻与票价都待核验，不是实时余票。',
    links: [
      { href: sources.metro, label: 'ATM 市内交通 ↗' },
      { href: sources.train, label: 'Trenord 火车 ↗' },
    ],
    provenance: demoProvenance(sources.train),
  },
  {
    title: '游船不是随到随走的地铁',
    body: '在官方时刻表确认码头、船型、方向及当天末班船。没有合适往返时段时，保留湖边散步，不必为了打卡赶船。本页不报实时船班。',
    links: [{ href: sources.ferry, label: '科莫湖游船官网 ↗' }],
    provenance: demoProvenance(sources.ferry),
  },
];
