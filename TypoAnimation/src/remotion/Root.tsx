import React from 'react';
import { Composition } from 'remotion';
import { MainComposition, computeTotalDurationInFrames } from './Composition';
import { createEmptyProject, type Project } from '@/types/project';

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1080;
export const COMPOSITION_ID = 'Main';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={COMPOSITION_ID}
      component={MainComposition}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      durationInFrames={FPS * 10}
      defaultProps={{ project: createEmptyProject() }}
      calculateMetadata={({ props }) => {
        const project = props.project as Project;
        return { durationInFrames: computeTotalDurationInFrames(project, FPS) };
      }}
    />
  );
};
