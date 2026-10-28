import type { SearchSourceToggles } from '../types'
import './SourceToggles.css'

type Props = {
  toggles: SearchSourceToggles
  onChange: (toggles: SearchSourceToggles) => void
}

export default function SourceToggles({ toggles, onChange }: Props) {
  const set = (key: keyof SearchSourceToggles) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...toggles, [key]: e.target.checked })
  }

  return (
    <div className="source-toggles">
      <div className="source-toggles__group">
        <label><input type="checkbox" checked={toggles.pexels} onChange={set('pexels')} /> Pexels</label>
        <label><input type="checkbox" checked={toggles.pixabay} onChange={set('pixabay')} /> Pixabay</label>
        <label><input type="checkbox" checked={toggles.unsplash} onChange={set('unsplash')} /> Unsplash</label>
      </div>
      <div className="source-toggles__group">
        <label><input type="checkbox" checked={toggles.video} onChange={set('video')} /> Video</label>
        <label><input type="checkbox" checked={toggles.image} onChange={set('image')} /> Image</label>
      </div>
    </div>
  )
}
