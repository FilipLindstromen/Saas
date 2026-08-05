import { htmlToPlainText } from './slidePlainText'

/** Pick text motion from content shape (StoryWriter-style rules). */
export function resolveSmartTextMotion(slide) {
  const layout = slide?.layout || 'default'
  const plain = htmlToPlainText(slide?.content || '')
  const words = plain.split(/\s+/).filter(Boolean)
  const wordCount = words.length
  const hasSubtitle = htmlToPlainText(slide?.subtitle || '').length > 0

  if (layout === 'bulletpoints') {
    return {
      textAnimation: 'words-fade-up',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.06,
      textExitAnimation: 'match-in',
      subtitleDelay: hasSubtitle ? 0.25 : 0,
    }
  }

  if (wordCount <= 3) {
    return {
      textAnimation: 'words-kinetic',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.06,
      textExitAnimation: 'match-in',
      subtitleDelay: hasSubtitle ? 0.28 : 0,
    }
  }

  if (wordCount <= 10) {
    return {
      textAnimation: 'words-kinetic',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.05,
      textExitAnimation: 'match-in',
      subtitleDelay: hasSubtitle ? 0.32 : 0,
    }
  }

  if (wordCount <= 22) {
    return {
      textAnimation: 'words-fade-up',
      textAnimationUnit: 'word',
      textAnimationStagger: 0.05,
      textExitAnimation: 'match-in',
      subtitleDelay: hasSubtitle ? 0.35 : 0,
    }
  }

  return {
    textAnimation: 'fade-in-up',
    textAnimationUnit: 'sentence',
    textAnimationStagger: 0.14,
    textExitAnimation: 'match-in',
    subtitleDelay: hasSubtitle ? 0.4 : 0,
  }
}

export function isSmartAnimationActive(globalSettings = {}, slide = null) {
  const slideMode = slide?.textAnimationMode
  if (slideMode === 'manual') return false
  if (slideMode === 'smart') return true
  return (globalSettings.textAnimationMode || 'manual') === 'smart'
}
