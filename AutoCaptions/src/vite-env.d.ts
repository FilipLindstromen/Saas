/// <reference types="vite/client" />

declare module '@shared/ThemeToggle' {
  import type { FC } from 'react'
  export interface ThemeToggleProps {
    theme?: string
    onToggle?: (nextTheme: string) => void
    className?: string
  }
  const ThemeToggle: FC<ThemeToggleProps>
  export default ThemeToggle
}
