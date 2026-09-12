'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { dateAt, type Journey } from '@/lib/journey';
import { previewBooking, type BookingInput } from '@/lib/workspace';
import { inspectJourney } from '@/lib/health';
import { LockKeyhole, Plus, ArrowRight } from 'lucide-react';
export function Bookings({
  journey,
  onApply,
  onOpenHealth,
}: {
  journey: Journey;
  onApply: (j: Journey) => void;
  onOpenHealth?: () => void;
}) {
  const [form, setForm] = useState<BookingInput>({
    date: journey.profile.date,
    name: '',
    address: '',
    time: '19:30',
    end: '21:00',
    cost: '0',
    url: '',
  });
  const [preview, setPreview] = useState<ReturnType<
    typeof previewBooking
  > | null>(null);
  const [error, setError] = useState('');
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [baseVersion, setBaseVersion] = useState(0);
  const bookings = journey.days.flatMap((d, i) =>
    d.stops
      .filter((s) => s.locked)
      .map((s) => ({ ...s, date: dateAt(journey.profile.date, i) })),
  );
  function change(k: keyof BookingInput, v: string) {
    setForm({ ...form, [k]: v });
    setPreview(null);
  }
  return (
    <div className="grid">
      <section className="panel">
        <p className="eyebrow">YOUR PLANS COME FIRST</p>
        <h2>已经订好的，放心放进来。</h2>
        <p className="note">
          填写你已在官网购买的项目。先检查冲突，再确认加入；不会替你支付或修改真实订单。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            try {
              setPreview(previewBooking(journey, form, crypto.randomUUID()));
              setBaseVersion(journey.version);
              setError('');
            } catch (e) {
              setError((e as Error).message);
              setPreview(null);
            }
          }}
        >
          <div className="fields">
            <label>
              预订日期
              <Input
                required
                type="date"
                min={journey.profile.date}
                max={dateAt(journey.profile.date, journey.days.length - 1)}
                value={form.date}
                onChange={(e) => change('date', e.target.value)}
              />
            </label>
            <label>
              项目名称
              <Input
                required
                maxLength={120}
                placeholder="例如：晚间音乐会"
                value={form.name}
                onChange={(e) => change('name', e.target.value)}
              />
            </label>
            <label>
              开始时间
              <Input
                required
                type="time"
                value={form.time}
                onChange={(e) => change('time', e.target.value)}
              />
            </label>
            <label>
              结束时间
              <Input
                required
                type="time"
                value={form.end}
                onChange={(e) => change('end', e.target.value)}
              />
            </label>
          </div>
          <label>
            当地地址
            <Input
              required
              maxLength={200}
              placeholder="请填写英文或意大利文地址，便于导航"
              value={form.address}
              onChange={(e) => change('address', e.target.value)}
            />
          </label>
          <div className="fields">
            <label>
              每人价格（欧元）
              <Input
                required
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => change('cost', e.target.value)}
              />
            </label>
            <label>
              官网链接（可留空）
              <Input
                type="url"
                placeholder="https://…"
                value={form.url}
                onChange={(e) => change('url', e.target.value)}
              />
            </label>
          </div>
          <p className="note">
            不要填写支付信息或私人订单链接。这里只需要名称、时间、公开地址。
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" type="submit">
            <Plus size={16} /> 检查并预览
          </button>
        </form>
        {preview && (
          <div className="review-box">
            <h3>
              第 {preview.day + 1} 天 · {form.name}
            </h3>
            <p>
              {form.time} — {form.end} · {form.address}
            </p>
            <p className="note">
              {preview.removed.length
                ? '加入后将移除以下未预订活动（时间重叠或不足 15 分钟衔接）：' +
                  preview.removed.join('、')
                : '没有与当前活动发生时间冲突。'}
            </p>
            <p className="note">跨区域的实际交通时间仍需自行核实。</p>
            <button
              className="primary"
              onClick={() => {
                if (baseVersion !== journey.version) {
                  setError('行程已经变化，请重新检查。');
                  setPreview(null);
                  return;
                }
                onApply(preview.next);
                setPreview(null);
                setForm({ ...form, name: '', address: '', url: '' });
              }}
            >
              确认加入并锁定 <ArrowRight size={15} />
            </button>
          </div>
        )}
      </section>
      <aside>
        <section className="panel">
          <h3>
            <LockKeyhole size={17} style={{ display: 'inline' }} /> 已保留的安排
          </h3>
          {bookings.map((b) => (
            <div className="booking-card" key={b.id}>
              <span className="tag">
                {b.kind === '我的预订' ? '你录入的预订' : '模拟预订'}
              </span>
              <h3>{b.name}</h3>
              {b.kind === '我的预订' && (
                <button
                  className="small-link"
                  style={{ background: 'none', border: 0, padding: 0 }}
                  onClick={() => setRemoveId(b.id)}
                >
                  从行程移除
                </button>
              )}
              {removeId === b.id && (
                <div className="callout">
                  <p>只移除此行程记录，不会取消或退款真实订单。</p>
                  <div className="row">
                    <button
                      className="secondary"
                      onClick={() => {
                        const next = structuredClone(journey);
                        next.days = next.days.map((d) => ({
                          ...d,
                          stops: d.stops.filter((s) => s.id !== b.id),
                        }));
                        next.version++;
                        onApply(next);
                        setRemoveId(null);
                        setPreview(null);
                      }}
                    >
                      确认移除
                    </button>
                    <button
                      className="secondary"
                      onClick={() => setRemoveId(null)}
                    >
                      保留
                    </button>
                  </div>
                </div>
              )}

              <p className="muted">
                {b.date}
                <br />
                {b.time} — {b.end}
              </p>
            </div>
          ))}
          {!bookings.length && <p className="note">还没有锁定项目。</p>}
          <p className="note">
            新录入的预订在重新生成行程时仍会保留。若改变日期导致预订超出行程范围，会阻止替换并提示。
          </p>
        </section>
        <section className="panel">
          <h3>行程体检</h3>
          {inspectJourney(journey).map((f) => (
            <p className="note" key={f.id}>
              · {f.title}
            </p>
          ))}
          <p className="note">只读摘要。修复建议、预览和确认在「行程体检」。 </p>
          {onOpenHealth && (
            <button className="secondary" onClick={onOpenHealth}>
              去行程体检处理
            </button>
          )}
        </section>
      </aside>
    </div>
  );
}
