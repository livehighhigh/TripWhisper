'use client';
import { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { exportDayCard } from '@/lib/export-card';
import { Budget } from '@/components/travel/budget';
import { Bookings } from '@/components/travel/bookings';
import { Handbook } from '@/components/travel/handbook';
import { ReplanPanel } from '@/components/travel/replan';
import { HealthPanel } from '@/components/travel/health';
import {
  regenerateWithBookings,
  safeExpense,
  type Expense,
} from '@/lib/workspace';
import {
  MapPin,
  ArrowUpRight,
  LockKeyhole,
  Compass,
  ArrowRight,
  Bookmark,
  Check,
  Download,
} from 'lucide-react';
import {
  initialProfile,
  generate,
  estimate,
  dateAt,
  directions,
  sources,
  type Profile,
  type Journey,
  type Stop,
} from '@/lib/journey';
const KEY = 'tripwhisper-local-v1';
const placeCards = [
  [
    '米兰大教堂',
    '城市的起点',
    '广场、哥特式建筑与玻璃拱廊集中在市中心。适合安排在同一半天。',
    sources.duomo,
  ],
  [
    '布雷拉',
    '艺术与小街道',
    '美术馆与街区一起看。预约与开放日请查官方信息。',
    sources.brera,
  ],
  [
    '科莫湖',
    '轻装的一日往返',
    '先探索科莫镇，再按当天船班决定是否游船。行李多时减少换住宿。',
    sources.ferry,
  ],
  [
    '米兰公共交通',
    '从住处开始查路线',
    '地铁、公交与电车以 ATM 公布的线路、票种和运营信息为准。',
    sources.metro,
  ],
];
function StopCard({ stop }: { stop: Stop }) {
  return (
    <article className="stop">
      <div className="time">
        {stop.time}
        <div className="muted">{stop.end}</div>
      </div>
      <div>
        <div className="row spread">
          <h3>{stop.name}</h3>
          {stop.locked && (
            <span className="tag">
              <LockKeyhole size={12} style={{ display: 'inline' }} /> 已订 ·
              保留
            </span>
          )}
        </div>
        <p>{stop.local}</p>
        <p>
          <MapPin size={13} style={{ display: 'inline' }} /> {stop.address}
        </p>
        <div className="row">
          <span className="tag">{stop.kind}</span>
          <span className="muted">预算参考 €{stop.cost} / 人</span>
        </div>
        <p>{stop.transport}</p>
        <details>
          <summary className="small-link">背景故事与到访提醒</summary>
          <p>{stop.story}</p>
          <div className="callout">{stop.tip}</div>
        </details>
        <div className="row" style={{ marginTop: 12 }}>
          <a
            className="secondary"
            href={directions(stop)}
            target="_blank"
            rel="noreferrer"
          >
            地图导航 <ArrowUpRight size={14} />
          </a>
          {stop.url && (
            <a
              className="small-link"
              href={stop.url}
              target="_blank"
              rel="noreferrer"
            >
              官网 / 订票入口 ↗
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
export default function Home() {
  const [tab, setTab] = useState('today');
  const [profile, setProfile] = useState<Profile>(initialProfile);
  const [journey, setJourney] = useState<Journey>(() =>
    generate(initialProfile),
  );
  const [previous, setPrevious] = useState<Journey | null>(null);
  const [day, setDay] = useState(0);
  const [memories, setMemories] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [saved, setSaved] = useState<{ date: string; text: string }[]>([]);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const x = JSON.parse(raw);
        if (x.schema === 1 && x.journey) {
          generate(x.journey.profile);
          if (
            !Array.isArray(x.journey.days) ||
            !x.journey.days.every(
              (d: any) =>
                Array.isArray(d.stops) &&
                d.stops.every(
                  (s: any) =>
                    typeof s.name === 'string' && typeof s.address === 'string',
                ),
            )
          )
            throw Error();
          setExpenses(
            Array.isArray(x.expenses) ? x.expenses.filter(safeExpense) : [],
          );
          setChecks(
            Array.isArray(x.checks)
              ? (Array.from(
                  new Set(
                    x.checks.filter((v: unknown) => typeof v === 'string'),
                  ),
                ).slice(0, 7) as string[])
              : [],
          );
          setJourney(x.journey);
          setProfile(x.journey.profile);
          setMemories(
            Array.isArray(x.memories)
              ? x.memories.filter((s: unknown) => typeof s === 'string')
              : [],
          );
          setSaved(
            Array.isArray(x.saved)
              ? x.saved.filter(
                  (s: any) =>
                    typeof s.text === 'string' && typeof s.date === 'string',
                )
              : [],
          );
        }
      }
    } catch {
      setMessage('上次本机记录未能读取，已载入示范行程。');
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          schema: 1,
          journey,
          memories,
          saved,
          expenses,
          checks,
        }),
      );
    } catch {
      setMessage('本机存储不可用，当前内容仅保留在此页面，请导出备份。');
    }
  }, [journey, memories, saved, expenses, checks, ready]);
  useEffect(() => {
    const ctx = (document as any).modelContext;
    if (!ctx?.registerTool) return;
    const life = new AbortController();
    try {
      Promise.resolve(
        ctx.registerTool(
          {
            name: 'read_trip_summary',
            title: '读取当前行程',
            description:
              '读取当前可见行程的日期、版本、天数与每日安排，不修改数据。',
            inputSchema: {
              type: 'object',
              properties: {},
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true },
            execute: (input: unknown) => {
              if (
                !input ||
                typeof input !== 'object' ||
                Object.keys(input).length
              )
                throw new Error('Expected an empty object');
              return {
                version: journey.version,
                start: journey.profile.date,
                days: journey.days.map((d) => ({
                  title: d.title,
                  stops: d.stops.map((s) => ({
                    name: s.name,
                    time: s.time,
                    locked: !!s.locked,
                  })),
                })),
              };
            },
          },
          { signal: life.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => life.abort();
  }, [journey]);
  const active = journey.days[day] || journey.days[0];
  const total = estimate(journey);
  function update<K extends keyof Profile>(k: K, v: Profile[K]) {
    setProfile((p) => ({ ...p, [k]: v }));
  }
  function build() {
    try {
      const next = regenerateWithBookings(profile, memories, journey);
      setBusy(true);
      setTimeout(() => {
        setPrevious(journey);
        setJourney({ ...next, version: journey.version + 1 });
        setDay(0);
        setTab('plan');
        setMessage('行程已更新。请确认日期与官网信息，再进行真实预订。');
        setBusy(false);
      }, 350);
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  function exportTrip() {
    const file = new Blob(
      [JSON.stringify({ journey, memories, saved, expenses, checks }, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'TripWhisper-旅行备份.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <header className="topbar">
        <div className="brand">
          TripWhisper<small>YOUR JOURNEY, A LITTLE CLOSER</small>
        </div>
        <div className="row">
          <span className="muted">一段旅程，慢慢懂你。</span>
          <span className="tag">欧洲旅行 · 体验版</span>
        </div>
      </header>
      <main className="workspace">
        <div className="intro">
          <div>
            <p className="eyebrow">MY ITALIAN JOURNEY · 行前 / 行中 / 行后</p>
            <h1>下一站，慢一点的意大利。</h1>
            <p className="muted">米兰的街角，和科莫湖的一阵风。</p>
          </div>
          <button className="primary" onClick={() => setTab('profile')}>
            <Compass size={17} /> 定制我的行程 <ArrowRight size={16} />
          </button>
        </div>
        <div className="banner">
          <img src="/como.jpg" alt="山脉与湖岸环绕的意大利科莫湖全景" />
          <div className="banner-text">
            <p>MILANO → LAGO DI COMO</p>
            <h2>把期待，变成每一天。</h2>
            <p>
              {journey.profile.date} 出发 · {journey.days.length} 天 ·{' '}
              {journey.profile.people} 位旅伴
            </p>
          </div>
        </div>
        {message && (
          <div className="status" role="status">
            {message}
            <button
              aria-label="关闭提示"
              onClick={() => setMessage('')}
              style={{ float: 'right', border: 0, background: 'transparent' }}
            >
              ×
            </button>
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList className="journey-tabs">
            <TabsTrigger value="profile">旅行偏好</TabsTrigger>
            <TabsTrigger value="explore">认识目的地</TabsTrigger>
            <TabsTrigger value="plan">全程安排</TabsTrigger>
            <TabsTrigger value="health">行程体检</TabsTrigger>
            <TabsTrigger value="bookings">我的预订</TabsTrigger>
            <TabsTrigger value="handbook">背景手册</TabsTrigger>
            <TabsTrigger value="today">每日行动卡</TabsTrigger>
            <TabsTrigger value="budget">旅行账本</TabsTrigger>
            <TabsTrigger value="memory">旅行回顾</TabsTrigger>
          </TabsList>
          <TabsContent value="health" keepMounted>
            <HealthPanel
              journey={journey}
              onApply={(next) => {
                setPrevious(journey);
                setJourney(next);
                setProfile(next.profile);
                setMessage('体检修复已应用，总行程、每日卡与预算已同步。');
              }}
              onOpenPlan={() => setTab('plan')}
            />
          </TabsContent>
          <TabsContent value="bookings">
            <Bookings
              journey={journey}
              onApply={(next) => {
                setPrevious(journey);
                setJourney(next);
                setMessage('预订记录已更新，行程与每日卡已同步。');
              }}
              onOpenHealth={() => setTab('health')}
            />
          </TabsContent>
          <TabsContent value="handbook">
            <Handbook journey={journey} checks={checks} onCheck={setChecks} />
          </TabsContent>
          <TabsContent value="budget">
            <Budget
              journey={journey}
              expenses={expenses}
              onChange={setExpenses}
            />
          </TabsContent>
          <TabsContent value="today">
            <div className="grid">
              <section className="panel">
                <div className="row spread">
                  <p className="eyebrow">YOUR DAILY COMPANION</p>
                  <span className="tag">版本 {journey.version}</span>
                </div>
                <div className="chips">
                  {journey.days.map((_, i) => (
                    <button
                      key={i}
                      aria-pressed={i === day}
                      className={'chip ' + (day === i ? 'active' : '')}
                      onClick={() => {
                        setDay(i);
                      }}
                    >
                      Day {String(i + 1).padStart(2, '0')}
                    </button>
                  ))}
                </div>
                <p className="muted">
                  {dateAt(journey.profile.date, day)} · {active.city}
                </p>
                <h2>{active.title}</h2>
                <button
                  className="secondary"
                  style={{ margin: '10px 0' }}
                  onClick={async () => {
                    try {
                      await exportDayCard(journey, day);
                      setMessage('当日行程图已生成，请查看浏览器下载。');
                    } catch (e) {
                      setMessage((e as Error).message);
                    }
                  }}
                >
                  <Download size={15} /> 保存今日行程图
                </button>
                <p className="note">{active.reason}</p>
                <div className="route-strip">
                  {active.stops.map((s, i) => (
                    <span key={s.id}>
                      {i > 0 ? ' → ' : ''}
                      {s.name}
                    </span>
                  ))}
                </div>
                {active.stops.map((s) => (
                  <StopCard key={s.id} stop={s} />
                ))}
              </section>
              <aside>
                <ReplanPanel
                  key={day + '-' + journey.version}
                  journey={journey}
                  day={day}
                  previous={previous}
                  onApply={(next) => {
                    setPrevious(journey);
                    setJourney(next);
                    setMessage(
                      '重排已应用，总行程、每日卡与预算已同步。',
                    );
                  }}
                  onRestore={() => {
                    if (!previous) return;
                    setJourney(previous);
                    setProfile(previous.profile);
                    setPrevious(null);
                    setDay(0);
                    setMessage('已恢复上一版行程。');
                  }}
                />
                <section className="panel">
                  <h3>旅行经验，小小提醒</h3>
                  <div className="callout">
                    去科莫湖这天，先确认行李能留在米兰。预订湖边住宿时，检查码头到门口的坡度、台阶和路面。
                  </div>
                  <p className="muted">
                    来自创始人的旅行经验，具体住宿与路线仍需逐项核实。
                  </p>
                </section>
                <section className="panel">
                  <h3>今天的准备清单</h3>
                  <p className="note">
                    □ 票券截图与证件
                    <br />□ 出发前查天气和开放情况
                    <br />□ 舒适鞋、饮水与充电
                    <br />□ 官网确认末班车或船班
                  </p>
                  <p className="muted">天气未接入实时数据。</p>
                </section>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="plan">
            <div className="grid">
              <section className="panel">
                <div className="row spread">
                  <h2>你的意大利旅行手账</h2>
                  <button className="secondary" onClick={() => window.print()}>
                    <Download size={15} /> 打印 / 存为 PDF
                  </button>
                </div>
                <p className="note">
                  从 {journey.profile.date} 到{' '}
                  {dateAt(journey.profile.date, journey.days.length - 1)} ·
                  住宿参考：{journey.profile.hotel || '尚未填写'}
                </p>
                {journey.days.map((d, i) => (
                  <article className="day-card" key={i}>
                    <div className="row spread">
                      <span className="eyebrow">
                        DAY {String(i + 1).padStart(2, '0')} · {d.city}
                      </span>
                      <span className="muted">
                        {dateAt(journey.profile.date, i)}
                      </span>
                    </div>
                    <h3>{d.title}</h3>
                    <p className="note">{d.reason}</p>
                    <p className="note">
                      {d.stops
                        .map(
                          (s) =>
                            s.time +
                            ' ' +
                            s.name +
                            (s.locked ? '〔已订〕' : ''),
                        )
                        .join(' → ')}
                    </p>
                    <button
                      className="small-link"
                      style={{ background: 'none', border: 0, padding: 0 }}
                      onClick={() => {
                        setDay(i);
                        setTab('today');
                      }}
                    >
                      打开这一天的行动卡 →
                    </button>
                  </article>
                ))}
              </section>
              <aside>
                <section className="panel">
                  <h3>旅程预算参考</h3>
                  <div className="stats">
                    <div className="stat">
                      <strong>€{total}</strong>
                      <span>活动估算</span>
                    </div>
                    <div className="stat">
                      <strong>€{journey.profile.budget}</strong>
                      <span>所设预算</span>
                    </div>
                  </div>
                  <p
                    className={
                      total > journey.profile.budget ? 'error' : 'note'
                    }
                  >
                    {total > journey.profile.budget
                      ? `高于预算 €${total - journey.profile.budget}，建议减少付费项目。`
                      : `当前项目估算低于预算 €${journey.profile.budget - total}。`}
                  </p>
                  <p className="note">
                    按 {journey.profile.people}{' '}
                    人合计。金额为演示估值，不是报价；不含机票、住宿、未安排餐饮与额外市内交通。
                  </p>
                </section>
                <section className="panel">
                  <h3>偏好如何影响了安排</h3>
                  <p className="note">
                    {journey.profile.interests.join(' · ') || '均衡体验'}
                    <br />
                    {journey.profile.slow
                      ? '主动选择慢节奏'
                      : '保留适度探索空间'}
                  </p>
                  {journey.applied.length > 0 ? (
                    <div className="callout">
                      用上了你之前确认的偏好：{journey.applied.join('、')}。
                    </div>
                  ) : (
                    <p className="muted">
                      旅行回顾中确认的偏好，可用于下一次生成。
                    </p>
                  )}
                  <button className="secondary" onClick={exportTrip}>
                    导出本机旅行备份
                  </button>
                  <button
                    className="secondary"
                    style={{ marginTop: 10 }}
                    onClick={() => setTab('health')}
                  >
                    去行程体检
                  </button>
                </section>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="explore">
            <section className="panel">
              <p className="eyebrow">GET TO KNOW THE PLACE</p>
              <h2>先认识方向，再决定去哪。</h2>
              <div className="route-strip">
                米兰中央车站 → 市中心 / 大教堂 → 布雷拉与城堡 ｜ 米兰 → 火车 →
                科莫镇 → 湖岸
              </div>
              <p className="note">
                以上是区域关系示意，不是按比例地图。交通方式与班次请在对应官网核实。
              </p>
              <div className="places">
                {placeCards.map(([name, tag, desc, url]) => (
                  <article className="place" key={name}>
                    <span className="tag">{tag}</span>
                    <h3>{name}</h3>
                    <p>{desc}</p>
                    <a
                      className="small-link"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      打开官方网站 ↗
                    </a>
                  </article>
                ))}
              </div>
              <div className="callout">
                官网跳转后，需要在对方网站自行完成选票与支付。本网站不会代下单，也没有实时库存。
              </div>
              <a
                className="small-link"
                href={sources.train}
                target="_blank"
                rel="noreferrer"
              >
                Trenord · 查询区域火车 ↗
              </a>
            </section>
          </TabsContent>
          <TabsContent value="profile">
            <div className="grid">
              <section className="panel">
                <p className="eyebrow">MAKE IT YOURS</p>
                <h2>这次，想怎样旅行？</h2>
                <p className="note">
                  首个体验支持米兰＋科莫湖 3—5
                  天。生成使用精选资料与规则，尚未接入大模型。
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    build();
                  }}
                >
                  <div className="fields">
                    <label>
                      出发日期
                      <Input
                        required
                        type="date"
                        value={profile.date}
                        onChange={(e) => update('date', e.target.value)}
                      />
                    </label>
                    <label>
                      旅行天数（3—5）
                      <Input
                        required
                        type="number"
                        min={3}
                        max={5}
                        value={profile.days}
                        onChange={(e) => update('days', Number(e.target.value))}
                      />
                    </label>
                    <label>
                      同行人数（1—8）
                      <Input
                        required
                        type="number"
                        min={1}
                        max={8}
                        value={profile.people}
                        onChange={(e) =>
                          update('people', Number(e.target.value))
                        }
                      />
                    </label>
                    <label>
                      全部同行者活动预算（欧元）
                      <Input
                        required
                        type="number"
                        min={1}
                        value={profile.budget}
                        onChange={(e) =>
                          update('budget', Number(e.target.value))
                        }
                      />
                    </label>
                  </div>
                  <label style={{ marginTop: 16 }}>
                    米兰住宿位置
                    <Input
                      maxLength={150}
                      placeholder="酒店名或区域"
                      value={profile.hotel}
                      onChange={(e) => update('hotel', e.target.value)}
                    />
                  </label>
                  <p className="note">
                    住宿位置用于记录；当前交通时长是示范估计，请通过地图查询实际路线。
                  </p>
                  <h3>更想把时间留给什么？</h3>
                  <div className="chips">
                    {['艺术与建筑', '湖畔自然', '街区生活'].map((x) => (
                      <button
                        type="button"
                        key={x}
                        aria-pressed={profile.interests.includes(x)}
                        className={
                          'chip ' +
                          (profile.interests.includes(x) ? 'active' : '')
                        }
                        onClick={() =>
                          update(
                            'interests',
                            profile.interests.includes(x)
                              ? profile.interests.filter((v) => v !== x)
                              : [...profile.interests, x],
                          )
                        }
                      >
                        {x}
                      </button>
                    ))}
                  </div>
                  <label className="check">
                    <Checkbox
                      checked={profile.slow}
                      onCheckedChange={(v) => update('slow', !!v)}
                    />
                    宁愿少去一点，也想走得轻松
                  </label>
                  <label className="check">
                    <Checkbox
                      checked={profile.luggage}
                      onCheckedChange={(v) => update('luggage', !!v)}
                    />
                    会带大件行李
                  </label>
                  <label className="check">
                    <Checkbox
                      checked={profile.booked}
                      onCheckedChange={(v) => update('booked', !!v)}
                    />
                    锁定第 1 天 09:30 大教堂参观（模拟已订）
                  </label>
                  <p className="note">
                    此开关只记录行程约束，不代表已经购买门票。
                  </p>
                  <button disabled={busy} className="primary" type="submit">
                    {busy ? '正在整理行程…' : '确认偏好，生成我的行程'}{' '}
                    <ArrowRight size={16} />
                  </button>
                </form>
              </section>
              <aside>
                <section className="panel">
                  <h3>我们理解的你</h3>
                  <p className="note">
                    {profile.people} 人同行，{profile.days} 天意大利短旅。
                  </p>
                  <p className="note">
                    {profile.interests.join('、') || '还在探索自己的喜好'}。
                    {profile.slow
                      ? '留白比打卡更重要。'
                      : '想看看城市的不同侧面。'}
                  </p>
                  <p className="note">
                    {profile.luggage
                      ? '需要特别留意行李与石板路。'
                      : '不需要特别安排大件行李。'}
                  </p>
                  <div className="callout">
                    这里的选择随时可以改。确认生成后，才会替换当前计划。
                  </div>
                </section>
              </aside>
            </div>
          </TabsContent>
          <TabsContent value="memory">
            <div className="grid">
              <section className="panel">
                <p className="eyebrow">LITTLE MOMENTS, LONG MEMORIES</p>
                <h2>今天，有什么想留下？</h2>
                <label>
                  写一句感受
                  <Textarea
                    value={note}
                    maxLength={2000}
                    placeholder="比如：今天湖边很好看，但拖着箱子走石板路太累了。"
                    onChange={(e) => setNote(e.target.value)}
                  />
                </label>
                <button
                  className="primary"
                  style={{ marginTop: 14 }}
                  disabled={!note.trim()}
                  onClick={() =>
                    setDraft(
                      `意大利旅行 · ${dateAt(journey.profile.date, day)}\n\n${note.trim()}\n\n把这一刻收进旅行手账，留给以后的自己。`,
                    )
                  }
                >
                  整理为小记草稿
                </button>
                {draft && (
                  <div style={{ marginTop: 20 }}>
                    <label>
                      修改成你的语气
                      <Textarea
                        value={draft}
                        maxLength={3000}
                        onChange={(e) => setDraft(e.target.value)}
                      />
                    </label>
                    <p className="note">
                      使用固定格式整理，保留你的原话；不会自动发布。
                    </p>
                    <button
                      className="secondary"
                      disabled={!draft.trim()}
                      onClick={() => {
                        setSaved((s) => [
                          {
                            date: dateAt(journey.profile.date, day),
                            text: draft.trim(),
                          },
                          ...s,
                        ]);
                        setDraft('');
                        setNote('');
                        setMessage('小记已保存到此浏览器。');
                      }}
                    >
                      <Bookmark size={15} /> 保存到本机手账
                    </button>
                  </div>
                )}
                <h3 style={{ marginTop: 26 }}>旅程里的片段</h3>
                {saved.length === 0 ? (
                  <div className="empty">
                    还没有记录。第一句话，就从今天开始。
                  </div>
                ) : (
                  saved.map((s, i) => (
                    <article className="review-box" key={i}>
                      <p className="muted">{s.date}</p>
                      <p>{s.text}</p>
                      <button
                        className="small-link"
                        style={{ border: 0, background: 'none' }}
                        onClick={() => {
                          const blob = new Blob([s.text], {
                            type: 'text/plain;charset=utf-8',
                          });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `旅行小记-${s.date}.txt`;
                          a.click();
                          setTimeout(() => URL.revokeObjectURL(url), 1000);
                        }}
                      >
                        导出文字
                      </button>
                    </article>
                  ))
                )}
              </section>
              <aside>
                <section className="panel">
                  <h3>下次，更懂你一点</h3>
                  <p className="note">
                    如果这趟旅程让你发现自己喜欢少安排一点，可以明确告诉我们。
                  </p>
                  {memories.includes('更喜欢慢节奏') ? (
                    <>
                      <div className="callout">
                        <Check size={15} style={{ display: 'inline' }} />{' '}
                        已记住：更喜欢慢节奏
                      </div>
                      <button
                        className="secondary"
                        onClick={() => {
                          setMemories([]);
                          setMessage(
                            '偏好已删除，下次生成不再使用。当前行程未改变。',
                          );
                        }}
                      >
                        删除这条偏好
                      </button>
                    </>
                  ) : (
                    <button
                      className="secondary"
                      onClick={() => {
                        setMemories(['更喜欢慢节奏']);
                        setMessage(
                          '已保存偏好。到「我的旅行偏好」重新生成，即可看到变化。',
                        );
                      }}
                    >
                      确认：我更喜欢慢节奏
                    </button>
                  )}
                  <button
                    className="small-link"
                    style={{
                      display: 'block',
                      marginTop: 16,
                      border: 0,
                      background: 'none',
                    }}
                    onClick={() => setTab('profile')}
                  >
                    带着新偏好，重新规划 →
                  </button>
                </section>
                <section className="panel">
                  <h3>只留在此浏览器</h3>
                  <p className="note">
                    行程、预订、账本、准备清单、已确认偏好和小记保存在本机浏览器，未上传云端。清除浏览器数据会丢失记录，建议导出备份。
                  </p>
                  <button className="secondary" onClick={exportTrip}>
                    导出旅行备份
                  </button>
                </section>
              </aside>
            </div>
          </TabsContent>
        </Tabs>
        <footer className="footer">
          <p>
            体验版：精选资料与规则驱动，尚未接入真实大模型。票价、交通时长为示范估算，开放时间、天气及库存须出发前自行核实。
          </p>
          <p>
            照片：
            <a
              href="https://commons.wikimedia.org/wiki/File:Lago_de_Como,_Italia,_2016-06-25,_DD_02-06_PAN.jpg"
              target="_blank"
              rel="noreferrer"
            >
              Diego Delso / Wikimedia Commons
            </a>{' '}
            ·{' '}
            <a
              href="https://creativecommons.org/licenses/by-sa/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY-SA 4.0
            </a>{' '}
            · 缩放、裁切展示。行程与小记仅保存在此浏览器。
          </p>
        </footer>
      </main>
    </>
  );
}
