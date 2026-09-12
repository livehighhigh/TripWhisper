'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select';
import { Wallet, Plus, Trash2 } from 'lucide-react';
import { createExpense, dailyExpenses, type Expense } from '@/lib/workspace';
import { dateAt, type Journey } from '@/lib/journey';
export function Budget({
  journey,
  expenses,
  onChange,
}: {
  journey: Journey;
  expenses: Expense[];
  onChange: (v: Expense[]) => void;
}) {
  const [form, setForm] = useState({
    date: journey.profile.date,
    name: '',
    category: '餐饮',
    currency: 'EUR' as 'EUR' | 'CNY',
    amount: '',
    rate: '8.00',
  });
  const [error, setError] = useState('');
  const [removed, setRemoved] = useState<Expense | null>(null);
  const end = dateAt(journey.profile.date, journey.days.length - 1);
  const included = expenses.filter(
    (e) => e.date >= journey.profile.date && e.date <= end,
  );
  const total = included.reduce((s, e) => s + e.eurMinor, 0) / 100;
  const daily = dailyExpenses(included);
  const budget = journey.profile.budget;
  function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const expense = createExpense(form, crypto.randomUUID());
      onChange([...expenses, expense]);
      setForm({ ...form, name: '', amount: '' });
      setError('');
      setRemoved(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <div className="grid">
      <section className="panel">
        <div className="row spread">
          <div>
            <p className="eyebrow">EVERY LITTLE EURO</p>
            <h2>旅行花费，心里有数。</h2>
          </div>
          <Wallet size={26} />
        </div>
        <p className="note">
          按整组同行者的实际支出记账，不会再次乘以人数。仅统计当前行程日期内的账目。这些记录是你录入的，不是行程示范估值，也不是实时汇率或票价。
        </p>
        <div className="budget-summary">
          <div>
            <span>已记录支出</span>
            <strong>€{total.toFixed(2)}</strong>
            <small>约 ¥{(total * Number(form.rate || 0)).toFixed(2)}</small>
          </div>
          <div>
            <span>当前旅行预算</span>
            <strong>€{budget.toFixed(2)}</strong>
            <small>
              {total > budget ? '超出' : '剩余'} €
              {Math.abs(budget - total).toFixed(2)}
            </small>
          </div>
        </div>
        <div
          className="budget-meter"
          aria-label={`已使用预算 ${((total / budget) * 100).toFixed(1)}%`}
        >
          <span
            style={{
              width: `${Math.min(100, (total / budget) * 100)}%`,
              background: total > budget ? '#b54e37' : undefined,
            }}
          />
        </div>
        <p className="muted">
          换算展示采用下方手填汇率；不是实时汇率，也不是银行结算金额。
        </p>
        <h3 style={{ marginTop: 24 }}>每日小账本</h3>
        {journey.days.map((d, i) => {
          const date = dateAt(journey.profile.date, i);
          const amount = (daily[date] || 0) / 100;
          return (
            <div className="ledger-day" key={date}>
              <span className="day-number">
                {String(i + 1).padStart(2, '0')}
              </span>
              <div>
                <strong>{d.city === 'COMO' ? '科莫湖' : '米兰'}</strong>
                <p className="muted">
                  {date} · {included.filter((e) => e.date === date).length} 笔
                </p>
              </div>
              <strong>€{amount.toFixed(2)}</strong>
            </div>
          );
        })}
        <h3 style={{ marginTop: 24 }}>全部记录</h3>
        {expenses.length === 0 ? (
          <p className="empty">从第一杯咖啡开始，记下第一笔。</p>
        ) : (
          <div>
            {[...expenses].reverse().map((e) => (
              <div className="ledger-item" key={e.id}>
                <div>
                  <strong>{e.name}</strong>
                  <p className="muted">
                    你录入的 · 待核验 · {e.date} · {e.category}
                    {e.date < journey.profile.date || e.date > end
                      ? ' · 不在本次统计日期'
                      : ''}
                  </p>
                </div>
                <div>
                  <strong>
                    {e.currency === 'EUR' ? '€' : '¥'}
                    {(e.amountMinor / 100).toFixed(2)}
                  </strong>
                  <p className="muted">
                    记账约 €{(e.eurMinor / 100).toFixed(2)}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label={`删除消费 ${e.name}`}
                  onClick={() => {
                    setRemoved(e);
                    onChange(expenses.filter((x) => x.id !== e.id));
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
        {removed && (
          <button
            className="secondary"
            onClick={() => {
              onChange([...expenses, removed]);
              setRemoved(null);
            }}
          >
            撤销删除「{removed.name}」
          </button>
        )}
      </section>
      <aside>
        <section className="panel">
          <h3>记一笔</h3>
          <form onSubmit={submit}>
            <label>
              消费日期
              <Input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
              />
            </label>
            <label>
              买了什么
              <Input
                maxLength={100}
                required
                placeholder="例如：湖边午餐，两人"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              分类
              <NativeSelect
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {['餐饮', '交通', '门票', '住宿', '购物', '其他'].map((v) => (
                  <NativeSelectOption key={v}>{v}</NativeSelectOption>
                ))}
              </NativeSelect>
            </label>
            <div className="fields">
              <label>
                金额
                <Input
                  required
                  inputMode="decimal"
                  placeholder="0.00"
                  value={form.amount}
                  onChange={(e) => setForm({ ...form, amount: e.target.value })}
                />
              </label>
              <label>
                币种
                <NativeSelect
                  value={form.currency}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      currency: e.target.value as 'EUR' | 'CNY',
                    })
                  }
                >
                  <NativeSelectOption value="EUR">欧元 EUR</NativeSelectOption>
                  <NativeSelectOption value="CNY">
                    人民币 CNY
                  </NativeSelectOption>
                </NativeSelect>
              </label>
            </div>
            <label>
              1 欧元 ≈ 多少人民币
              <Input
                required
                inputMode="decimal"
                value={form.rate}
                onChange={(e) => setForm({ ...form, rate: e.target.value })}
              />
            </label>
            <p className="note">
              默认 8.00
              仅为演示，请按自己的结算汇率填写；人民币消费按录入时汇率折算，之后不会随展示汇率改变。
            </p>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="primary full" type="submit">
              <Plus size={16} /> 保存消费
            </button>
          </form>
        </section>
        <section className="panel">
          <h3>预算与估算分开看</h3>
          <p className="note">
            本页是你录入的实际支出，已标注为「你录入的 · 待核验」：手记金额，不是实时牌价。「全程安排」里的活动金额是示范估值且待核验，不会自动变成账单。
          </p>
          <p className="note">
            记账目前在本浏览器保存。可在全程安排导出包含账本的旅行备份。
          </p>
        </section>
      </aside>
    </div>
  );
}
