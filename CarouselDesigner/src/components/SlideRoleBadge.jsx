import { getRoleMeta } from '../carousel/constants'
import './SlideRoleBadge.css'

export default function SlideRoleBadge({ role, onChange, editable = false, size = 'sm' }) {
  const meta = getRoleMeta(role)
  if (!role && !editable) return null

  if (editable && onChange) {
    return (
      <select
        className={`slide-role-badge slide-role-badge-${size} slide-role-select`}
        value={role || ''}
        onChange={(e) => onChange(e.target.value || null)}
        onClick={(e) => e.stopPropagation()}
        title="Slide role in carousel narrative"
      >
        <option value="">No role</option>
        {['hook', 'value', 'proof', 'story', 'tip', 'cta', 'transition'].map((id) => (
          <option key={id} value={id}>{getRoleMeta(id)?.label || id}</option>
        ))}
      </select>
    )
  }

  if (!meta) return null

  return (
    <span
      className={`slide-role-badge slide-role-badge-${size}`}
      style={{ '--role-color': meta.color }}
      title={meta.description}
    >
      {meta.label}
    </span>
  )
}
