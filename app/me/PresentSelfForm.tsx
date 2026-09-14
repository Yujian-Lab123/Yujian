'use client';

import {
  BookOpenIcon, BriefcaseIcon, ChatCircleDotsIcon, FilmSlateIcon, FootprintsIcon,
  MoonIcon, MountainsIcon, SmileyIcon, SparkleIcon, SunIcon,
} from '@phosphor-icons/react';
import { useEffect, useState, type ComponentType, type FormEvent } from 'react';
import type { ExperienceAdapter } from '@/lib/experience-mode/adapter';
import { experienceFetch } from '@/lib/experience-mode/experience-fetch';
import {
  composeRecord, EMPTY_PRESENT_SELF_DRAFT, MAX_ACTIVITY_SELECTIONS, MAX_MOOD_SELECTIONS,
  MAX_PERSON_PREFERENCE_LENGTH, MAX_THOUGHT_LENGTH, parseRecord, type PresentSelfDraft,
} from '@/lib/present-self/record';
import styles from './present-self.module.css';

type IconComponent = ComponentType<{ size?: number; weight?: 'regular' | 'fill'; 'aria-hidden'?: boolean }>;

const MOODS: Array<{ label: string; icon: IconComponent; warm?: boolean }> = [
  { label: '平静', icon: MountainsIcon }, { label: '有点累', icon: MoonIcon },
  { label: '开心', icon: SunIcon, warm: true }, { label: '有点焦虑', icon: MountainsIcon },
  { label: '想散步', icon: FootprintsIcon }, { label: '想聊天', icon: ChatCircleDotsIcon },
  { label: '想认识新的人', icon: SmileyIcon }, { label: '想安静一下', icon: BookOpenIcon, warm: true },
  { label: '充满动力', icon: SparkleIcon },
];

const ACTIVITIES: Array<{ label: string; icon: IconComponent; warm?: boolean }> = [
  { label: '散步', icon: FootprintsIcon }, { label: '看书', icon: BookOpenIcon },
  { label: '看一部电影', icon: FilmSlateIcon }, { label: '好好吃一顿', icon: SmileyIcon, warm: true },
  { label: '随便走走', icon: MountainsIcon }, { label: '和有趣的人聊天', icon: ChatCircleDotsIcon },
  { label: '专注工作', icon: BriefcaseIcon }, { label: '只是放空', icon: SparkleIcon, warm: true },
];

const CONVERSATION_STYLES = ['轻松随意', '认真深入', '先从文字开始', '看情况'];

function ChoicePills({ values, options, max, onChange }: {
  values: string[];
  options: Array<{ label: string; icon: IconComponent; warm?: boolean }>;
  max: number;
  onChange: (values: string[]) => void;
}) {
  function toggle(label: string) {
    if (values.includes(label)) onChange(values.filter((value) => value !== label));
    else if (values.length < max) onChange([...values, label]);
  }
  return <div className={styles.pills}>
    {options.map(({ label, icon: Icon, warm }) => {
      const selected = values.includes(label);
      const blocked = !selected && values.length >= max;
      return <button key={label} type="button" aria-pressed={selected} disabled={blocked}
        className={`${styles.pill} ${selected ? styles.pillSelected : ''} ${warm ? styles.pillWarm : ''}`}
        onClick={() => toggle(label)}>
        <Icon size={18} weight={selected ? 'fill' : 'regular'} aria-hidden />{label}
      </button>;
    })}
  </div>;
}

