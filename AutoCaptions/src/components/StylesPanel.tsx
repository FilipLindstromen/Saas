import type { CaptionStyle, CaptionAnimation } from '../types'
import { CAPTION_STYLES, CAPTION_ANIMATIONS, GOOGLE_FONTS, FONT_SIZE_MIN, FONT_SIZE_MAX, FONT_SIZE_DEFAULT } from '../constants'
import styles from './StylesPanel.module.css'

interface StylesPanelProps {
  captionStyle: CaptionStyle
  onCaptionStyleChange: (style: CaptionStyle) => void
  captionAnimation: CaptionAnimation
  onCaptionAnimationChange: (anim: CaptionAnimation) => void
  animateByWord: boolean
  onAnimateByWordChange: (value: boolean) => void
  fontFamily: string
  onFontFamilyChange: (font: string) => void
  fontSizePercent: number
  onFontSizeChange: (size: number) => void
  captionY: number
  onCaptionYChange: (y: number) => void
}

export function StylesPanel({
  captionStyle,
  onCaptionStyleChange,
  captionAnimation,
  onCaptionAnimationChange,
  animateByWord,
  onAnimateByWordChange,
  fontFamily,
  onFontFamilyChange,
  fontSizePercent,
  onFontSizeChange,
  captionY,
  onCaptionYChange,
}: StylesPanelProps) {
  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>Caption style</h2>
      <div className={styles.section}>
        <label className={styles.label}>Style</label>
        <select
          className={styles.select}
          value={captionStyle}
          onChange={(e) => onCaptionStyleChange(e.target.value as CaptionStyle)}
          aria-label="Caption style"
        >
          {CAPTION_STYLES.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>In/Out animation</label>
        <select
          className={styles.select}
          value={captionAnimation}
          onChange={(e) => onCaptionAnimationChange(e.target.value as CaptionAnimation)}
          aria-label="Caption animation"
        >
          {CAPTION_ANIMATIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={animateByWord}
            onChange={(e) => onAnimateByWordChange(e.target.checked)}
            aria-label="Animate by word"
          />
          Animate by word
        </label>
        <p className={styles.hint}>Apply in/out animation to each word (uses word timing from transcription).</p>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Font (Google Fonts)</label>
        <select
          className={styles.select}
          value={fontFamily}
          onChange={(e) => onFontFamilyChange(e.target.value)}
          aria-label="Font family"
        >
          {GOOGLE_FONTS.map((font) => (
            <option key={font} value={font}>{font}</option>
          ))}
        </select>
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Font size ({fontSizePercent.toFixed(1)}%)</label>
        <input
          type="range"
          className={styles.slider}
          min={FONT_SIZE_MIN}
          max={FONT_SIZE_MAX}
          step={0.1}
          value={fontSizePercent}
          onChange={(e) => onFontSizeChange(Number(e.target.value))}
          aria-label="Font size"
        />
      </div>

      <div className={styles.section}>
        <label className={styles.label}>Caption position (Y): {(captionY * 100).toFixed(0)}%</label>
        <input
          type="range"
          className={styles.slider}
          min={0.05}
          max={0.95}
          step={0.01}
          value={captionY}
          onChange={(e) => onCaptionYChange(Number(e.target.value))}
          aria-label="Caption vertical position"
        />
        <p className={styles.hint}>Or drag the orange bar on the video to position captions.</p>
      </div>
    </div>
  )
}
