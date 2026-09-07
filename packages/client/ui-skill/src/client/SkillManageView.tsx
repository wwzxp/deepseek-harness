/**
 * Skill management view (spec §19.5.4): catalog list, usage-driven candidates,
 * HITL confirm, and delete. Data rides the member business API (same-origin
 * /api/skills*) — the skill *mechanism* stays harness-native (.dsh/skills/
 * discovered by ctx.skills), this panel is the management surface in the
 * harness Settings section.
 */
import { useEffect, useState, type ReactElement } from 'react'
import css from './SkillManage.module.css'

interface SkillItem {
  name: string
  description: string
  source: string
  category?: string
}

interface Candidate {
  name: string
  description: string
  triggers: string[]
  steps: string[]
  freq: number
  sample: string
  category?: string
}

const api = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('member_token') ?? ''}`,
    },
    ...init,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return (await res.json()) as T
}

export function SkillManageView(): ReactElement {
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async (): Promise<void> => {
    setError('')
    try {
      const [s, c] = await Promise.all([
        api<{ ok: boolean; skills?: SkillItem[]; error?: string }>('/api/skills'),
        api<{ ok: boolean; candidates?: Candidate[] }>('/api/skills/candidates'),
      ])
      if (s.ok === false) throw new Error(s.error ?? '技能列表失败')
      setSkills(s.skills ?? [])
      setCandidates(c.candidates ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }
  useEffect(() => { void load() }, [])

  const confirm = async (cand: Candidate): Promise<void> => {
    setBusy(true)
    try {
      const r = await api<{ ok: boolean; error?: string }>('/api/skills/confirm', {
        method: 'POST', body: JSON.stringify({ ...cand, category: cand.category ?? '其它' }),
      })
      if (!r.ok) throw new Error(r.error ?? '确认失败')
      setCandidates(prev => prev.filter(x => x !== cand))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '确认失败')
    } finally { setBusy(false) }
  }

  const remove = async (name: string): Promise<void> => {
    if (!globalThis.confirm(`删除技能 ${name}？`)) return
    setBusy(true)
    try {
      const r = await api<{ ok: boolean; error?: string }>('/api/skills/delete', {
        method: 'POST', body: JSON.stringify({ name }),
      })
      if (!r.ok) throw new Error(r.error ?? '删除失败')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : '删除失败')
    } finally { setBusy(false) }
  }

  return (
    <div className={css.view}>
      <div className={css.head}>
        <h3 className={css.title}>技能库</h3>
        <button className={css.refresh} onClick={() => void load()} disabled={busy}>刷新</button>
      </div>
      {error !== '' && <div className={css.error}>{error}</div>}

      <div className={css.sectionTitle}>已发现技能（.dsh/skills，harness 自动发现）</div>
      {skills.length === 0 && <div className={css.empty}>暂无技能</div>}
      {[...new Set(skills.map(s => s.category ?? '其它'))].map(cat => (
        <div key={cat} className={css.catGroup}>
          <div className={css.catTitle}>{cat}（{skills.filter(s => (s.category ?? '其它') === cat).length}）</div>
          {skills.filter(s => (s.category ?? '其它') === cat).map(s => (
            <div key={s.name} className={css.row}>
              <div className={css.rowMain}>
                <span className={css.name}>{s.name}</span>
                <span className={css.desc}>{s.description}</span>
              </div>
              <button className={css.del} onClick={() => void remove(s.name)} disabled={busy}>删除</button>
            </div>
          ))}
        </div>
      ))}

      <div className={css.sectionTitle}>候选技能（来自高频提问统计，需确认后入库）</div>
      {candidates.length === 0 && <div className={css.empty}>暂无候选（AI 使用产生高频提问后出现）</div>}
      {candidates.map(cand => (
        <div key={cand.name + cand.sample} className={css.row}>
          <div className={css.rowMain}>
            <span className={css.name}>{cand.name}</span>
            <span className={css.desc}>{cand.description}（频次 {cand.freq}）</span>
            <span className={css.sample}>{cand.sample}</span>
          </div>
          <button className={css.confirm} onClick={() => void confirm(cand)} disabled={busy}>确认入库</button>
        </div>
      ))}
    </div>
  )
}
