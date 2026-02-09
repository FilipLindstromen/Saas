import type { AspectRatio, QualityPreset, ResolutionOption } from '../types'
import { ASPECT_RATIOS, QUALITY_OPTIONS } from '../constants'
import styles from './OptionsBar.module.css'

interface OptionsBarProps {
  aspectRatio: AspectRatio
  onAspectRatioChange: (a: AspectRatio) => void
  resolutions: ResolutionOption[]
  resolutionIndex: number
  onResolutionIndexChange: (i: number) => void
  quality: QualityPreset
  onQualityChange: (q: QualityPreset) => void
  studioQuality: boolean
  onStudioQualityChange: (v: boolean) => void
}

export function OptionsBar({
  aspectRatio,
  onAspectRatioChange,
  resolutions,
  resolutionIndex,
  onResolutionIndexChange,
  quality,
  onQualityChange,
  studioQuality,
  onStudioQualityChange,
}: OptionsBarProps) {

  return (
    <div className={styles.wrap}>
      <div className={styles.group}>
        <span className={styles.groupLabel}>Aspect ratio</span>
        <select
          className={styles.select}
          value={aspectRatio}
          onChange={(e) => onAspectRatioChange(e.target.value as AspectRatio)}
        >
          {ASPECT_RATIOS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </div>
      <div className={styles.group}>
        <span className={styles.groupLabel}>Resolution</span>
        <select
          className={styles.select}
          value={resolutionIndex}
          onChange={(e) => onResolutionIndexChange(Number(e.target.value))}
        >
          {resolutions.map((r, i) => (
            <option key={r.label} value={i}>
              {r.label} ({r.width}×{r.height})
            </option>
          ))}
        </select>
      </div>
      <div className={styles.group}>
        <span className={styles.groupLabel}>Quality</span>
        <select
          className={styles.select}
          value={quality}
          onChange={(e) => onQualityChange(e.target.value as QualityPreset)}
        >
          {QUALITY_OPTIONS.map((q) => (
            <option key={q.value} value={q.value}>{q.label}</option>
          ))}
        </select>
      </div>
      <label className={styles.studioLabel}>
        <input
          type="checkbox"
          checked={studioQuality}
          onChange={(e) => onStudioQualityChange(e.target.checked)}
          title="Remove noise and polish audio (high-pass, noise gate, compressor)"
        />
        <span>Studio quality audio</span>
      </label>
    </div>
  )
}
