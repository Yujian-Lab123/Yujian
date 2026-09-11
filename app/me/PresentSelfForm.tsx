'use client';

import { useState, type FormEvent } from 'react';
import { MOODS, STATES } from '@/lib/axes';
import { composeRecord, MAX_RECORD_LENGTH, type PresentSelfDraft } from '@/lib/present-self/record';

const EMPTY_DRAFT: PresentSelfDraft = { mood: '', state: '', confusion: '', activity: '', socialNeed: '' };
const ACTIVITIES = ['散步走走', '一起学习', '运动一下', '喝杯咖啡', '暂时不想活动'];
const SOCIAL_NEEDS = ['想被倾听', '想听听建议', '轻松闲聊', '寻找同伴', '想独处'];

function Choices({ label, value, options, onChange }: {
  label: string; value: string; options: readonly string[]; onChange: (value: string) => void;
}) {
  return <fieldset className="mt-6">
    <legend className="text-sm text-sumi-600">{label}</legend>
    <div className="mt-3 flex flex-wrap gap-2">
      {options.map((option) => <button key={option} type="button" aria-pressed={value === option}
        onClick={() => onChange(value === option ? '' : option)}
        className={`rounded-full border px-4 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-ink-500 ${value === option ? 'border-ink-500 bg-ink-50 text-ink-700' : 'border-paper-300 bg-white/60 text-sumi-500 hover:border-paper-400'}`}>
        {option}
      </button>)}
    </div>
  </fieldset>;
}

export default function PresentSelfForm({ currentState, onSaved, disabled, onSavingChange }: {
  currentState: { text: string; mood: string; created_at: string } | null;
  onSaved: () => Promise<void>;
  disabled: boolean;
  onSavingChange: (saving: boolean) => void;
}) {
  const [draft, setDraft] = useState<PresentSelfDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const text = composeRecord(draft);
  const hasContent = Boolean(text || draft.mood);
  const tooLong = text.length > MAX_RECORD_LENGTH;

  function update(field: keyof PresentSelfDraft, value: string) {
    setDraft((previous) => ({ ...previous, [field]: value }));
    setMessage('');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || disabled || !hasContent || tooLong) return;
    setSaving(true);
    onSavingChange(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/me/current-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood: draft.mood }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.loginRequired ? '登录已失效，请重新登录后保存。' : result.error || '保存失败，请重试。');
      setDraft(EMPTY_DRAFT);
      setMessage('已记下此刻。');
      try {
        await onSaved();
      } catch {
        setMessage('记录已保存，最新状态加载失败，请刷新页面查看。');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请稍后重试。');
    } finally {
      setSaving(false);
      onSavingChange(false);
    }
  }

  return <div className="card-warm fade-up min-w-0 p-6 md:p-10">
    <h1 className="font-display text-3xl text-ink-800">今天怎么样？</h1>
    <p className="mt-3 text-sm leading-6 text-sumi-500">记录此刻的你，选填即可。状态原文仅自己可见。</p>
    <form onSubmit={save}>
      <fieldset disabled={saving || disabled} className="min-w-0 disabled:opacity-60">
        <legend className="sr-only">此刻记录</legend>
        <Choices label="此刻心情" value={draft.mood} options={MOODS} onChange={(value) => update('mood', value)} />
        <Choices label="当前状态" value={draft.state} options={STATES} onChange={(value) => update('state', value)} />
        <label htmlFor="present-confusion" className="mt-6 block text-sm text-sumi-600">最近困惑 / 当下想法</label>
        <textarea id="present-confusion" value={draft.confusion} maxLength={MAX_RECORD_LENGTH} rows={4}
          onChange={(event) => update('confusion', event.target.value)}
          placeholder="最近有什么让你犹豫、好奇，或想找人聊聊？"
          aria-describedby="present-length"
          aria-invalid={tooLong}
          className="mt-3 w-full rounded-xl border border-paper-300 bg-white/70 p-4 text-sm outline-none focus:border-ink-400" />
        <Choices label="当前活动意愿" value={draft.activity} options={ACTIVITIES} onChange={(value) => update('activity', value)} />
        <Choices label="社交需求" value={draft.socialNeed} options={SOCIAL_NEEDS} onChange={(value) => update('socialNeed', value)} />
        <p id="present-length" className={`mt-4 text-xs ${tooLong ? 'text-red-700' : 'text-sumi-500'}`}>
          完整记录 {text.length} / {MAX_RECORD_LENGTH} 字（含栏目名称）{tooLong && '，请缩短内容后保存。'}
        </p>
        <div className="mt-6 rounded-xl border border-paper-300 bg-white/50 p-4">
          <label htmlFor="present-expiry" className="block text-sm text-sumi-600">状态有效期</label>
          <select id="present-expiry" disabled className="mt-2 w-full rounded-lg border border-paper-300 bg-paper-100 p-2 text-sm text-sumi-500">
            <option>待接入自动到期</option>
          </select>
          <p className="mt-2 text-xs leading-5 text-sumi-500">目前保存的记录不会自动到期；连接意愿请通过遇见开关控制。</p>
        </div>
        <button type="submit" disabled={!hasContent || tooLong || saving}
          className="btn-primary-blue mt-6 w-full !rounded-xl !bg-ink-800 hover:!bg-ink-900 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? '正在保存…' : '记下此刻'}
        </button>
      </fieldset>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <p role="status" className="mt-3 text-sm text-ink-700">{message}</p>
    </form>
    <section className="mt-4 rounded-xl bg-paper-200/70 p-4" aria-label="最新记录">
      <h2 className="text-sm text-sumi-700">{currentState ? '最近记下的此刻' : '从第一条记录开始'}</h2>
      {currentState ? <>
        {currentState.mood && <p className="mt-2 text-sm text-ink-700">心情：{currentState.mood}</p>}
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-sumi-600">{currentState.text}</p>
        <p className="mt-2 text-xs text-sumi-500">{new Date(currentState.created_at).toLocaleString('zh-CN')}</p>
      </> : <p className="mt-2 text-sm text-sumi-500">选一个心情，或写下一句想法，就可以记下此刻。</p>}
    </section>
  </div>;
}
