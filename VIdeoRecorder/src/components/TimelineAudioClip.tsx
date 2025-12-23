
import React, { useEffect, useState } from 'react'
import { WaveformClip } from './WaveformClip'
import { projectManager } from '../utils/projectManager'

interface TimelineAudioClipProps {
    sceneId: string
    takeId: string
    startOffset: number // sourceIn
    duration: number // sourceDuration
    width: number
    height: number
    color?: string
}

export const TimelineAudioClip: React.FC<TimelineAudioClipProps> = ({
    sceneId,
    takeId,
    startOffset,
    duration,
    width,
    height,
    color
}) => {
    const [blob, setBlob] = useState<Blob | null>(null)

    useEffect(() => {
        let mounted = true
        const loadAudio = async () => {
            // Try to load the microphone audio for this take
            // Filename convention: {takeId}_microphone
            const b = await projectManager.loadRecording(sceneId, `${takeId}_microphone`)
            if (mounted) setBlob(b)
        }
        loadAudio()
        return () => { mounted = false }
    }, [sceneId, takeId])

    if (!blob) return <div className="w-full h-full bg-gray-700/50 animate-pulse" />

    return (
        <WaveformClip
            blob={blob}
            duration={duration}
            width={width}
            height={height}
            color={color}
            startOffset={startOffset}
        />
    )
}
