export type BackgroundType = 'color' | 'image' | 'video' | 'meme' | 'splitScreen'

export interface QuizAnswer {
  id: string
  text: string
  isCorrect: boolean
}

export type QuestionType = 'boolean' | 'multiple'

export interface QuizQuestionBase {
  id: string
  title: string
  type: QuestionType
}

export interface BooleanQuestion extends QuizQuestionBase {
  type: 'boolean'
  answers: [QuizAnswer, QuizAnswer]
}

export interface MultipleChoiceQuestion extends QuizQuestionBase {
  type: 'multiple'
  answers: [QuizAnswer, QuizAnswer, QuizAnswer]
}

export type QuizQuestion = BooleanQuestion | MultipleChoiceQuestion

export interface QuizBackground {
  type: BackgroundType
  color?: string
  imageUrl?: string
  videoUrl?: string
  videoStartOffsetSeconds?: number
  memeUrl?: string
  memeTitle?: string
  isGif?: boolean
  splitScreen?: boolean
  upperVideoUrl?: string
  lowerVideoUrl?: string
}

export interface QuizData {
  title: string
  background: QuizBackground
  questions: QuizQuestion[]
  settings?: QuizSettings
  meme?: MemeData
}

export type AspectRatio = '1:1' | '3:4' | '9:16'

export type AnswerFormat = 'letters' | 'numbers' | 'steps'

export type AnimationType = 'quiz' | 'meme' | 'overlay'

export type OverlayAnimation = 'none' | 'fade' | 'slide-up' | 'slide-down' | 'scale'
export type OverlayVerticalPosition = 'top' | 'center' | 'bottom'
export type OverlayHorizontalAlign = 'left' | 'center' | 'right'

export interface OverlayTextItem {
  id: string
  text: string
  fontFamily?: string
  fontSizePercent?: number
  textColor?: string
  backgroundColor?: string
  backgroundOpacity?: number
  padding?: number
  align?: OverlayHorizontalAlign
  verticalPosition?: OverlayVerticalPosition
  animationIn?: OverlayAnimation
  animationOut?: OverlayAnimation
  animationInDurationMs?: number
  animationOutDurationMs?: number
  displayDurationMs?: number
  startOffsetMs?: number
}

export interface OverlaySettings {
  enabled: boolean
  items: OverlayTextItem[]
}

export interface QuizSettings {
  aspectRatio: AspectRatio
  animationType?: AnimationType
  showTitle?: boolean
  titleInMs: number
  titleHoldMs: number
  titleOutMs: number
  questionInMs: number
  questionHoldMs: number
  answersStaggerMs: number
  correctRevealMs: number
  endDelayMs?: number
  questionColor: string
  answerColor: string
  correctAnswerColor: string
  correctAnswerButtonColor?: string
  correctAnswerTextColor?: string
  overlayColor?: string
  overlayOpacity?: number
  titleShadowEnabled?: boolean
  titleShadowColor?: string
  questionShadowEnabled?: boolean
  questionShadowColor?: string
  bgZoomEnabled?: boolean
  bgZoomScale?: number
  bgZoomDurationMs?: number
  overlay?: OverlaySettings
  answerWidthPercent?: number
  answerWidth?: number // Legacy property for migration
  bgOverlayColor?: string
  bgOverlayOpacity?: number
  titleSizePercent?: number
  questionSizePercent?: number
  answerSizePercent?: number
  answerFormat?: AnswerFormat
  fontFamily?: string
  music?: {
    name: string
    url: string
    volume: number
    startOffsetSeconds?: number
  }
  sfx: {
    appearVolume: number
    correctVolume: number
  }
    cta?: {
    enabled: boolean
    durationMs: number
    useSameBackground: boolean
    backgroundVideoUrl?: string
    backgroundType?: 'video' | 'image'
    showText?: boolean
    text?: string
    textSizePercent?: number
    textColor?: string
    textShadowEnabled?: boolean
    textShadowColor?: string
    imageUrl?: string
      fontFamily?: string
    fadeInMs?: number
    holdMs?: number
    fadeOutMs?: number
    overlayEnabled?: boolean
    overlayColor?: string
    overlayOpacity?: number
  }
}

// Meme Generator Types
export interface MemeData {
  topText?: string
  bottomText?: string
  background: QuizBackground
  settings?: MemeSettings
}

export interface MemeSettings {
  showTopText?: boolean
  showBottomText?: boolean
  topTextColor: string
  bottomTextColor: string
  overlayColor?: string
  overlayOpacity?: number
  topTextShadowEnabled?: boolean
  topTextShadowColor?: string
  bottomTextShadowEnabled?: boolean
  bottomTextShadowColor?: string
  topTextSizePercent?: number
  bottomTextSizePercent?: number
  topTextDistanceFromTop?: number
  bottomTextDistanceFromBottom?: number
  textBackgroundEnabled?: boolean
  textBackgroundColor?: string
  topTextInMs?: number
  bottomTextInMs?: number
  topTextHoldMs?: number // How long top text stays visible
  bottomTextHoldMs?: number // How long bottom text stays visible
  topTextFadeOutMs?: number // Fade out time for top text
  bottomTextFadeOutMs?: number // Fade out time for bottom text
  holdMs?: number // How long both texts stay visible (legacy)
  textFadeOutMs?: number // Fade out time before CTA (legacy)
}


