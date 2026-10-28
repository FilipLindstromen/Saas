import React from 'react'
import { Composition } from 'remotion'
import { BRollComposition } from './Composition'
import { computeTotalDurationInFrames } from './segments'
import { ASPECT_RATIO_SIZES, COMPOSITION_ID, FPS, createEmptyProject } from '../types'
import type { Project } from '../types'

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={BRollComposition}
      fps={FPS}
      width={1920}
      height={1080}
      durationInFrames={FPS * 10}
      defaultProps={{ project: createEmptyProject() }}
      calculateMetadata={({ props }) => {
        const project = props.project as Project
        const size = ASPECT_RATIO_SIZES[project.aspectRatio] || ASPECT_RATIO_SIZES['16:9']
        return {
          durationInFrames: computeTotalDurationInFrames(project, FPS),
          width: size.width,
          height: size.height,
        }
      }}
    />
  )
}
