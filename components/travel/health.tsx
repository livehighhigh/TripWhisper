'use client';
import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { type Journey } from '@/lib/journey';
import {
  inspectJourney,
  parsePlanText,
  previewHealthFixes,
  serializeJourney,
  journeysDifferForHealth,
  SAMPLE_PROBLEM_PLAN,
  type HealthFinding,
  type HealthPreview,
} from '@/lib/health';
import { Stethoscope, ArrowRight, ClipboardPaste, FileSearch } from 'lucide-react';

const kindLabel: Record<HealthFinding['kind'], string> = {
  overlap: '时间重叠',
  buffer: '缓冲不足',
  'locked-conflict': '锁定冲突',
  lodging: '住宿缺失',
  'missing-return': '返程缺失',
  info: '待核验',
};

const actionLabel = {
  shifted: '顺延',
  shortened: '压缩',
  removed: '移除',
  hotel: '住宿',
  inserted: '补入',
};

export function HealthPanel({
  journey,
  onApply,
  onOpenPlan,
}: {
  journey: Journey;
  onApply: (next: Journey) => void;
  onOpenPlan?: () => void;
}) {
  const [text, setText] = useState(() => serializeJourney(journey));
  const [hotel, setHotel] = useState(journey.profile.hotel);
  const [draft, setDraft] = useState<Journey | null>(null);
  const [findings, setFindings] = useState<HealthFinding[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<HealthPreview | null>(null);
  const [error, setError] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (preview) previewRef.current?.scrollIntoView({ block: 'nearest' });
  }, [preview]);

  const source = draft ?? journey;
  const adopting = !!(draft && journeysDifferForHealth(draft, journey));

  function resetPreview() {
    setPreview(null);
  }

  function inspect(target: Journey) {
    const list = inspectJourney(target);
    setFindings(list);
    setSelected(list.filter((f) => f.fixable).map((f) => f.id));
    setPreview(null);
    setError('');
    setHotel((h) => target.profile.hotel.trim() || h);
  }

  function inspectCurrent() {
    setDraft(null);
    setText(serializeJourney(journey));
    inspect(journey);
  }

  function inspectText() {
    try {
      const parsed = parsePlanText(journey, text);
      setDraft(parsed);
      inspect(parsed);
    } catch (e) {
      setError((e as Error).message);
      setDraft(null);
      setFindings(null);
      setPreview(null);
    }
  }

  function toggle(id: string, on: boolean) {
    setSelected((cur) => (on ? [...cur, id] : cur.filter((x) => x !== id)));
    resetPreview();
  }

  function runPreview() {
    try {
      setPreview(
        previewHealthFixes(source, selected, {
          hotel,
          adopt: adopting,
        }),
      );
      setError('');
    } catch (e) {
      setPreview(null);
      setError((e as Error).message);
    }
  }

  return (
    <div className="grid health-grid">
      <section className="panel">
        <p className="eyebrow">CHECK THEN FIX</p>
        <h2>先看问题，再决定改不改。</h2>
        <p className="note">
          可以检查当前行程，或粘贴 / 编辑文字计划。每条问题都有依据和建议；确认前不会改总行程、每日卡或预算。失败时原行程保持原样。
        </p>
        <p className="note">
          文字格式示例：<code>住宿：Duomo area</code>，然后{' '}
          <code>第1天</code> 与 <code>09:30-11:30 名称 〔已订〕</code>
          。未写到的天保持原安排。这是规则检查，不是实时天气、班次或余票。
        </p>
        <div className="row" style={{ margin: '12px 0' }}>
          <button className="secondary" onClick={inspectCurrent}>
            <FileSearch size={16} /> 检查当前行程
          </button>
          <button
            className="secondary"
            onClick={() => {
              setText(SAMPLE_PROBLEM_PLAN);
              setHotel((h) => h.trim() || 'Milano Centrale');
              setDraft(null);
              setFindings(null);
              setPreview(null);
              setError('');
            }}
          >
            <ClipboardPaste size={16} /> 载入示例问题
          </button>
        </div>
        <label htmlFor="health-plan-text">
          文字计划
          <Textarea
            id="health-plan-text"
            rows={14}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setDraft(null);
              setFindings(null);
              resetPreview();
            }}
          />
        </label>
        <label htmlFor="health-hotel" style={{ marginTop: 12 }}>
          建议写入的住宿位置
          <Input
            id="health-hotel"
            maxLength={120}
            placeholder="例如：Milano Centrale 附近"
            value={hotel}
            onChange={(e) => {
              setHotel(e.target.value);
              resetPreview();
            }}
          />
        </label>
        <p className="note">住宿只写入行程记录，不会按酒店地址重新计算交通。</p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" onClick={inspectText}>
          <Stethoscope size={16} /> 用这段文字检查
        </button>
      </section>
      <aside>
        <section className="panel">
          <h3>检查结果</h3>
          {!findings && (
            <p className="note">
              先检查当前行程，或粘贴文字后再检查。当前总行程不会被预览改写。
            </p>
          )}
          {findings && (
            <>
              <p className="note">
                {draft
                  ? adopting
                    ? '正在检查粘贴 / 编辑后的文字，尚未写入总行程。'
                    : '文字与当前行程一致。'
                  : `正在检查当前行程 · 版本 ${journey.version}`}
              </p>
              {findings.map((f) => (
                <div className="health-finding" key={f.id}>
                  {f.fixable ? (
                    <label className="check" htmlFor={'health-' + f.id}>
                      <Checkbox
                        id={'health-' + f.id}
                        checked={selected.includes(f.id)}
                        onCheckedChange={(v) => toggle(f.id, !!v)}
                      />
                      <span className="tag">{kindLabel[f.kind]}</span>
                      {f.title}
                    </label>
                  ) : (
                    <p>
                      <span className="tag">{kindLabel[f.kind]}</span> {f.title}
                    </p>
                  )}
                  <p className="note">依据：{f.rationale}</p>
                  <p className="note">建议：{f.suggestion}</p>
                </div>
              ))}
              <div className="row">
                <button className="primary" onClick={runPreview}>
                  预览选中修复
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    setFindings(null);
                    setPreview(null);
                    setDraft(null);
                    setError('');
                  }}
                >
                  取消检查
                </button>
              </div>
            </>
          )}
        </section>
        {preview && (
          <section className="panel replan-preview" ref={previewRef}>
            <div className="review-box">
              <h3>待确认的体检修复</h3>
              <p className="note">
                预览基于{draft ? '文字计划' : '当前行程'}。确认后才会写入同一份
                Journey。取消则原行程不变。
              </p>
              {adopting && (
                <p className="note">
                  确认时会用这段文字替换对应天的安排（未写到的天保持原样）。
                </p>
              )}
              <h4>将改动的项目</h4>
              {preview.changes.length ? (
                preview.changes.map((c, i) => (
                  <p className="note" key={c.name + c.action + i}>
                    <span className="tag">{actionLabel[c.action]}</span> {c.name}
                    {c.fromTime
                      ? ` ${c.fromTime}–${c.fromEnd}`
                      : ''}
                    {c.toTime ? ` → ${c.toTime}–${c.toEnd}` : ''}。{c.reason}
                  </p>
                ))
              ) : (
                <p className="note">
                  没有单项时间改动；确认将采用这次检查的文字计划。
                </p>
              )}
              <h4>活动预算参考</h4>
              <p className="note">
                €{preview.budgetFrom} → €{preview.budgetTo}
                。确认为演示估值，不是报价。
              </p>
              <h4>取舍说明</h4>
              {preview.tradeoffs.length ? (
                preview.tradeoffs.map((t) => (
                  <p className="note" key={t}>
                    · {t}
                  </p>
                ))
              ) : (
                <p className="note">选中的修复都可以执行，无需额外取舍。</p>
              )}
              <h4>修复后仍存在的问题</h4>
              {preview.remaining
                .filter((f) => f.kind !== 'info')
                .map((f) => (
                  <p className="note" key={f.id}>
                    · {f.title}
                  </p>
                ))}
              {!preview.remaining.some((f) => f.kind !== 'info') && (
                <p className="note">规则检查已通过。天气与开放时间仍需自行核实。</p>
              )}
              <p className="note">
                {preview.remaining.find((f) => f.kind === 'info')?.title}
              </p>
              <div className="row">
                <button
                  className="primary"
                  onClick={() => {
                    if (preview.baseVersion !== journey.version) {
                      setError('行程已经变化，请重新检查。');
                      setPreview(null);
                      return;
                    }
                    onApply(preview.next);
                    setPreview(null);
                    setDraft(null);
                    setFindings(null);
                    setText(serializeJourney(preview.next));
                    setHotel(preview.next.profile.hotel);
                  }}
                >
                  确认应用 <ArrowRight size={15} />
                </button>
                <button className="secondary" onClick={() => setPreview(null)}>
                  取消
                </button>
              </div>
              {onOpenPlan && (
                <button
                  className="small-link"
                  style={{ background: 'none', border: 0, padding: 0, marginTop: 10 }}
                  onClick={onOpenPlan}
                >
                  先去全程安排对照当前时间表 →
                </button>
              )}
            </div>
          </section>
        )}
      </aside>
    </div>
  );
}
