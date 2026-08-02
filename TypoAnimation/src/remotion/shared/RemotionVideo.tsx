import React from 'react';
import type { VolumeProp } from 'remotion';
import { OffthreadVideo, Video, useRemotionEnvironment } from 'remotion';

/** OffthreadVideo for render; Html5 `Video` in the Remotion Player (editor preview). */
export function RemotionVideo({
  src,
  trimBefore,
  style,
  muted,
  volume,
  onError,
}: {
  src: string;
  trimBefore?: number;
  style?: React.CSSProperties;
  muted?: boolean;
  volume?: VolumeProp;
  onError?: (err: Error) => void;
}) {
  const { isPlayer } = useRemotionEnvironment();
  const trimProps = trimBefore != null && trimBefore > 0 ? { trimBefore } : {};
  const volumeProps = volume != null ? { volume } : {};

  if (isPlayer) {
    return <Video src={src} style={style} muted={muted} onError={onError} {...trimProps} {...volumeProps} />;
  }

  return <OffthreadVideo src={src} style={style} muted={muted} onError={onError} {...trimProps} {...volumeProps} />;
}
