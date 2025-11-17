import React, { useRef, useEffect, useState, useCallback } from "react";
import clsx from "clsx";

export type TimelineLayer = {
  id: string;
  name: string;
  type: "audio" | "video" | "text";
  clips: Array<{
    id: string;
    start: number;
    end: number;
    color?: string;
    label?: string;
  }>;
};

type TimelineProps = {
  duration: number;
  currentTime: number;
  layers: TimelineLayer[];
  onSeek?: (time: number) => void;
  onClipClick?: (layerId: string, clipId: string) => void;
  pixelsPerSecond?: number;
  height?: number;
};

export function Timeline({
  duration,
  currentTime,
  layers,
  onSeek,
  onClipClick,
  pixelsPerSecond = 100,
  height = 200
}: TimelineProps) {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const timeToPosition = useCallback((time: number) => {
    return (time / duration) * (duration * pixelsPerSecond);
  }, [duration, pixelsPerSecond]);

  const positionToTime = useCallback((position: number) => {
    return (position / (duration * pixelsPerSecond)) * duration;
  }, [duration, pixelsPerSecond]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = positionToTime(x);
    onSeek?.(Math.max(0, Math.min(time, duration)));
    setIsDragging(true);
  }, [onSeek, positionToTime, duration]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = positionToTime(x);
    setHoverTime(Math.max(0, Math.min(time, duration)));
    
    if (isDragging) {
      onSeek?.(Math.max(0, Math.min(time, duration)));
    }
  }, [isDragging, onSeek, positionToTime, duration]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (!timelineRef.current) return;
        const rect = timelineRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const time = positionToTime(x);
        onSeek?.(Math.max(0, Math.min(time, duration)));
      };
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
      };
      window.addEventListener("mousemove", handleGlobalMouseMove);
      window.addEventListener("mouseup", handleGlobalMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleGlobalMouseMove);
        window.removeEventListener("mouseup", handleGlobalMouseUp);
      };
    }
  }, [isDragging, onSeek, positionToTime, duration]);

  const playheadPosition = timeToPosition(currentTime);
  const timelineWidth = duration * pixelsPerSecond;

  // Generate time markers
  const markers: Array<{ time: number; label: string }> = [];
  const interval = duration > 60 ? 10 : duration > 30 ? 5 : 1;
  for (let t = 0; t <= duration; t += interval) {
    markers.push({
      time: t,
      label: formatTime(t)
    });
  }

  return (
    <div
      className="timeline-container"
      style={{
        width: "100%",
        height: `${height}px`,
        background: "var(--bg-panel)",
        borderTop: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden"
      }}
    >
      {/* Time Ruler */}
      <div
        className="timeline-ruler"
        style={{
          height: "30px",
          borderBottom: "1px solid var(--border-subtle)",
          position: "relative",
          background: "var(--bg-sidebar)",
          cursor: isDragging ? "grabbing" : "grab"
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div
          ref={timelineRef}
          style={{
            position: "relative",
            width: `${timelineWidth}px`,
            height: "100%",
            minWidth: "100%"
          }}
        >
          {/* Time Markers */}
          {markers.map((marker) => {
            const pos = timeToPosition(marker.time);
            return (
              <div
                key={marker.time}
                style={{
                  position: "absolute",
                  left: `${pos}px`,
                  top: 0,
                  height: "100%",
                  borderLeft: "1px solid var(--border-subtle)",
                  paddingLeft: "4px",
                  fontSize: "10px",
                  color: "var(--text-secondary)",
                  pointerEvents: "none"
                }}
              >
                {marker.label}
              </div>
            );
          })}
          
          {/* Hover Indicator */}
          {hoverTime !== null && (
            <div
              style={{
                position: "absolute",
                left: `${timeToPosition(hoverTime)}px`,
                top: 0,
                height: "100%",
                width: "1px",
                background: "var(--text-primary)",
                opacity: 0.5,
                pointerEvents: "none"
              }}
            />
          )}
        </div>
      </div>

      {/* Layers */}
      <div
        className="timeline-layers"
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "auto",
          position: "relative"
        }}
      >
        {layers.map((layer, layerIndex) => (
          <div
            key={layer.id}
            className="timeline-layer"
            style={{
              height: "50px",
              borderBottom: "1px solid var(--border-subtle)",
              position: "relative",
              display: "flex",
              alignItems: "center",
              background: layerIndex % 2 === 0 ? "var(--bg-panel)" : "var(--bg-sidebar)"
            }}
          >
            {/* Layer Label */}
            <div
              style={{
                width: "120px",
                minWidth: "120px",
                padding: "0 8px",
                borderRight: "1px solid var(--border-subtle)",
                fontSize: "12px",
                color: "var(--text-primary)",
                display: "flex",
                alignItems: "center",
                background: "var(--bg-sidebar)",
                position: "sticky",
                left: 0,
                zIndex: 2
              }}
            >
              {layer.name}
            </div>

            {/* Clips Container */}
            <div
              style={{
                position: "relative",
                width: `${timelineWidth}px`,
                height: "100%",
                minWidth: "100%"
              }}
            >
              {layer.clips.map((clip) => {
                const clipStart = timeToPosition(clip.start);
                const clipWidth = timeToPosition(clip.end - clip.start);
                return (
                  <div
                    key={clip.id}
                    className="timeline-clip"
                    onClick={() => onClipClick?.(layer.id, clip.id)}
                    style={{
                      position: "absolute",
                      left: `${clipStart}px`,
                      width: `${clipWidth}px`,
                      height: "80%",
                      top: "10%",
                      background: clip.color || "var(--primary)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      padding: "0 4px",
                      fontSize: "11px",
                      color: "white",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap"
                    }}
                    title={`${formatTime(clip.start)} - ${formatTime(clip.end)}`}
                  >
                    {clip.label || `${formatTime(clip.start)} - ${formatTime(clip.end)}`}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Playhead */}
      <div
        className="timeline-playhead"
        style={{
          position: "absolute",
          left: `${playheadPosition}px`,
          top: 0,
          bottom: 0,
          width: "2px",
          background: "#ef4444",
          pointerEvents: "none",
          zIndex: 10,
          boxShadow: "0 0 4px rgba(239, 68, 68, 0.5)"
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "-6px",
            left: "-4px",
            width: "10px",
            height: "10px",
            background: "#ef4444",
            borderRadius: "50%",
            border: "2px solid white"
          }}
        />
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

