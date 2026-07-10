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
    if (!displayW || !displayH) return

    if (canvas.width !== displayW || canvas.height !== displayH) {
      canvas.width = displayW
      canvas.height = displayH
    }

    const scale = Math.min(displayW / format.width, displayH / format.height)
    const offsetX = (displayW - format.width * scale) / 2
    const offsetY = (displayH - format.height * scale) / 2

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, displayW, displayH)
    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(scale, scale)
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
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => paint())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [canvasRef, paint])

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
