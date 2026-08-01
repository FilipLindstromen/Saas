import React from 'react';
import { OffthreadVideo, Video, useRemotionEnvironment } from 'remotion';

/** OffthreadVideo for render; Html5 `Video` in the Remotion Player (editor preview). */
export function RemotionVideo({
  src,
  trimBefore,
  style,
  muted,
  onError,
}: {
  src: string;
  trimBefore?: number;
  style?: React.CSSProperties;
  muted?: boolean;
  onError?: (err: Error) => void;
}) {
  const { isPlayer } = useRemotionEnvironment();
  const trimProps = trimBefore != null && trimBefore > 0 ? { trimBefore } : {};

  if (isPlayer) {
    return <Video src={src} style={style} muted={muted} onError={onError} {...trimProps} />;
  }

  return <OffthreadVideo src={src} style={style} muted={muted} onError={onError} {...trimProps} />;
}
