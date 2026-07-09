import { useCallback, useEffect, useRef } from 'react'
import { drawAd } from '../utils/adCompositor'

export function useAdCompositor({
  canvasRef,
  format,
  backgroundColor,
  mediaElement,
  mediaScale,
  mediaOffsetX,
  mediaOffsetY,
  text,
  isVideoPlaying,
}) {
  const rafRef = useRef(null)

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayW = canvas.clientWidth
    const displayH = canvas.clientHeight
    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW
      canvas.height = displayH
    }

    const scaleX = displayW / format.width
    const scaleY = displayH / format.height

    ctx.save()
    ctx.scale(scaleX, scaleY)
    drawAd(ctx, {
      width: format.width,
      height: format.height,
      backgroundColor,
      mediaElement,
      mediaScale,
      mediaOffsetX,
      mediaOffsetY,
      text,
    })
    ctx.restore()
  }, [
    canvasRef,
    format,
    backgroundColor,
    mediaElement,
    mediaScale,
    mediaOffsetX,
    mediaOffsetY,
    text,
  ])

  useEffect(() => {
    paint()
  }, [paint])

  useEffect(() => {
    if (!isVideoPlaying) return
    const loop = () => {
      paint()
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [isVideoPlaying, paint])

  return { repaint: paint }
}
