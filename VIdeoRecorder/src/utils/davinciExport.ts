import { VideoCut, Layout } from './videoProcessing'
import { WordTimestamp } from './transcription'

export interface TimelineTrack {
  name: string
  clips: Array<{
    name: string
    start: number
    end: number
    file: string
  }>
}

/**
 * Export timeline as DaVinci Resolve FCPXML format
 */
export function exportDaVinciResolveTimeline(
  cameraFile: string | null,
  microphoneFile: string | null,
  screenFile: string | null,
  cuts: VideoCut[],
  layout: Layout,
  words: WordTimestamp[],
  duration: number
): string {
  // Generate FCPXML for DaVinci Resolve
  const projectName = 'Video Project'
  const sequenceName = 'Sequence 1'
  
  // Calculate timeline with cuts applied
  const sortedCuts = [...cuts].sort((a, b) => a.start - b.start)
  const segments: Array<{ start: number; end: number }> = []
  let currentStart = 0

  for (const cut of sortedCuts) {
    if (currentStart < cut.start) {
      segments.push({ start: currentStart, end: cut.start })
    }
    currentStart = Math.max(currentStart, cut.end)
  }

  if (currentStart < duration) {
    segments.push({ start: currentStart, end: duration })
  }

  // Build FCPXML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.9">
  <resources>
    <format id="r1" name="FFVideoFormat1080p2997" frameDuration="1001/30000s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
    <format id="r2" name="FFVideoFormat1080p2997" frameDuration="1001/30000s" width="1920" height="1080" colorSpace="1-1-1 (Rec. 709)"/>
`

  // Add media references
  let mediaId = 1
  if (cameraFile) {
    xml += `    <media id="m${mediaId}" name="Camera" uid="${cameraFile}">
      <movie path="${cameraFile}" src="file://${cameraFile}"/>
    </media>
`
    mediaId++
  }
  if (microphoneFile) {
    xml += `    <media id="m${mediaId}" name="Microphone" uid="${microphoneFile}">
      <movie path="${microphoneFile}" src="file://${microphoneFile}"/>
    </media>
`
    mediaId++
  }
  if (screenFile) {
    xml += `    <media id="m${mediaId}" name="Screen" uid="${screenFile}">
      <movie path="${screenFile}" src="file://${screenFile}"/>
    </media>
`
    mediaId++
  }

  xml += `  </resources>
  <library>
    <event name="${projectName}">
      <project name="${sequenceName}">
        <sequence format="r1" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">
          <spine>
`

  // Add video clips with cuts applied
  let timelineOffset = 0
  for (const segment of segments) {
    const segmentDuration = segment.end - segment.start
    if (cameraFile || screenFile) {
      const fileToUse = screenFile || cameraFile || ''
      xml += `            <video ref="r1" offset="${timelineOffset}s" name="Video" start="${segment.start}s" duration="${segmentDuration}s" src="file://${fileToUse}"/>
`
    }
    timelineOffset += segmentDuration
  }

  xml += `          </spine>
          <audio>
`

  // Add audio clips
  timelineOffset = 0
  for (const segment of segments) {
    const segmentDuration = segment.end - segment.start
    if (microphoneFile) {
      xml += `            <audio ref="r2" offset="${timelineOffset}s" name="Audio" start="${segment.start}s" duration="${segmentDuration}s" src="file://${microphoneFile}"/>
`
    }
    timelineOffset += segmentDuration
  }

  xml += `          </audio>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`

  return xml
}

