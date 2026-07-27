import type { Scene } from '@/types/project';
import type { ResolvedSceneTheme } from './theme';

// Every scene-style component (PlainScene, PosterScene, ...) receives exactly this —
// analogous to what the reference's useScene() + Chrome props supplied.
export interface SceneComponentProps {
  scene: Scene;
  theme: ResolvedSceneTheme;
  /** local time in seconds, since the start of this scene */
  t: number;
  /** this scene's duration in seconds */
  dur: number;
  label: string;
  showCaptions: boolean;
  showTimecode: boolean;
  sceneIndex: number;
  sceneCount: number;
  elapsedSec: number;
  totalSec: number;
}
