'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { createClient, type Employee, type Meal } from '@/lib/supabase'

const supabase = createClient()

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

function formatDate(d: string) {
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}

function formatDateShort(d: string) {
  const [, m, day] = d.split('-')
  return `${day}/${m}`
}

const CANTINE_COLOR = '#7030a0'
const CANTINE_COLOR_OLD = '#f5b8c8'
const isCantine = (color?: string | null) => color === CANTINE_COLOR || color === CANTINE_COLOR_OLD

function genCommentaire(type: 'paye' | 'invite', date: string, inviterName?: string, countColor?: string) {
  const label = formatDateShort(date)
  if (isCantine(countColor)) return `Cantine le ${label}`
  if (type === 'paye') return `Repas du ${label}`
  if (inviterName) return `Invité par ${inviterName} le ${label}`
  return `Repas en tant qu'invité le ${label}`
}

const PRESET_COLORS = [
  '#0f172a','#00336B','#9AC00C','#059669','#3b82f6',
  '#8b5cf6','#f59e0b','#ef4444','#ec4899','#64748b',
  '#ffffff','#f1f5f9','#fef3c7','#dcfce7',
]

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <label style={S.label}>{label}</label>
      <button type="button" onClick={() => setOpen(o => !o)} style={S.colorTrigger}>
        <span style={{ width: 18, height: 18, borderRadius: 4, background: value, border: '1px solid var(--border2)', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 12, color: 'var(--text2)', fontFamily: 'monospace' }}>{value}</span>
        <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 8L1 3h10z" fill="#6b7280"/>
        </svg>
      </button>
      {open && (
        <div style={S.colorPanel} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {PRESET_COLORS.map(c => (
              <button key={c} type="button" onClick={() => { onChange(c); setOpen(false) }} style={{
                width: 26, height: 26, borderRadius: 5, background: c, cursor: 'pointer', flexShrink: 0,
                border: c === value ? '2px solid var(--primary)' : '1px solid var(--border2)',
                boxShadow: c === value ? '0 0 0 2px var(--primary-light)' : 'none'
              }} />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="color" value={value} onChange={e => onChange(e.target.value)}
              style={{ width: 34, height: 34, border: 'none', background: 'none', cursor: 'pointer', padding: 0, borderRadius: 6 }} />
            <input value={value} onChange={e => onChange(e.target.value)} style={{ ...S.input, flex: 1, fontSize: 12, fontFamily: 'monospace' }} placeholder="#000000" />
          </div>
        </div>
      )}
    </div>
  )
}

function SearchInput({ value, onChange, placeholder, inputStyle }: { value: string; onChange: (v: string) => void; placeholder?: string; inputStyle?: React.CSSProperties }) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: 14, pointerEvents: 'none', opacity: 1, fontWeight: 600 }}>⌕</span>
      <input
        style={{ ...S.input, paddingLeft: 30, ...inputStyle }}
        placeholder={placeholder || 'Rechercher…'}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

type Tab = 'saisie' | 'mensuel' | 'salaries' | 'export' | 'profil'

const IMPUTATIONS = [
  { label: 'Vélizy',     color: '#a8e6a3' },
  { label: 'Chanteloup', color: '#a3d4f5' },
  { label: 'Verneuil',   color: '#fde89a' },
  { label: 'Cantine',    color: '#7030a0' },
] as const

function getImputation(color: string | null | undefined) {
  return IMPUTATIONS.find(i => i.color === color) || IMPUTATIONS[0]
}

