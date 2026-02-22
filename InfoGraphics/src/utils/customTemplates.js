const STORAGE_KEY = 'infographicsCustomTemplates'

export function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    }
  } catch (e) {
    console.error('Error loading custom templates:', e)
  }
  return []
}

export function saveCustomTemplates(templates) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
}

export function saveCustomTemplate({ id, name, elements }) {
  const templates = loadCustomTemplates()
  const normalized = elements.map((e, i) => {
    const { id: _id, ...rest } = e
    return { ...rest, id: i + 1, zIndex: rest.zIndex ?? i }
  })
  const entry = { id: id || `custom_${Date.now()}`, name, elements: normalized, updatedAt: Date.now() }
  const existing = templates.findIndex(t => t.id === entry.id)
  let next
  if (existing >= 0) {
    next = [...templates]
    next[existing] = entry
  } else {
    next = [...templates, entry]
  }
  saveCustomTemplates(next)
  return entry.id
}

export function deleteCustomTemplate(id) {
  const templates = loadCustomTemplates().filter(t => t.id !== id)
  saveCustomTemplates(templates)
}

export function getCustomTemplate(id) {
  return loadCustomTemplates().find(t => t.id === id)
}

export function updateCustomTemplateName(id, name) {
  const template = getCustomTemplate(id)
  if (!template) return
  saveCustomTemplate({ id, name: name.trim(), elements: template.elements })
}
