
import React, { useEffect, useState, useMemo } from 'react'
import { generateWaveform } from '../utils/audio'

interface WaveformClipProps {
    blob: Blob
    duration: number // source duration in seconds
    width: number // display width in pixels
    height?: number
    color?: string
    backgroundColor?: string
    startOffset?: number // how far into the source we are (for visual slicing) NOT USED for generation, effectively scrubbing
    scale?: number // zoom level
}

export const WaveformClip: React.FC<WaveformClipProps> = ({
    blob,
    duration,
    width,
    height = 40,
    color = '#60a5fa', // Blue-400
    backgroundColor = 'transparent',
    startOffset = 0
}) => {
    const [fullWaveform, setFullWaveform] = useState<number[]>([])
    const [sourceDuration, setSourceDuration] = useState<number>(0)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let mounted = true
        const loadWaveform = async () => {
            setIsLoading(true)
            const samplesPerSecond = 50 // higher resolution for better fidelity on zoomed clips
            const { peaks, duration: decodedDuration } = await generateWaveform(blob, samplesPerSecond)

            if (mounted) {
                setFullWaveform(peaks)
                setSourceDuration(decodedDuration)
                setIsLoading(false)
            }
        }

        loadWaveform()
        return () => { mounted = false }
    }, [blob])

    // Draw SVG
    // waveform is an array of amplitudes 0-1 (roughly, though can be >1 if not normalized, our utils does raw)
    // We need to normalize or clamp.

    // Derive the segment of the waveform that corresponds to this clip (startOffset + duration)
    const displayWaveform = useMemo(() => {
        if (fullWaveform.length === 0 || sourceDuration <= 0) return []

        const safeStart = Math.max(0, startOffset)
        const safeEnd = Math.min(sourceDuration, safeStart + duration)
        const range = Math.max(0, safeEnd - safeStart)

        if (range === 0) return []

        const startIndex = Math.floor((safeStart / sourceDuration) * fullWaveform.length)
        const endIndex = Math.max(startIndex + 1, Math.min(fullWaveform.length, Math.ceil((safeEnd / sourceDuration) * fullWaveform.length)))
        const slice = fullWaveform.slice(startIndex, endIndex)

        const maxVal = Math.max(...slice, 0.0001)
        return slice.map(v => v / maxVal)
    }, [fullWaveform, sourceDuration, startOffset, duration])

    // Custom Bar Rendering matching the Reference Image style
    // The reference shows vertical bars with rounded caps.

    const bars = useMemo(() => {
        if (displayWaveform.length === 0) return null

        const barWidth = 4 // px
        const gap = 2 // px
        const totalBars = Math.max(1, Math.floor(width / (barWidth + gap)))

        // We need to sample `totalBars` values from `waveform`
        const items = []
        for (let i = 0; i < totalBars; i++) {
            // Map bar index to waveform index
            // Waveform covers 0 to duration.
            // This clip covers 0 to duration (assuming full source for now, or scaled).

            const waveformIndex = Math.floor((i / totalBars) * displayWaveform.length)
            const val = displayWaveform[waveformIndex] || 0
            const normalizedH = Math.max(0.1, val) // Already normalized to 0..1

            const h = normalizedH * height
            const x = i * (barWidth + gap)
            const y = (height - h) / 2

            items.push(
                <rect
                    key={i}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={h}
                    rx={barWidth / 2}
                    ry={barWidth / 2}
                    fill={color}
                />
            )
        }
        return items
    }, [displayWaveform, width, height, color])


    if (isLoading) return <div className="w-full h-full animate-pulse bg-gray-800/50 rounded" />

    return (
        <div className="w-full h-full overflow-hidden" style={{ backgroundColor }}>
            <svg width={width} height={height} preserveAspectRatio="none">
                {bars}
            </svg>
        </div>
    )
}