export default function PresentSelfForm({ currentState, encounterEnabled, understanding, disabled, onToggle, onSaved, onSavingChange, onDraftChange, adapter }: {
  currentState: { text: string; mood: string; created_at: string } | null;
  encounterEnabled: boolean;
  understanding: { coreQuestion?: string; topics?: string[] } | null;
  disabled: boolean;
  onToggle: () => Promise<void>;
  onSaved: () => Promise<void>;
  onSavingChange: (saving: boolean) => void;
  onDraftChange: (draft: PresentSelfDraft) => void;
  /** 体验模式适配器：决定保存接口走真实 /api 还是演示 /api/demo。 */
  adapter: ExperienceAdapter;
}) {
  const [draft, setDraft] = useState<PresentSelfDraft>(EMPTY_PRESENT_SELF_DRAFT);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const parsed = currentState ? parseRecord(currentState.text, currentState.mood) : null;
    const next: PresentSelfDraft = parsed ? {
      moods: parsed.moods,
      thought: parsed.thought || parsed.legacyText,
      activities: parsed.activities,
      conversationStyle: parsed.conversationStyle,
      personPreference: parsed.personPreference,
    } : EMPTY_PRESENT_SELF_DRAFT;
    setDraft(next);
    onDraftChange(next);
  }, [currentState?.created_at]); // eslint-disable-line react-hooks/exhaustive-deps

  function update(next: PresentSelfDraft) {
    setDraft(next); onDraftChange(next); setMessage(''); setError('');
  }

  const text = composeRecord(draft);
  const hasContent = Boolean(text || draft.moods[0]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasContent || saving || disabled) return;
    setSaving(true); onSavingChange(true); setError(''); setMessage('');
    try {
      const response = await experienceFetch(adapter, '/me/current-state', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, mood: draft.moods[0] || '' }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.loginRequired ? '登录已失效，请重新登录后保存。' : result.error || '保存失败，请重试。');
      setMessage('已经记下这一刻。');
      await onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络异常，请稍后重试。');
    } finally {
      setSaving(false); onSavingChange(false);
    }
  }

  return <section className={styles.formCard}>
    <header className={styles.hero}>
      <span className={styles.eyebrow}>PRESENT MOMENT</span>
      <h1>今天的你，是什么样子？</h1><span className={styles.goldRule} />
      <p>在这里，记录此刻的心情、状态与期待。<br />这将帮助遇见更好地理解今天的你，为你推荐更合适的相遇。</p>
      <blockquote>好的相遇，<br />从诚实地表达此刻的自己开始。</blockquote>
    </header>

    <form className={styles.form} onSubmit={save}>
      <fieldset disabled={saving || disabled}>
        <div className={styles.fieldHeader}><legend>今日心情</legend><span>可多选，最多 {MAX_MOOD_SELECTIONS} 项</span></div>
        <ChoicePills values={draft.moods} options={MOODS} max={MAX_MOOD_SELECTIONS} onChange={(moods) => update({ ...draft, moods })} />

        <label className={styles.label} htmlFor="present-thought">最近在想什么？</label>
        <div className={styles.textareaWrap}>
          <textarea id="present-thought" rows={2} maxLength={MAX_THOUGHT_LENGTH} value={draft.thought}
            onChange={(event) => update({ ...draft, thought: event.target.value })}
            placeholder="写下最近停留在心里的事，或今天想整理的一点思绪。" />
          <span>{draft.thought.length}/{MAX_THOUGHT_LENGTH}</span>
        </div>

        <div className={styles.fieldHeader}><legend>今天想做什么？</legend><span>可多选，最多 {MAX_ACTIVITY_SELECTIONS} 项</span></div>
        <ChoicePills values={draft.activities} options={ACTIVITIES} max={MAX_ACTIVITY_SELECTIONS} onChange={(activities) => update({ ...draft, activities })} />

        <div className={styles.twoColumns}>
          <div><span className={styles.label}>愿意被遇见吗？</span>
            <div className={styles.switchRow}>
              <button type="button" role="switch" aria-checked={encounterEnabled} aria-label="今天愿意被遇见"
                className={`${styles.switch} ${encounterEnabled ? styles.switchOn : ''}`} onClick={() => void onToggle()}><span /></button>
              <div><strong>{encounterEnabled ? '今天愿意被遇见' : '今天暂时不参与相遇'}</strong><small>这个开关独立即时保存。</small></div>
            </div>
          </div>
          <fieldset><legend className={styles.label}>希望的交流方式</legend>
            <div className={styles.radios}>{CONVERSATION_STYLES.map((style) => <label key={style}>
              <input type="radio" name="conversation-style" checked={draft.conversationStyle === style}
                onChange={() => update({ ...draft, conversationStyle: style })} /> {style}
            </label>)}</div>
          </fieldset>
        </div>

        <label className={styles.label} htmlFor="present-person">想认识什么样的人？</label>
        <div className={styles.textareaWrap}>
          <textarea id="present-person" rows={1} maxLength={MAX_PERSON_PREFERENCE_LENGTH} value={draft.personPreference}
            onChange={(event) => update({ ...draft, personPreference: event.target.value })}
            placeholder="例如：有自己的生活节奏，愿意分享最近生活和小小灵感的人。" />
          <span>{draft.personPreference.length}/{MAX_PERSON_PREFERENCE_LENGTH}</span>
        </div>

        <div className={styles.aiPreview}><SparkleIcon size={26} weight="fill" aria-hidden />
          <div><strong>{understanding ? 'AI 理解' : '理解预览'}</strong>
            <p>{draft.moods.length ? `你此刻带着${draft.moods.join('、')}的感受。` : '选择一点心情，让遇见从此刻开始理解你。'}{draft.personPreference ? ` 你希望遇见${draft.personPreference}` : ''}</p>
          </div>
        </div>
      </fieldset>

      <div className={styles.formFooter}><span>此刻只是此刻。无论此刻怎样，你都值得被温柔地遇见。</span>
        <button type="submit" disabled={!hasContent || saving || disabled}>{saving ? '正在保存…' : '更新此刻'} <span aria-hidden>→</span></button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <p role="status" className={styles.success}>{message}</p>
    </form>
  </section>;
}
