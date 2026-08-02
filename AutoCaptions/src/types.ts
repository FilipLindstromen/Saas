export interface CaptionWord {
  word: string
  start: number
  end: number
}

export interface CaptionSegment {
  start: number
  end: number
  text: string
  words?: CaptionWord[]
}

/** 15 caption visual styles */
export type CaptionStyle =
  | 'lower-third'
  | 'centered-subtitle'
  | 'karaoke'
  | 'minimal'
  | 'bold-block'
  | 'word-by-word'
  | 'yellow-highlight'
  | 'outline'
  | 'box-top'
  | 'typewriter'
  | 'hormozi'
  | 'bubble'
  | 'highlighter'
  | 'gradient'
  | 'neon'

/** 10 in/out animation styles for captions */
export type CaptionAnimation =
  | 'none'
  | 'fade'
  | 'fade-slide-left'
  | 'fade-slide-right'
  | 'fade-slide-up'
  | 'fade-slide-down'
  | 'scale-in'
  | 'scale-out'
  | 'slide-from-bottom'
  | 'bounce'
