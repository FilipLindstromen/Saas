import React from 'react';
import { Composition } from 'remotion';
import { MainComposition, computeTotalDurationInFrames } from './Composition';
import { createEmptyProject, type Project } from '@/types/project';
import { COMPOSITION_ID, FPS, HEIGHT, WIDTH } from './constants';

export { FPS, WIDTH, HEIGHT, COMPOSITION_ID };

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