export default function Home() {
  const [tab, setTab] = useState<Tab>('saisie')
  const [employees, setEmployees] = useState<Employee[]>([])
  const [meals, setMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(true)
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth())
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear())

  const nowYM = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}` }
  const [mForm, setMForm] = useState({
    employeeId: '', date: new Date().toISOString().slice(0, 10),
    targetMonth: nowYM(),
    type: 'paye' as 'paye' | 'invite', invites: [] as string[],
    commentaire: '', commentaireColor: '#0f172a', countColor: '#a8e6a3',
    empSearch: '', inviteSearch: ''
  })
  const [editMeal, setEditMeal] = useState<Meal | null>(null)
  const [editMealOriginalDate, setEditMealOriginalDate] = useState<string | null>(null)
  const [dateChangeModal, setDateChangeModal] = useState<{ meal: Meal; oldDate: string; newDate: string } | null>(null)
  const [eForm, setEForm] = useState({ nom: '', prenom: '', grand_deplacement: false })
  const [editEmp, setEditEmp] = useState<Employee | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' }>({ msg: '', type: 'ok' })
  const [monthSearch, setMonthSearch] = useState('')
  const [empSearch, setEmpSearch] = useState('')
  const [summarySort, setSummarySort] = useState<{ key: 'nom' | 'paye' | 'invite' | 'total'; dir: 'asc' | 'desc' }>({ key: 'nom', dir: 'asc' })
  const [confirmDelEmp, setConfirmDelEmp] = useState<Employee | null>(null)
  const [confirmDelMeal, setConfirmDelMeal] = useState<Meal | null>(null)
  const [confirmDeleteMonth, setConfirmDeleteMonth] = useState(false)
  const nowD = new Date()
  const [exportMonth, setExportMonth] = useState(nowD.getMonth())
  const [exportYear, setExportYear] = useState(nowD.getFullYear())

  // ── Profil (stockage local uniquement, sans compte Supabase Auth) ──
  const [profile, setProfile] = useState({ nom: '', prenom: '', poste: '', avatar: '', email: '' })
  const [showProfile, setShowProfile] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('gdm-local-profile')
      if (raw) {
        const p = JSON.parse(raw) as Record<string, string>
        setProfile({
          nom: p.nom || '',
          prenom: p.prenom || '',
          poste: p.poste || '',
          avatar: p.avatar || '',
          email: p.email || '',
        })
      }
    } catch { /* ignore */ }
  }, [])

  function saveProfile() {
    setProfileSaving(true)
    try {
      localStorage.setItem('gdm-local-profile', JSON.stringify(profile))
    } finally {
      setProfileSaving(false)
      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => { setProfile(p => ({ ...p, avatar: ev.target?.result as string })) }
    reader.readAsDataURL(file)
  }

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 2800)
  }

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [{ data: emps }, { data: ms }] = await Promise.all([
      supabase.from('employees').select('*').eq('actif', true).order('nom'),
      supabase.from('meals').select('*').order('date', { ascending: false })
    ])
    if (emps) setEmployees(emps)
    if (ms) setMeals(ms)
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const empById = useMemo(() => Object.fromEntries(employees.map(e => [e.id, e])), [employees])
  function getEmpName(id: string | null) {
    if (!id) return '—'
    const e = empById[id]
    return e ? `${e.nom} ${e.prenom}` : '—'
  }

  const filteredEmpForForm = useMemo(() =>
    employees.filter(e =>
      (e.nom + ' ' + e.prenom).toLowerCase().includes(mForm.empSearch.toLowerCase())
    ).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)),
  [employees, mForm.empSearch])

  const filteredEmpForMonth = useMemo(() =>
    employees.filter(e =>
      (e.nom + ' ' + e.prenom).toLowerCase().includes(monthSearch.toLowerCase())
    ).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)),
  [employees, monthSearch])

  const filteredEmpForAdmin = useMemo(() =>
    employees.filter(e =>
      (e.nom + ' ' + e.prenom).toLowerCase().includes(empSearch.toLowerCase())
    ).sort((a, b) => a.nom.localeCompare(b.nom) || a.prenom.localeCompare(b.prenom)),
  [employees, empSearch])

  async function addMeal() {
    if (!mForm.employeeId || !mForm.date) return
    const emp = empById[mForm.employeeId]
    const inserts: (Partial<Meal> & { target_month?: string })[] = []
    if (mForm.type === 'paye') {
      const tm = mForm.targetMonth + '-01'; inserts.push({ employee_id: mForm.employeeId, date: mForm.date, type: 'paye', invited_by: null, commentaire: mForm.commentaire || genCommentaire('paye', mForm.date, undefined, mForm.countColor), commentaire_color: mForm.commentaireColor, count_color: mForm.countColor, target_month: tm })
      for (const invId of mForm.invites) {
        inserts.push({ employee_id: invId, date: mForm.date, type: 'invite', invited_by: mForm.employeeId, commentaire: genCommentaire('invite', mForm.date, `${emp.prenom} ${emp.nom}`, mForm.countColor), commentaire_color: mForm.commentaireColor, count_color: mForm.countColor, target_month: tm })
      }
    } else {
      const tm2 = mForm.targetMonth + '-01'; inserts.push({ employee_id: mForm.employeeId, date: mForm.date, type: 'invite', invited_by: null, commentaire: mForm.commentaire || genCommentaire('invite', mForm.date, undefined, mForm.countColor), commentaire_color: mForm.commentaireColor, count_color: mForm.countColor, target_month: tm2 })
    }
    const { error } = await supabase.from('meals').insert(inserts)
    if (error) { showToast('Erreur lors de l\'enregistrement', 'err'); return }
    setMForm(f => ({ ...f, employeeId: '', invites: [], commentaire: '', empSearch: '', inviteSearch: '', targetMonth: nowYM() }))
    showToast(`${inserts.length} repas enregistré${inserts.length > 1 ? 's' : ''} ✓`)
    fetchAll()
  }

  async function deleteMeal(id: string) {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
    showToast('Repas supprimé')
  }

  async function deleteAllMonthMeals() {
    const targetMonth = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`
    const ids = monthMeals.map(m => m.id)
    if (ids.length === 0) return
    await supabase.from('meals').delete().in('id', ids)
    setMeals(prev => prev.filter(m => !ids.includes(m.id)))
    setConfirmDeleteMonth(false)
    showToast(`${ids.length} repas supprimés (${MONTHS[currentMonth]} ${currentYear})`)
  }

  async function saveEditMeal() {
    if (!editMeal) return
    const dateChanged = editMealOriginalDate && editMeal.date !== editMealOriginalDate
    if (dateChanged) {
      // Show choice modal instead of saving immediately
      setDateChangeModal({ meal: editMeal, oldDate: editMealOriginalDate!, newDate: editMeal.date })
      return
    }
    // No date change — save normally
    await supabase.from('meals').update({
      date: editMeal.date,
      commentaire: editMeal.commentaire,
      commentaire_color: editMeal.commentaire_color,
      count_color: editMeal.count_color,
    }).eq('id', editMeal.id)
    setEditMeal(null)
    setEditMealOriginalDate(null)
    showToast('Repas modifié ✓')
    fetchAll()
  }

  async function applyDateChange(mode: 'replace' | 'strikethrough') {
    if (!dateChangeModal) return
    const { meal, oldDate, newDate } = dateChangeModal
    if (mode === 'replace') {
      // Supprime l'ancienne date → met à jour normalement, efface original_date
      await supabase.from('meals').update({
        date: newDate,
        commentaire: meal.commentaire,
        commentaire_color: meal.commentaire_color,
        count_color: meal.count_color,
        original_date: null,
      }).eq('id', meal.id)
      showToast('Date remplacée ✓')
    } else {
      // Barre l'ancienne date → stocke oldDate dans original_date
      await supabase.from('meals').update({
        date: newDate,
        commentaire: meal.commentaire,
        commentaire_color: meal.commentaire_color,
        count_color: meal.count_color,
        original_date: oldDate,
      }).eq('id', meal.id)
      showToast('Ancienne date conservée (barrée) ✓')
    }
    setDateChangeModal(null)
    setEditMeal(null)
    setEditMealOriginalDate(null)
    fetchAll()
  }

  async function saveEmployee() {
    if (!eForm.nom || !eForm.prenom) return
    if (editEmp) { await supabase.from('employees').update(eForm).eq('id', editEmp.id); showToast('Salarié modifié ✓') }
    else { await supabase.from('employees').insert({ ...eForm, actif: true }); showToast('Salarié ajouté ✓') }
    setEForm({ nom: '', prenom: '', grand_deplacement: false }); setEditEmp(null); fetchAll()
  }

  async function deleteEmployee(id: string) {
    await supabase.from('employees').delete().eq('id', id)
    setConfirmDelEmp(null); showToast('Salarié supprimé'); fetchAll()
  }

  function toggleInvite(id: string) {
    setMForm(f => ({ ...f, invites: f.invites.includes(id) ? f.invites.filter(i => i !== id) : [...f.invites, id] }))
  }

  const monthMeals = useMemo(() => meals.filter(m => {
    const tm = m.target_month ? m.target_month.slice(0, 7) : m.date.slice(0, 7)
    const [y, mo] = tm.split('-').map(Number)
    return mo - 1 === currentMonth && y === currentYear
  }), [meals, currentMonth, currentYear])

  const summary = useMemo(() => employees.reduce((acc, e) => {
    const em = monthMeals.filter(m => m.employee_id === e.id)
    acc[e.id] = { paye: em.filter(m => m.type === 'paye').length, invite: em.filter(m => m.type === 'invite').length }
    return acc
  }, {} as Record<string, { paye: number; invite: number }>), [employees, monthMeals])

  /** Compteurs affichés / totaux : 0 si grand déplacement, sinon comptage réel */
  const displayCounts = useCallback((e: Employee) => {
    if (e.grand_deplacement) return { paye: 0, invite: 0 }
    const s = summary[e.id] || { paye: 0, invite: 0 }
    return { paye: s.paye, invite: s.invite }
  }, [summary])

  return (
    <div className="acm-shell">
      {toast.msg && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, background: toast.type === 'ok' ? 'var(--primary)' : 'var(--red)', color: '#fff', padding: '11px 20px', borderRadius: 8, fontWeight: 600, fontSize: 13, boxShadow: '0 4px 20px rgba(0,0,0,.15)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>{toast.type === 'ok' ? '✓' : '✕'}</span> {toast.msg}
        </div>
      )}

      {editMeal && (
        <div style={S.overlay} onClick={() => { setEditMeal(null); setEditMealOriginalDate(null) }}>
          <div className="acm-modal-mobile" style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Modifier le repas</span>
              <button style={S.closeBtn} onClick={() => { setEditMeal(null); setEditMealOriginalDate(null) }}>✕</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              <div><label style={S.label}>Salarié</label><div style={{ fontWeight: 500, color: 'var(--primary)' }}>{getEmpName(editMeal.employee_id)}</div></div>
              <div>
                <label style={S.label}>Date</label>
                <input type="date" style={S.input} value={editMeal.date} onChange={e => setEditMeal(m => m ? { ...m, date: e.target.value } : m)} />
                {editMeal.original_date && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>Date originale :</span>
                    <span style={{ textDecoration: 'line-through', textDecorationColor: '#e53e3e', color: 'var(--text2)', fontWeight: 500 }}>
                      {new Date(editMeal.original_date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <button
                      title="Effacer la date barrée"
                      onClick={() => setEditMeal(m => m ? { ...m, original_date: null } : m)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 11, padding: '1px 4px', borderRadius: 4, opacity: 0.6, transition: 'opacity .15s' }}
                      onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                      onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                    >✕ effacer</button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <label style={S.label}>Type</label>
                <span style={editMeal.type === 'paye' ? S.badgePaye : S.badgeInvite}>{editMeal.type === 'paye' ? 'Payé' : 'Invité'}</span>
              </div>
              {editMeal.invited_by && <div><label style={S.label}>Invité par</label><div style={{ color: 'var(--text2)' }}>{getEmpName(editMeal.invited_by)}</div></div>}
              <div><label style={S.label}>Commentaire</label><input style={S.input} value={editMeal.commentaire || ''} onChange={e => setEditMeal(m => m ? { ...m, commentaire: e.target.value } : m)} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <ColorPicker label="Couleur commentaire" value={editMeal.commentaire_color || '#0f172a'} onChange={c => setEditMeal(m => m ? { ...m, commentaire_color: c } : m)} />
                <div>
                        <label style={S.label}>Imputation</label>
                        <div style={{ position: 'relative' }}>
                          <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: 4, background: editMeal.count_color || '#a8e6a3', border: '1px solid rgba(0,0,0,.12)', pointerEvents: 'none', zIndex: 1 }} />
                          <select style={{ ...S.input, paddingLeft: 32 }} value={editMeal.count_color || '#a8e6a3'} onChange={e => setEditMeal(m => m ? { ...m, count_color: e.target.value } : m)}>
                            {IMPUTATIONS.map(imp => <option key={imp.label} value={imp.color}>{imp.label}</option>)}
                          </select>
                        </div>
                      </div>
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button style={S.btnGhost} onClick={() => { setEditMeal(null); setEditMealOriginalDate(null) }}>Annuler</button>
                <button className="acm-btn-primary" style={S.btnPrimary} onClick={saveEditMeal}>Enregistrer</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelEmp && (
        <div style={S.overlay} onClick={() => setConfirmDelEmp(null)}>
          <div className="acm-modal-mobile" style={{ ...S.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Supprimer le salarié ?</span>
              <button style={S.closeBtn} onClick={() => setConfirmDelEmp(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 8 }}>
              Vous êtes sur le point de supprimer <strong>{confirmDelEmp.prenom} {confirmDelEmp.nom}</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', borderRadius: 6, padding: '8px 12px', marginBottom: 20 }}>
              ⚠ Tous les repas associés à ce salarié seront également supprimés. Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setConfirmDelEmp(null)}>Annuler</button>
              <button style={S.btnDanger} onClick={() => deleteEmployee(confirmDelEmp.id)}>Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelMeal && (
        <div style={S.overlay} onClick={() => setConfirmDelMeal(null)}>
          <div className="acm-modal-mobile" style={{ ...S.modal, maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Supprimer ce repas ?</span>
              <button style={S.closeBtn} onClick={() => setConfirmDelMeal(null)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>
              Vous êtes sur le point de supprimer le repas de{' '}
              <strong>{getEmpName(confirmDelMeal.employee_id)}</strong> du{' '}
              <strong>{formatDate(confirmDelMeal.date)}</strong>.
            </p>
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', borderRadius: 8, padding: '9px 13px', marginBottom: 20, border: '1px solid #fecaca' }}>
              ⚠ Cette action est irréversible.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="acm-btn-ghost" style={S.btnGhost} onClick={() => setConfirmDelMeal(null)}>Annuler</button>
              <button className="acm-btn-danger" style={S.btnDanger} onClick={() => { deleteMeal(confirmDelMeal.id); setConfirmDelMeal(null) }}>Confirmer la suppression</button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteMonth && (
        <div style={S.overlay} onClick={() => setConfirmDeleteMonth(false)}>
          <div className="acm-modal-mobile" style={{ ...S.modal, maxWidth: 440 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Supprimer tous les repas ?</span>
              <button style={S.closeBtn} onClick={() => setConfirmDeleteMonth(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10, lineHeight: 1.6 }}>
              Vous êtes sur le point de supprimer <strong>tous les repas de {MONTHS[currentMonth]} {currentYear}</strong> ({monthMeals.length} repas au total).
            </p>
            <p style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', borderRadius: 8, padding: '9px 13px', marginBottom: 20, border: '1px solid #fecaca' }}>
              ⚠ Cette action est irréversible. Tous les repas rattachés à ce mois seront définitivement supprimés.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="acm-btn-ghost" style={S.btnGhost} onClick={() => setConfirmDeleteMonth(false)}>Annuler</button>
              <button className="acm-btn-danger" style={S.btnDanger} onClick={deleteAllMonthMeals}>
                Supprimer {monthMeals.length} repas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal choix changement de date ── */}
      {dateChangeModal && (
        <div style={S.overlay} onClick={() => setDateChangeModal(null)}>
          <div className="acm-modal-mobile" style={{ ...S.modal, maxWidth: 460 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <span style={S.modalTitle}>Date modifiée — que faire ?</span>
              <button style={S.closeBtn} onClick={() => setDateChangeModal(null)}>✕</button>
            </div>

            {/* Aperçu du changement */}
            <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 16px', marginBottom: 18, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' as const }}>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>Ancienne date</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2)', textDecoration: 'line-through', textDecorationColor: '#e53e3e', textDecorationThickness: '2px' }}>
                  {new Date(dateChangeModal.oldDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
              <span style={{ fontSize: 20, color: 'var(--text3)' }}>→</span>
              <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase' as const, letterSpacing: '.05em' }}>Nouvelle date</span>
                <span style={{ fontSize: 15, fontWeight: 700, color: '#e53e3e' }}>
                  {new Date(dateChangeModal.newDate + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
              </div>
            </div>

            {/* Deux options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
              {/* Option 1 — Supprimer l'ancienne */}
              <button
                onClick={() => applyDateChange('replace')}
                style={{ background: '#fff', border: '2px solid var(--border2)', borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease', display: 'flex', flexDirection: 'column' as const, gap: 8 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3282DE'; (e.currentTarget as HTMLButtonElement).style.background = '#F0F6FF' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
              >
                <span style={{ fontSize: 22 }}>🗑</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Remplacer la date</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                    L'ancienne date est définitivement supprimée. Seule la nouvelle apparaît dans le récap.
                  </div>
                </div>
              </button>

              {/* Option 2 — Barrer l'ancienne */}
              <button
                onClick={() => applyDateChange('strikethrough')}
                style={{ background: '#fff', border: '2px solid var(--border2)', borderRadius: 12, padding: '14px 12px', cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s ease', display: 'flex', flexDirection: 'column' as const, gap: 8 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#e53e3e'; (e.currentTarget as HTMLButtonElement).style.background = '#FFF5F5' }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLButtonElement).style.background = '#fff' }}
              >
                <span style={{ fontSize: 22 }}>✍️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 4 }}>Barrer l'ancienne</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
                    L'ancienne date reste visible <span style={{ textDecoration: 'line-through' }}>barrée</span> et la nouvelle apparaît en <span style={{ color: '#e53e3e', fontWeight: 600 }}>rouge</span>.
                  </div>
                </div>
              </button>
            </div>

            <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
              <button style={S.btnGhost} onClick={() => setDateChangeModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="acm-sidebar">
        <div className="acm-sidebar-logo-wrap">
          <img
            src="/logo-generale-maintenance.png"
            alt="Generale de Maintenance"
            className="acm-sidebar-logo"
            width={812}
            height={237}
          />
        </div>
        <nav className="acm-nav">
          {([
            { key: 'saisie',   icon: '✎', label: 'Saisie repas' },
            { key: 'mensuel',  icon: '◫', label: 'Vue mensuelle' },
            { key: 'export',   icon: '⬇', label: 'Export' },
            { key: 'salaries', icon: '☰', label: 'Salariés' },
          ] as { key: Tab; icon: string; label: string }[]).map(item => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`acm-nav-item${tab === item.key ? ' active' : ''}`}>
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="acm-sidebar-footer" style={{ padding: '12px 12px 16px', borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 500, padding: '0 4px 8px', letterSpacing: '.02em', textTransform: 'uppercase' }}>
            {employees.length} salarié{employees.length !== 1 ? 's' : ''} actifs
          </div>

          {/* Bouton Profil */}
          <button
            onClick={() => setTab('profil')}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg2)', cursor: 'pointer', marginBottom: 6, transition: 'all .15s ease', textAlign: 'left', fontFamily: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-light)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
          >
            <div style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, background: profile.avatar ? 'transparent' : 'linear-gradient(135deg,#3282DE,#9AC00C)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '2px solid var(--border)' }}>
              {profile.avatar
                ? <img src={profile.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                : <span style={{ color: 'white', fontSize: 13, fontWeight: 700 }}>{(profile.prenom?.[0] || profile.email?.[0] || '?').toUpperCase()}</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.prenom && profile.nom ? `${profile.prenom} ${profile.nom}` : 'Mon profil'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {profile.poste || profile.email || ''}
              </div>
            </div>
            <span style={{ color: 'var(--text3)', fontSize: 12 }}>›</span>
          </button>
        </div>

      </aside>

      {/* ── Main wrapper ── */}
      <div className="acm-main-wrapper">
        <div className="acm-topbar">
          {/* Page title */}
          <span className="acm-topbar-page" style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', letterSpacing: '-.01em' }}>
            {tab === 'saisie' ? 'Saisie des repas' : tab === 'mensuel' ? 'Vue mensuelle' : tab === 'export' ? 'Export' : tab === 'profil' ? 'Mon profil' : 'Gestion des salariés'}
          </span>
          <span className="acm-topbar-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ height: 16, width: 1, background: 'var(--border2)' }} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>Generale de Maintenance</span>
          </span>
        </div>
      <main className="acm-main">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text3)' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⟳</div>
            <div>Chargement…</div>
          </div>
        ) : (
          <>
            {tab === 'saisie' && (
              <div style={{ display: 'grid', gap: 24 }}>
                <div>
                  <h1 style={S.pageTitle}>Saisie des repas</h1>
                  <p style={S.pageSub}>Enregistrez un repas pour un salarié</p>
                </div>
              <div className="acm-saisie-layout">
                <div style={S.card} className="acm-card-mobile">
                  <div style={S.cardHeader}>
                    <span style={S.cardTitle}>Ajouter un repas</span>
                  </div>
                  <div className="acm-grid2">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={S.label}>Salarié</label>
                      <div style={{ position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: 14, pointerEvents: 'none', fontWeight: 600, zIndex: 1 }}>⌕</span>
                        <input
                          style={{ ...S.input, paddingLeft: 30 }}
                          placeholder="Rechercher…"
                          value={mForm.empSearch}
                          onChange={e => {
                            const v = e.target.value
                            setMForm(f => ({ ...f, empSearch: v, employeeId: '' }))
                          }}
                          onFocus={() => setMForm(f => ({ ...f, employeeId: '' }))}
                        />
                        {mForm.empSearch && filteredEmpForForm.length > 0 && !mForm.employeeId && (
                          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.10)', marginTop: 4, overflow: 'hidden', maxHeight: 200, overflowY: 'auto' }}>
                            {filteredEmpForForm.map(e => (
                              <button key={e.id} type="button"
                                onMouseDown={() => setMForm(f => ({ ...f, employeeId: e.id, empSearch: e.prenom + ' ' + e.nom, invites: [] }))}
                                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', fontSize: 13.5, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', transition: 'background .1s' }}
                                onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--bg2)')}
                                onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                              >
                                {e.prenom} {e.nom}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={S.label}>Type de repas</label>
                      <select style={S.input} value={mForm.type} onChange={e => setMForm(f => ({ ...f, type: e.target.value as 'paye' | 'invite', invites: [] }))}>
                        <option value="paye">Payé</option>
                        <option value="invite">Invité</option>
                      </select>
                    </div>
                  </div>
                  <div className="acm-grid2">
                    <div>
                      <label style={S.label}>Date du repas</label>
                      <input type="date" style={S.input} value={mForm.date} onChange={e => setMForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div>
                      <label style={S.label}>Mois rattaché</label>
                      <input type="month" style={S.input} value={mForm.targetMonth} onChange={e => setMForm(f => ({ ...f, targetMonth: e.target.value }))} />
                    </div>
                  </div>

                  <div className="acm-grid2" style={{ marginBottom: 16 }}>
                    <div>
                      <label style={S.label}>Commentaire <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}> (auto)</span></label>
                      <input style={S.input} value={mForm.commentaire} placeholder={genCommentaire(mForm.type, mForm.date, undefined, mForm.countColor)} onChange={e => setMForm(f => ({ ...f, commentaire: e.target.value }))} />
                    </div>
                    <ColorPicker label="Couleur commentaire" value={mForm.commentaireColor} onChange={c => setMForm(f => ({ ...f, commentaireColor: c }))} />
                  </div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Imputation</label>
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, borderRadius: 4, background: mForm.countColor, border: '1px solid rgba(0,0,0,.12)', pointerEvents: 'none', zIndex: 1 }} />
                      <select style={{ ...S.input, paddingLeft: 32 }} value={mForm.countColor} onChange={e => setMForm(f => ({ ...f, countColor: e.target.value }))}>
                        {IMPUTATIONS.map(imp => <option key={imp.label} value={imp.color}>{imp.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {mForm.type === 'paye' && mForm.employeeId && (
                    <div style={{ marginBottom: 16 }}>
                      <label style={S.label}>Personnes invitées</label>

                      {/* Tags des invités sélectionnés */}
                      {mForm.invites.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                          {mForm.invites.map(id => {
                            const emp = employees.find(e => e.id === id)
                            if (!emp) return null
                            return (
                              <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 500, background: 'var(--secondary-light)', color: '#3a4a00', border: '1.5px solid #c5d96e' }}>
                                {emp.prenom} {emp.nom}
                                <button type="button" onClick={() => toggleInvite(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3a4a00', fontSize: 14, lineHeight: 1, padding: '0 2px', opacity: 0.7 }}>×</button>
                              </span>
                            )
                          })}
                        </div>
                      )}

                      {/* Barre de recherche + suggestions */}
                      <div style={{ position: 'relative', maxWidth: 360 }}>
                        <SearchInput
                          value={mForm.inviteSearch}
                          onChange={v => setMForm(f => ({ ...f, inviteSearch: v }))}
                          placeholder="Rechercher un invité…"
                        />
                        {mForm.inviteSearch.trim().length > 0 && (() => {
                          const results = employees.filter(e =>
                            e.id !== mForm.employeeId &&
                            !mForm.invites.includes(e.id) &&
                            (e.prenom + ' ' + e.nom).toLowerCase().includes(mForm.inviteSearch.toLowerCase())
                          )
                          if (results.length === 0) return (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, color: 'var(--text3)', boxShadow: 'var(--shadow-md)' }}>
                              Aucun résultat
                            </div>
                          )
                          return (
                            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, marginTop: 4, background: 'var(--bg)', border: '1px solid var(--border2)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-md)', maxHeight: 220, overflowY: 'auto' }}>
                              {results.map(e => (
                                <button key={e.id} type="button"
                                  onClick={() => { toggleInvite(e.id); setMForm(f => ({ ...f, inviteSearch: '' })) }}
                                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--text)', borderBottom: '1px solid var(--border)' }}
                                  onMouseEnter={ev => (ev.currentTarget.style.background = 'var(--primary-light)')}
                                  onMouseLeave={ev => (ev.currentTarget.style.background = 'none')}
                                >
                                  {e.prenom} {e.nom}
                                </button>
                              ))}
                            </div>
                          )
                        })()}
                      </div>

                      {mForm.invites.length > 0 && (
                        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--primary)', background: 'var(--primary-light)', borderRadius: 6, padding: '8px 12px', fontWeight: 500 }}>
                          → {mForm.invites.length} entrée{mForm.invites.length > 1 ? 's' : ''} «invité» créées automatiquement
                        </div>
                      )}
                    </div>
                  )}

                  <button className="acm-btn-primary" style={S.btnPrimary} onClick={addMeal} disabled={!mForm.employeeId || !mForm.date}>
                    + Enregistrer le repas
                  </button>
                </div>

                <div style={S.cardSecondary} className="acm-card-mobile">
                  <div style={{ ...S.cardHeader, marginBottom: 0 }}>
                    <span style={S.cardTitle}>Derniers ajouts</span>
                    <span style={S.badge}>{meals.length} au total</span>
                  </div>
                  <div style={S.tableWrap} className="acm-tbl">
                    {meals.slice(0, 3).length === 0 ? (
                      <div style={S.emptyState}>Aucun repas enregistré.</div>
                    ) : (
                      <>
                        <div style={S.tableHead}>
                          <span>Date</span>
                          <span>Salarié</span>
                          <span style={{ justifySelf: 'center' }}>Type</span>
                          <span />
                        </div>
                        {meals.slice(0, 3).map(m => (
                          <MealRow key={m.id} meal={m} empName={getEmpName(m.employee_id)} onEdit={() => { setEditMeal(m); setEditMealOriginalDate(m.date) }} onDelete={() => setConfirmDelMeal(m)} />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
            )}

            {tab === 'mensuel' && (
              <div style={{ display: 'grid', gap: 20 }}>
                {/* ── En-tête navigation mois ── */}
                <div className="acm-month-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h1 style={S.pageTitle}>Vue mensuelle</h1>
                    <p style={S.pageSub}>Résumé et détail des repas par salarié</p>
                  </div>
                  <div className="acm-month-controls" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button style={S.navBtn} onClick={() => {
                        if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
                        else setCurrentMonth(m => m - 1)
                      }}>‹</button>
                      <span style={{ fontWeight: 600, minWidth: 160, textAlign: 'center', color: 'var(--primary)', fontSize: 15 }}>{MONTHS[currentMonth]} {currentYear}</span>
                      <button style={S.navBtn} onClick={() => {
                        if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
                        else setCurrentMonth(m => m + 1)
                      }}>›</button>
                    </div>
                    {monthMeals.length > 0 && (
                      <button
                        className="acm-btn-danger acm-delete-month-btn"
                        style={{ ...S.btnDanger, gap: 6 }}
                        onClick={() => setConfirmDeleteMonth(true)}
                      >
                        🗑 Supprimer tous les repas
                      </button>
                    )}
                  </div>
                </div>

                {monthMeals.length === 0 ? (
                  <div style={S.card} className="acm-card-mobile"><div style={S.emptyState}>Aucun repas pour {MONTHS[currentMonth]} {currentYear}.</div></div>
                ) : (() => {
                  const impColorLight = (hex: string) => { const h = hex.replace('#',''); const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16); return `rgba(${r},${g},${b},0.28)` }
                  const visibleEmps = [...filteredEmpForMonth]
                    .filter(e => { const s = summary[e.id] || { paye:0,invite:0 }; return (s.paye+s.invite) > 0 })
                    .sort((a,b) => {
                      const sa = displayCounts(a)
                      const sb = displayCounts(b)
                      const d = summarySort.dir === 'asc' ? 1 : -1
                      if (summarySort.key === 'nom') return (a.nom+' '+a.prenom).localeCompare(b.nom+' '+b.prenom)*d
                      if (summarySort.key === 'paye') return (sa.paye-sb.paye)*d
                      if (summarySort.key === 'invite') return (sa.invite-sb.invite)*d
                      return ((sa.paye+sa.invite)-(sb.paye+sb.invite))*d
                    })
                  const totalPaye = visibleEmps.reduce((acc,e) => acc + displayCounts(e).paye, 0)
                  const totalInvite = visibleEmps.reduce((acc,e) => acc + displayCounts(e).invite, 0)
                  return (
                    <div style={S.card} className="acm-card-mobile">

                      <div style={{ ...S.cardHeader, marginBottom: 16 }}>
                        <div>
                          <span style={S.cardTitle}>Repas de {MONTHS[currentMonth]} {currentYear}</span>
                          <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text3)', fontWeight: 400 }}>{monthMeals.length} repas · {visibleEmps.length} salarié{visibleEmps.length !== 1 ? 's' : ''}</span>
                        </div>
                        <div style={{ maxWidth: 240 }}>
                          <SearchInput value={monthSearch} onChange={setMonthSearch} placeholder="Filtrer par nom…" />
                        </div>
                      </div>

                      {/* ── En-têtes colonnes ── */}
                      <div className="acm-monthly-table">
                      <div style={{ display: 'grid', gridTemplateColumns: '180px 72px 72px 72px 1fr', gap: 12, padding: '8px 12px 10px', borderBottom: '1.5px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: 'var(--primary)', minWidth: 560 }}>
                        {([
                          { k: 'nom',    label: 'Nom / Prénom', sortable: true },
                          { k: 'paye',   label: 'Payé',         sortable: true },
                          { k: 'invite', label: 'Invité',       sortable: true },
                          { k: 'total',  label: 'Total',        sortable: true },
                          { k: 'repas',  label: 'Commentaire',  sortable: false },
                        ] as { k: string; label: string; sortable: boolean }[]).map(({ k, label, sortable }) => {
                          const active = sortable && summarySort.key === k
                          return (
                            <span key={k}
                              onClick={sortable ? () => setSummarySort(p => ({ key: k as 'nom'|'paye'|'invite'|'total', dir: p.key === k && p.dir === 'asc' ? 'desc' : 'asc' })) : undefined}
                              style={{ cursor: sortable ? 'pointer' : 'default', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 3, justifyContent: k === 'nom' || k === 'repas' ? 'flex-start' : 'center', color: k === 'repas' ? 'var(--text3)' : 'var(--primary)' }}>
                              {label}
                              {sortable && <span style={{ fontSize: 9, opacity: active ? 1 : 0.5 }}>{active ? (summarySort.dir === 'asc' ? '▲' : '▼') : '⇅'}</span>}
                            </span>
                          )
                        })}
                      </div>

                      {/* ── Lignes ── */}
                      {visibleEmps.map((e) => {
                        const s = displayCounts(e)
                        const empMeals = monthMeals
                          .filter(m => m.employee_id === e.id)
                          .sort((a,b) => a.date.localeCompare(b.date))
                        return (
                          <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '180px 72px 72px 72px 1fr', gap: 12, alignItems: 'center', padding: '14px 12px', borderBottom: '1px solid var(--border)', transition: 'background .15s', minWidth: 560 }}
                            className="acm-summary-row">
                            {/* Nom */}
                            <div>
                              <span style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--text)' }}>{e.nom} {e.prenom}</span>
                              {e.grand_deplacement && (
                                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3, fontWeight: 500 }}>Grand déplacement — non comptabilisé</div>
                              )}
                            </div>
                            {/* Compteurs */}
                            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#0c1524' }}>{s.paye}</span>
                            <span style={{ textAlign: 'center', fontWeight: 700, fontSize: 15, color: '#0c1524' }}>{s.invite}</span>
                            <span style={{ textAlign: 'center', fontWeight: 800, fontSize: 17, color: '#0c1524' }}>{s.paye+s.invite}</span>
                            {/* Chips repas */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {empMeals.map(m => {
                                const fmtDate = m.date ? new Date(m.date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}) : ''
                                const fmtOrigDate = m.original_date ? new Date(m.original_date+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}) : null
                                const chipColor = isCantine(m.count_color) ? '#7030a0' : (m.count_color || '#a8e6a3')
                                const bg = impColorLight(chipColor)
                                const hasDateChange = !!fmtOrigDate
                                // Build prefix for non-paye meals
                                let prefix = ''
                                if (isCantine(m.count_color)) { prefix = 'Cantine le ' }
                                else if (m.type === 'invite') {
                                  if (m.invited_by) { const inv = employees.find(e => e.id === m.invited_by); prefix = inv ? `invité par ${inv.prenom} ${inv.nom} le ` : 'invité le ' }
                                  else { prefix = 'invité le ' }
                                }
                                return (
                                  <div key={m.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 8px 4px 9px', borderRadius: 7, fontSize: 12, background: bg, border: hasDateChange ? '1.5px solid rgba(229,62,62,0.4)' : '1px solid rgba(0,0,0,.07)', color: '#1a1a1a' }}>
                                    {hasDateChange ? (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                                        {prefix && <span style={{ fontSize: 11.5, fontWeight: 500 }}>{prefix}</span>}
                                        <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text2)', textDecoration: 'line-through', textDecorationColor: '#e53e3e', textDecorationThickness: '2px', opacity: 0.75 }}>{fmtOrigDate}</span>
                                        <span style={{ fontSize: 11.5, fontWeight: 700, color: '#e53e3e', background: 'rgba(229,62,62,0.08)', borderRadius: 4, padding: '0 4px' }}>{fmtDate}</span>
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11.5, color: 'var(--text)', fontWeight: 500 }}>{prefix}{fmtDate}</span>
                                    )}
                                    <button onClick={() => { setEditMeal(m); setEditMealOriginalDate(m.date) }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', opacity: 0.4, fontSize: 12, lineHeight: 1, transition: 'opacity .1s' }} onMouseEnter={ev => ev.currentTarget.style.opacity='1'} onMouseLeave={ev => ev.currentTarget.style.opacity='.4'} title="Modifier">✎</button>
                                    <button onClick={() => setConfirmDelMeal(m)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px', opacity: 0.35, color: 'var(--red)', fontSize: 12, lineHeight: 1, transition: 'opacity .1s' }} onMouseEnter={ev => ev.currentTarget.style.opacity='1'} onMouseLeave={ev => ev.currentTarget.style.opacity='.35'} title="Supprimer">×</button>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {/* ── Ligne totaux ── */}
                      {visibleEmps.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: '180px 72px 72px 72px 1fr', gap: 12, alignItems: 'center', padding: '12px 12px', borderTop: '2px solid var(--primary)', background: 'var(--primary-light)', borderRadius: '0 0 12px 12px', minWidth: 560 }}>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>Total</span>
                          <span style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{totalPaye}</span>
                          <span style={{ textAlign: 'center', fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>{totalInvite}</span>
                          <span style={{ textAlign: 'center', fontWeight: 900, fontSize: 18, color: 'var(--primary)' }}>{totalPaye+totalInvite}</span>
                        </div>
                      )}
                      </div>{/* end acm-monthly-table */}
                    </div>
                  )
                })()}
              </div>
            )}

            {tab === 'export' && (() => {
              // ── helpers ──────────────────────────────────────────────
              const fmtDM = (d: string) => new Date(d+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})

              // Retourne les segments texte d'un repas pour le commentaire export
              // Chaque segment : { text, isStrike, isRed }
              type CommentSegment = { text: string; isStrike?: boolean; isRed?: boolean }

              const buildMealSegments = (m: Meal): CommentSegment[] => {
                const day     = fmtDM(m.date)
                const origDay = m.original_date ? fmtDM(m.original_date) : null
                let prefix = ''
                if (isCantine(m.count_color))        prefix = 'Cantine le '
                else if (m.type === 'invite') {
                  if (m.invited_by) {
                    const inv = employees.find(e => e.id === m.invited_by)
                    prefix = inv ? `invité par ${inv.prenom} ${inv.nom} le ` : 'invité le '
                  } else { prefix = 'invité le ' }
                }
                if (origDay) {
                  // Date modifiée → [prefix] [ancienne barrée] [ → ] [nouvelle rouge]
                  const segs: CommentSegment[] = []
                  if (prefix) segs.push({ text: prefix })
                  segs.push({ text: origDay, isStrike: true })
                  segs.push({ text: '→' })
                  segs.push({ text: day, isRed: true })
                  return segs
                }
                return [{ text: `${prefix}${day}` }]
              }

              // Pour CSV : texte brut avec notation "ancienne→nouvelle*"
              const buildCommentText = (empId: string, ms: Meal[]): string => {
                const empMs = ms.filter(m => m.employee_id === empId)
                  .sort((a,b) => {
                    // Payés d'abord, puis invités
                    if (a.type !== b.type) return a.type === 'paye' ? -1 : 1
                    return a.date.localeCompare(b.date)
                  })
                return empMs.map(m => {
                  const segs = buildMealSegments(m)
                  return segs.map(s => {
                    if (s.isStrike) return `~~${s.text}~~`
                    if (s.isRed)   return `${s.text}*`
                    return s.text
                  }).join(' ')
                }).join(', ')
              }

              // Pour Excel : tableau de segments rich-text par employé
              const buildCommentRich = (empId: string, ms: Meal[]): CommentSegment[] => {
                const empMs = ms.filter(m => m.employee_id === empId)
                  .sort((a,b) => {
                    if (a.type !== b.type) return a.type === 'paye' ? -1 : 1
                    return a.date.localeCompare(b.date)
                  })
                const result: CommentSegment[] = []
                empMs.forEach((m, i) => {
                  if (i > 0) result.push({ text: ', ' })
                  result.push(...buildMealSegments(m))
                })
                return result
              }

              // Garde buildComment pour la prévisualisation
              const buildComment = (empId: string, ms: Meal[]): string => buildCommentText(empId, ms)

              const exportMeals = meals.filter(m => {
                const target = m.target_month ? m.target_month.slice(0,7) : m.date.slice(0,7)
                return target === `${exportYear}-${String(exportMonth+1).padStart(2,'0')}`
              })

              const empWithMeals = employees.filter(e => exportMeals.some(m => m.employee_id === e.id))
                .sort((a,b) => a.nom.localeCompare(b.nom))

              const rows = empWithMeals.map(e => {
                const payeRaw = exportMeals.filter(m => m.employee_id === e.id && m.type === 'paye').length
                const inviteRaw = exportMeals.filter(m => m.employee_id === e.id && m.type === 'invite').length
                const gd = !!e.grand_deplacement
                const paye = gd ? 0 : payeRaw
                const invite = gd ? 0 : inviteRaw
                const ms = exportMeals.filter(m => m.employee_id === e.id)
                const countColor = ms.length > 0 ? (ms[0].count_color || '#a8e6a3') : '#a8e6a3'
                return {
                  emp: e,
                  paye,
                  invite,
                  total: paye + invite,
                  comment: buildCommentText(e.id, exportMeals),
                  commentRich: buildCommentRich(e.id, exportMeals),
                  countColor,
                }
              })

              const monthLabel = `${MONTHS[exportMonth]} ${exportYear}`

              async function doExcelExport() {
                // xlsx-js-style avec rich text inlineStr (format SheetJS rPr direct)
                const XLSX = await import('xlsx-js-style')

                const TEXT_COLORS: Record<string, string> = {
                  '#a8e6a3': 'FF000000',
                  '#a3d4f5': 'FF00B0F0',
                  '#fde89a': 'FF1ACC1E',
                  '#7030a0': 'FF7030A0',
                  '#f5b8c8': 'FF7030A0',
                }

                const HEADER_STYLE = {
                  font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
                  fill: { fgColor: { rgb: '3282DE' }, patternType: 'solid' },
                  alignment: { horizontal: 'center', vertical: 'center' },
                  border: { bottom: { style: 'thin', color: { rgb: '1A5FB8' } } }
                }

                const headerRow = ['Nom','Prénom','Repas payés','Repas invité','Total','Commentaires']
                  .map(h => ({ v: h, t: 's', s: HEADER_STYLE }))

                /** Nom / prénom toujours en noir ; couleurs repas uniquement sur compteurs + commentaires */
                const NAME_CELL_STYLE = {
                  font: { color: { rgb: '000000' }, sz: 10 },
                  alignment: { vertical: 'center', wrapText: false },
                }

                const dataRows = rows.map(r => {
                  const argbFull = TEXT_COLORS[r.countColor] || 'FF000000'
                  const rgb      = argbFull.replace('FF', '')
                  const cellStyle = (bold = false) => ({
                    font: { color: { rgb }, bold, sz: 10 },
                    alignment: { vertical: 'center', wrapText: false }
                  })

                  // xlsx-js-style ne supporte pas le rich text intra-cellule à l'écriture.
                  // Solution : texte clair "ancienne → nouvelle" + cellule entière en rouge
                  // pour les lignes avec date modifiée.
                  // Texte plain pour la construction initiale du sheet
                  const commentPlain = r.commentRich.map(seg =>
                    seg.isStrike ? `(${seg.text})` : seg.text
                  ).join('')

                  return [
                    { v: r.emp.nom,    t: 's' as const, s: NAME_CELL_STYLE },
                    { v: r.emp.prenom, t: 's' as const, s: NAME_CELL_STYLE },
                    { v: r.paye,       t: 'n' as const, s: cellStyle() },
                    { v: r.invite,     t: 'n' as const, s: cellStyle() },
                    { v: r.total,      t: 'n' as const, s: cellStyle(true) },
                    { v: commentPlain, t: 's' as const, s: cellStyle() },
                  ]
                })

                const ws = XLSX.utils.aoa_to_sheet([headerRow, ...dataRows])

                // Cellules commentaire modifiées : texte en rouge (toute la cellule)
                rows.forEach((r, rowIdx) => {
                  const hasDateMod = r.commentRich.some(s => s.isStrike || s.isRed)
                  if (!hasDateMod) return
                  const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 1, c: 5 })
                  ws[cellRef] = {
                    ...ws[cellRef],
                    s: {
                      font:      { color: { rgb: 'CC0000' }, sz: 10 },
                      alignment: { vertical: 'center', wrapText: false }
                    }
                  }
                })
                ws['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 80 }]
                ws['!rows'] = [{ hpt: 20 }, ...dataRows.map(() => ({ hpt: 16 }))]
                const wb = XLSX.utils.book_new()
                XLSX.utils.book_append_sheet(wb, ws, monthLabel)
                XLSX.writeFile(wb, `repas_${exportYear}_${String(exportMonth+1).padStart(2,'0')}.xlsx`)
              }

              function doCSVExport() {
                const hasAnyMod = rows.some(r => r.commentRich.some(s => s.isStrike || s.isRed))
                const header = ['Nom','Prénom','Repas payés','Repas invité','Total','Commentaires']
                const dataLines = rows.map(r => [r.emp.nom, r.emp.prenom, r.paye, r.invite, r.total, r.comment])
                const legend: (string | number)[][] = hasAnyMod
                  ? [[], ['Légende dates modifiées :', '~~ancienne~~ = date supprimée (barrée)', 'ancienne→nouvelle* = date modifiée (* = nouvelle date, rouge dans Excel)']]
                  : []
                const lines = [header, ...dataLines, ...legend]
                const csv = lines.map(l => l.map(c => `"${String(c).replace(/"/g,'""')}`).join(';')).join('\n')
                const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = `repas_${exportYear}_${String(exportMonth+1).padStart(2,'0')}.csv`
                a.click(); URL.revokeObjectURL(url)
              }

              return (
                <div style={{ display: 'grid', gap: 20 }}>
                  <div>
                    <h1 style={S.pageTitle}>Export</h1>
                    <p style={S.pageSub}>Exportez les repas par mois de rattachement</p>
                  </div>

                  {/* ── Sélecteur mois ── */}
                  <div style={S.card} className="acm-card-mobile">
                    <span style={S.cardTitle}>Mois à exporter</span>
                    <div className="acm-export-selectors" style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                      <div>
                        <label style={S.label}>Mois</label>
                        <select style={{ ...S.input, width: 160 }} value={exportMonth} onChange={e => setExportMonth(Number(e.target.value))}>
                          {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={S.label}>Année</label>
                        <select style={{ ...S.input, width: 110 }} value={exportYear} onChange={e => setExportYear(Number(e.target.value))}>
                          {[2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                      </div>
                      <div className="acm-export-buttons" style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                        <button className="acm-btn-primary" style={{ ...S.btnPrimary, display: 'flex', alignItems: 'center', gap: 7 }}
                          onClick={doExcelExport} disabled={rows.length === 0}>
                          ⬇ Excel (.xlsx)
                        </button>
                        <button style={{ ...S.btnGhost, display: 'flex', alignItems: 'center', gap: 7 }}
                          onClick={doCSVExport} disabled={rows.length === 0}>
                          ⬇ CSV / Google Sheets
                        </button>
                      </div>
                    </div>
                    {rows.length === 0 && (
                      <div style={{ ...S.emptyState, marginTop: 16 }}>Aucun repas pour {monthLabel}.</div>
                    )}
                  </div>

                  {/* ── Prévisualisation ── */}
                  {rows.length > 0 && (
                    <div style={S.card} className="acm-card-mobile">
                      <div style={{ ...S.cardHeader, marginBottom: 12 }}>
                        <span style={S.cardTitle}>Aperçu — {monthLabel}</span>
                        <span style={{ fontSize: 12, color: 'var(--text3)' }}>{rows.length} salarié{rows.length > 1 ? 's' : ''} · {exportMeals.length} repas</span>
                      </div>
                      {/* header */}
                      <div className="acm-export-table">
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 90px 90px 60px 1fr', gap: 10, padding: '8px 12px 10px', borderBottom: '1.5px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: 'var(--primary)', minWidth: 620 }}>
                        <span>Nom</span><span>Prénom</span>
                        <span style={{ textAlign:'center' }}>Payés</span>
                        <span style={{ textAlign:'center' }}>Invités</span>
                        <span style={{ textAlign:'center' }}>Total</span>
                        <span>Commentaires</span>
                      </div>
                      {rows.map(r => (
                        <div key={r.emp.id} style={{ display: 'grid', gridTemplateColumns: '160px 120px 90px 90px 60px 1fr', gap: 10, alignItems: 'center', padding: '12px 12px', borderBottom: '1px solid var(--border)', minWidth: 620 }}
                          className="acm-summary-row">
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{r.emp.nom}</span>
                          <span style={{ fontSize: 13 }}>{r.emp.prenom}</span>
                          <span style={{ textAlign:'center', fontWeight: 700, fontSize: 14 }}>{r.paye}</span>
                          <span style={{ textAlign:'center', fontWeight: 700, fontSize: 14 }}>{r.invite}</span>
                          <span style={{ textAlign:'center', fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{r.total}</span>
                          <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                            {r.commentRich.map((seg, i) =>
                              seg.isStrike ? (
                                <span key={i} style={{ textDecoration: 'line-through', textDecorationColor: '#e53e3e', textDecorationThickness: '2px', color: '#999', opacity: 0.8 }}>{seg.text}</span>
                              ) : seg.isRed ? (
                                <span key={i} style={{ color: '#e53e3e', fontWeight: 700 }}>{seg.text}</span>
                              ) : (
                                <span key={i}>{seg.text}</span>
                              )
                            )}
                          </span>
                        </div>
                      ))}
                      {/* totaux */}
                      <div style={{ display: 'grid', gridTemplateColumns: '160px 120px 90px 90px 60px 1fr', gap: 10, alignItems: 'center', padding: '12px 12px', borderTop: '2px solid var(--primary)', background: 'var(--primary-light)', borderRadius: '0 0 12px 12px', minWidth: 620 }}>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 12, textTransform: 'uppercase' as const, letterSpacing: '.05em', gridColumn: '1/3' }}>Total</span>
                        <span style={{ textAlign:'center', fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{rows.reduce((a,r)=>a+r.paye,0)}</span>
                        <span style={{ textAlign:'center', fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>{rows.reduce((a,r)=>a+r.invite,0)}</span>
                        <span style={{ textAlign:'center', fontWeight: 900, fontSize: 17, color: 'var(--primary)' }}>{rows.reduce((a,r)=>a+r.total,0)}</span>
                        <span />
                      </div>
                      </div>{/* end acm-export-table */}
                    </div>
                  )}
                </div>
              )
            })()}

            {tab === 'salaries' && (
              <div style={{ display: 'grid', gap: 20 }}>
                <div>
                  <h1 style={S.pageTitle}>Salariés</h1>
                  <p style={S.pageSub}>Gérez les collaborateurs actifs</p>
                </div>
                <div style={S.card} className="acm-card-mobile">
                  <div style={S.cardTitle}>{editEmp ? 'Modifier le salarié' : 'Nouveau salarié'}</div>
                  <div className="acm-emp-form">
                    <div><label style={S.label}>Nom</label><input style={S.input} placeholder="Nom" value={eForm.nom} onChange={e => setEForm(f => ({ ...f, nom: e.target.value }))} /></div>
                    <div><label style={S.label}>Prénom</label><input style={S.input} placeholder="Prénom" value={eForm.prenom} onChange={e => setEForm(f => ({ ...f, prenom: e.target.value }))} /></div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label htmlFor="emp-grand-deplacement" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--text)' }}>
                        <input
                          id="emp-grand-deplacement"
                          type="checkbox"
                          checked={!!eForm.grand_deplacement}
                          onChange={ev => setEForm(f => ({ ...f, grand_deplacement: ev.target.checked }))}
                        />
                        Grand déplacement
                      </label>
                      <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, marginBottom: 0, lineHeight: 1.45 }}>
                        Les repas restent visibles (commentaires, dates) mais ne comptent pas dans les totaux (vue mensuelle, export). Désactivé par défaut.
                      </p>
                    </div>
                    <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button className="acm-btn-primary" style={S.btnPrimary} onClick={saveEmployee} disabled={!eForm.nom || !eForm.prenom}>{editEmp ? 'Enregistrer' : '+ Ajouter'}</button>
                      {editEmp && <button style={S.btnGhost} onClick={() => { setEditEmp(null); setEForm({ nom: '', prenom: '', grand_deplacement: false }) }}>Annuler</button>}
                    </div>
                  </div>
                </div>
                <div style={S.card} className="acm-card-mobile">
                  <div style={{ ...S.cardHeader, marginBottom: 16 }}>
                    <span style={S.cardTitle}>{employees.length} salarié{employees.length !== 1 ? 's' : ''}</span>
                    <div style={{ maxWidth: 260, flex: 1 }}>
                      <SearchInput value={empSearch} onChange={setEmpSearch} />
                    </div>
                  </div>
                  {filteredEmpForAdmin.map((e, i) => (
                    <div key={e.id} className="acm-emp-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div>
                        <div style={{ fontWeight: 500, color: 'var(--text)' }}>
                          {e.nom} {e.prenom}
                          {e.grand_deplacement && (
                            <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 600, color: 'var(--primary)', background: 'var(--primary-light)', padding: '2px 6px', borderRadius: 4, verticalAlign: 'middle' }}>Grand déplacement</span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{meals.filter(m => m.employee_id === e.id).length} repas enregistrés</div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          style={S.btnOutline}
                          onClick={() => {
                            setEditEmp(e)
                            setEForm({ nom: e.nom, prenom: e.prenom, grand_deplacement: !!e.grand_deplacement })
                            window.scrollTo({ top: 0, behavior: 'auto' })
                          }}
                        >
                          Modifier
                        </button>
                        <button style={S.btnDanger} onClick={() => setConfirmDelEmp(e)}>Supprimer</button>
                      </div>
                    </div>
                  ))}
                  {filteredEmpForAdmin.length === 0 && <div style={S.emptyState}>Aucun résultat pour "{empSearch}"</div>}
                </div>
              </div>
            )}

            {tab === 'profil' && (
              <div style={{ display: 'grid', gap: 20, maxWidth: 520 }}>
                <div>
                  <h1 style={S.pageTitle}>Mon profil</h1>
                  <p style={S.pageSub}>Gérez vos informations personnelles</p>
                </div>
                <div style={S.card} className="acm-card-mobile">
                  {/* Avatar */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28, gap: 10 }}>
                    <div
                      style={{ width: 88, height: 88, borderRadius: '50%', background: profile.avatar ? 'transparent' : 'linear-gradient(135deg,#3282DE,#9AC00C)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', border: '3px solid var(--border)', cursor: 'pointer', position: 'relative' }}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {profile.avatar
                        ? <img src={profile.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        : <span style={{ color: 'white', fontSize: 32, fontWeight: 700 }}>{(profile.prenom?.[0] || profile.email?.[0] || '?').toUpperCase()}</span>
                      }
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cliquez sur la photo pour changer</span>
                  </div>

                  {/* Email */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={S.label}>Email</label>
                    <input
                      type="email"
                      style={S.input}
                      placeholder="vous@exemple.fr"
                      value={profile.email}
                      onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
                    />
                  </div>

                  {/* Prénom + Nom */}
                  <div className="acm-grid2" style={{ marginBottom: 16 }}>
                    {[{ label: 'Prénom', key: 'prenom', placeholder: 'Jean' }, { label: 'Nom', key: 'nom', placeholder: 'DUPONT' }].map(f => (
                      <div key={f.key}>
                        <label style={S.label}>{f.label}</label>
                        <input
                          style={S.input}
                          placeholder={f.placeholder}
                          value={profile[f.key as keyof typeof profile]}
                          onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Poste */}
                  <div style={{ marginBottom: 24 }}>
                    <label style={S.label}>Poste</label>
                    <input
                      style={S.input}
                      placeholder="Assistant administratif et financier"
                      value={profile.poste}
                      onChange={e => setProfile(p => ({ ...p, poste: e.target.value }))}
                    />
                  </div>

                  <button
                    onClick={saveProfile}
                    disabled={profileSaving}
                    style={{ padding: '12px 28px', background: profileSaved ? '#059669' : 'linear-gradient(135deg,#3282DE,#2670c7)', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', transition: 'all .2s ease', boxShadow: '0 4px 14px rgba(50,130,222,0.25)' }}
                  >
                    {profileSaving ? 'Enregistrement...' : profileSaved ? '✓ Profil sauvegardé' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
      </div>{/* end acm-main-wrapper */}

      {/* ── Bottom nav (mobile only) ── */}
      <nav className="acm-bottom-nav">
        {([
          { key: 'saisie',   icon: '✎', label: 'Saisie' },
          { key: 'mensuel',  icon: '◫', label: 'Mensuel' },
          { key: 'export',   icon: '⬇', label: 'Export' },
          { key: 'salaries', icon: '☰', label: 'Salariés' },
        ] as { key: Tab; icon: string; label: string }[]).map(item => (
          <button key={item.key} className={`acm-bottom-nav-item${tab === item.key ? ' active' : ''}`} onClick={() => setTab(item.key)}>
            <span className="bnav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        input[type=date]::-webkit-calendar-picker-indicator { opacity: 0.45; cursor: pointer; }
        button:disabled { opacity: 0.4; cursor: not-allowed; }
        select { appearance: auto; }
        .acm-tr { transition: background 200ms ease; }
        .acm-tr:hover { background: #F9FBFF !important; }
        .acm-summary-row { transition: background 200ms ease; }
        .acm-summary-row:hover { background: #F9FBFF !important; }
        input:hover:not(:focus) { border-color: #CBD5E1 !important; }
        .acm-btn-primary { background: linear-gradient(135deg, #3282DE 0%, #5AA7FF 100%) !important; box-shadow: 0 4px 14px rgba(50,130,222,0.25) !important; transition: all 0.2s ease !important; }
        .acm-btn-primary:hover:not(:disabled) { transform: translateY(-1px) !important; box-shadow: 0 10px 25px rgba(50,130,222,0.35) !important; filter: brightness(1.05); }
        .acm-btn-primary:active:not(:disabled) { transform: translateY(0) !important; box-shadow: 0 2px 8px rgba(50,130,222,0.25) !important; }
        .acm-btn-ghost:hover:not(:disabled) { background: #F8FAFC !important; border-color: #CBD5E1 !important; color: var(--text) !important; }
        .acm-btn-danger:hover:not(:disabled) { background: #fee2e2 !important; border-color: #fca5a5 !important; }
        .acm-btn-outline:hover { background: var(--primary-light) !important; border-color: var(--primary) !important; }
        .acm-icon-btn:hover { background: #F1F5FF !important; color: var(--primary) !important; }
        button.acm-nav-btn:hover { background: var(--primary-light) !important; border-color: var(--primary) !important; }
        button, a, input, select { transition: all 0.2s ease; }
        @media (max-width: 640px) {
          .acm-topbar-breadcrumb { display: none !important; }
          .acm-month-header { flex-direction: column !important; align-items: flex-start !important; gap: 10px !important; }
          .acm-month-controls { flex-wrap: wrap !important; gap: 8px !important; width: 100% !important; }
          .acm-delete-month-btn { width: 100% !important; justify-content: center !important; }
          .acm-export-selectors { flex-direction: column !important; align-items: stretch !important; }
          .acm-export-selectors > div { width: 100% !important; }
          .acm-export-selectors select { width: 100% !important; }
          .acm-export-buttons { flex-direction: column !important; width: 100% !important; }
          .acm-export-buttons button { width: 100% !important; justify-content: center !important; }
          .acm-modal-mobile { width: 92vw !important; padding: 20px 16px 18px !important; }
          .acm-monthly-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .acm-export-table { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .acm-emp-row { flex-wrap: wrap !important; gap: 10px !important; }
          .acm-emp-row > div:first-child { flex: 1 1 100%; }
        }
      `}</style>
    </div>
  )
}

function MealRow({ meal, empName, onEdit, onDelete }: { meal: Meal; empName: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <div style={S.tableRow} className="acm-tr">
      <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDateShort(meal.date)}</span>
      <span style={{ fontWeight: 500, fontSize: 13, minWidth: 0, lineHeight: 1.35 }}>{empName}</span>
      <span style={{ ...(meal.type === 'paye' ? S.badgePaye : S.badgeInvite), justifySelf: 'center' }}>{meal.type === 'paye' ? 'Payé' : 'Invité'}</span>
      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
        <button style={S.iconBtn} title="Modifier" onClick={onEdit}>✎</button>
        <button style={{ ...S.iconBtn, color: 'var(--red)' }} title="Supprimer" onClick={onDelete}>✕</button>
      </div>
    </div>
  )
}

function StatBox({ num, label, color, big }: { num: number; label: string; color: string; big?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: big ? 26 : 20, fontWeight: 700, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{label}</div>
    </div>
  )
}

const S = {
  // ── Cards ──
  card: { background: '#FFFFFF', border: '1px solid rgba(226,232,240,0.7)', borderRadius: 14, padding: '28px', boxShadow: '0 15px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.03)' } as React.CSSProperties,
  cardSecondary: { background: '#FCFDFF', border: '1px solid rgba(226,232,240,0.6)', borderRadius: 14, padding: '28px', boxShadow: '0 4px 16px rgba(0,0,0,0.04)' } as React.CSSProperties,
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, gap: 12 } as React.CSSProperties,
  cardTitle: { fontWeight: 600, fontSize: 15.5, color: 'var(--text)', letterSpacing: '-.02em' } as React.CSSProperties,
  pageTitle: { fontWeight: 600, fontSize: 24, color: '#0F172A', letterSpacing: '-.03em', lineHeight: 1.3, borderLeft: '4px solid #3282DE', paddingLeft: 14 } as React.CSSProperties,
  pageSub: { fontSize: 14, color: '#64748B', marginTop: 6, fontWeight: 400, paddingLeft: 18 } as React.CSSProperties,
  // ── Form ──
  label: { display: 'flex', alignItems: 'flex-end', minHeight: 20, fontSize: 12, fontWeight: 600, color: 'var(--text2)', letterSpacing: '.03em', marginBottom: 7, textTransform: 'uppercase' as const } as React.CSSProperties,
  input: { width: '100%', background: '#ffffff', border: '1px solid var(--border2)', borderRadius: 10, padding: '10px 14px', fontSize: 13.5, color: 'var(--text)', outline: 'none', transition: 'border-color .15s, box-shadow .15s', height: 42, boxShadow: 'none' } as React.CSSProperties,
  // ── Buttons ──
  btnPrimary: { background: 'linear-gradient(135deg, #3282DE 0%, #5AA7FF 100%)', color: '#fff', border: 'none', borderRadius: 10, padding: '0 22px', fontWeight: 600, fontSize: 13.5, cursor: 'pointer', transition: 'all 0.2s ease', whiteSpace: 'nowrap', height: 42, display: 'inline-flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(50,130,222,0.25)' } as React.CSSProperties,
  btnGhost: { background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border2)', borderRadius: 10, padding: '0 18px', fontWeight: 500, fontSize: 13, cursor: 'pointer', transition: 'all .15s', height: 38, display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
  btnOutline: { background: 'transparent', color: 'var(--primary)', border: '1.5px solid var(--primary)', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', height: 36, display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
  btnDanger: { background: 'var(--red-light)', color: 'var(--red)', border: '1px solid #fecaca', borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all .15s', height: 36, display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
  iconBtn: { background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '5px 7px', fontSize: 14, borderRadius: 7, transition: 'color .1s, background .1s', display: 'inline-flex', alignItems: 'center' } as React.CSSProperties,
  navBtn: { background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--primary)', borderRadius: 10, width: 36, height: 36, cursor: 'pointer', fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s' } as React.CSSProperties,
  // ── Badges ──
  badge: { background: 'var(--primary-light)', color: 'var(--primary)', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, border: '1px solid rgba(50,130,222,0.15)' } as React.CSSProperties,
  badgePaye: { display: 'inline-flex', alignItems: 'center', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'rgba(34,197,94,0.1)', color: '#15803d', border: '1px solid rgba(34,197,94,0.2)' } as React.CSSProperties,
  badgeInvite: { display: 'inline-flex', alignItems: 'center', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600, background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid rgba(50,130,222,0.15)' } as React.CSSProperties,
  // ── Tables ──
  tableWrap: { } as React.CSSProperties,
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '64px minmax(0, 1fr) 92px 64px',
    gap: 8,
    alignItems: 'center',
    padding: '10px 14px 12px',
    borderBottom: '1px solid var(--border)',
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--text3)',
    textTransform: 'uppercase',
    letterSpacing: '.08em',
    minWidth: 320,
  } as React.CSSProperties,
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '64px minmax(0, 1fr) 92px 64px',
    gap: 8,
    alignItems: 'center',
    padding: '13px 14px',
    borderBottom: '1px solid var(--border)',
    transition: 'background .1s',
    minWidth: 320,
  } as React.CSSProperties,
  summaryCard: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', boxShadow: 'var(--shadow)', borderLeft: '3px solid var(--secondary)' } as React.CSSProperties,
  summaryHead: { display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12, padding: '8px 16px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.06em', color: 'var(--text3)' } as React.CSSProperties,
  summaryRow: { display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px', gap: 12, alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--border)', transition: 'background .15s' } as React.CSSProperties,
  emptyState: { textAlign: 'center', padding: '52px 0', color: 'var(--text3)', fontSize: 13 } as React.CSSProperties,
  // ── Modals ──
  overlay: { position: 'fixed', inset: 0, background: 'rgba(8,15,35,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(10px)' } as React.CSSProperties,
  modal: { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: '30px 30px 26px', width: 500, maxWidth: '95vw', boxShadow: '0 24px 64px rgba(0,0,0,.16), 0 0 0 1px var(--border)' } as React.CSSProperties,
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, paddingBottom: 18, borderBottom: '1px solid var(--border)' } as React.CSSProperties,
  modalTitle: { fontWeight: 700, fontSize: 15.5, color: 'var(--text)', letterSpacing: '-.015em' } as React.CSSProperties,
  closeBtn: { background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--text2)', cursor: 'pointer', fontSize: 13, padding: '5px 10px', borderRadius: 7, lineHeight: 1, fontWeight: 600, transition: 'all .15s' } as React.CSSProperties,
  // ── Color picker ──
  colorTrigger: { display: 'flex', alignItems: 'center', gap: 8, background: '#ffffff', border: '1px solid var(--border2)', borderRadius: 10, padding: '9px 13px', cursor: 'pointer', color: 'var(--text)', width: '100%', height: 42, transition: 'border-color .15s', boxShadow: 'none' } as React.CSSProperties,
  colorPanel: { position: 'absolute', top: '100%', left: 0, zIndex: 200, marginTop: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, boxShadow: 'var(--shadow-md)', width: 240, minWidth: 210 } as React.CSSProperties,
}
