/**
 * Load infographic projects from InfoGraphics generator (shared localStorage).
 * Uses the same keys as InfoGraphics/src/utils/projectStorage.js
 */
const PROJECTS_KEY = 'infographicsProjects'
const PROJECT_DATA_PREFIX = 'infographicsProject_'

export function getProjectStorageKey(id: string): string {
  return `${PROJECT_DATA_PREFIX}${id}`
}

export interface InfographicProjectMeta {
  id: string
  name: string
  updatedAt?: number
}

export interface InfographicProjectData {
  elements: Array<{
    id: string
    type: string
    x: number
    y: number
    width: number
    height: number
    rotation?: number
    text?: string
    imageUrl?: string
    fontSize?: number
    fontFamily?: string
    color?: string
    backgroundColor?: string
    arrowDirection?: string
    arrowStyle?: string
    imageTint?: string
    imageTintOpacity?: number
    animationIn?: string
    animationOut?: string
    gradientColor?: string
    clipStart?: number
    clipEnd?: number
    zIndex?: number
    visible?: boolean
  }>
  aspectRatio?: string
  resolution?: number
  backgroundColor?: string
  timelineDuration?: number
}

export function loadInfographicProjects(): InfographicProjectMeta[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY)
    if (raw) {
      const list = JSON.parse(raw)
      return Array.isArray(list) ? list : []
    }
  } catch (e) {
    console.error('Error loading infographic projects:', e)
  }
  return []
}

export function loadInfographicProjectData(id: string): InfographicProjectData | null {
  try {
    const raw = localStorage.getItem(getProjectStorageKey(id))
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.error('Error loading infographic project:', e)
  }
  return null
}
