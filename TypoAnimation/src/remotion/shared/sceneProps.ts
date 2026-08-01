import type { Scene } from '@/types/project';
import type { ResolvedSceneTheme } from './theme';
import type { ResolvedSceneVideo } from './SceneVideo';

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
  /** the project's main webcam/voiceover video, resolved to this scene's mode — only present
   * when project.video exists and this scene's mode isn't 'hidden'. Render
   * `video?.mode === 'background' && <SceneVideo video={video} ink={theme.ink} />` as the
   * first child (same slot as BrollBackground) to have it fill the frame behind the text;
   * 'pip' is handled centrally by SceneLayer, not per-style. */
  video?: ResolvedSceneVideo;
}
