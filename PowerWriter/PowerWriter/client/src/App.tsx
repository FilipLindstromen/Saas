import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { ReactNode, SVGProps } from "react";
import clsx from "clsx";
import "./App.css";
import type { DocumentDetails, FolderDetails, TreeNode } from "./types";
import {
  createDocument,
  createFolder,
  fetchTree,
  generateAnswer,
  generateVariants,
  getDocumentDetails,
  getFolderDetails,
  moveDocument,
  moveFolder,
  renameDocument,
  renameFolder,
  reorderItem,
  saveDocument,
  saveFolderInstructions,
  deleteDocument,
  deleteFolder,
  uploadDocumentAudio
} from "./api";
import { AudioEditor } from "./AudioEditor";
import type { Transcription } from "./types";
import { loadApiKeys, saveApiKeys } from "./apiKeys";
import ThemeToggle from "@shared/ThemeToggle";
import { getTheme, setTheme, initThemeSync } from "@shared/theme";

type Selection =
  | {
      type: "folder";
      path: string;
      name: string;
      color?: string | null;
    }
  | {
      type: "document";
      path: string;
      name: string;
    };

type VariantMode =
  | "simplify"
  | "expand"
  | "rephrase"
  | "summarize"
  | "punchUp"
  | "sensory";

type SelectionMenuState = {
  text: string;
  x: number;
  y: number;
};

type VariantModalState = {
  mode: VariantMode;
  source: string;
  variants: string[];
  loading: boolean;
  error: string | null;
};

const COMMON_STATUS_TIMEOUT = 2500;
const SELECTION_MENU_WIDTH = 180;
const SELECTION_MENU_HEIGHT = 48;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const STORAGE_KEYS = {
  lastSelection: "powerwriter.lastSelection"
} as const;
const LS_KEYS = {
  sidebarWidth: "powerwriter.sidebarWidth",
  instructionsWidth: "powerwriter.instructionsWidth",
  inlineWidth: "powerwriter.inlineWidth",
  inlineEditorHeight: "powerwriter.inlineEditorHeight",
  inlineOrder: "powerwriter.inlineOrder",
  audioEditorWidth: "powerwriter.audioEditorWidth",
  instructionsVisible: "powerwriter.instructionsVisible",
  documentVisible: "powerwriter.documentVisible",
  inlineEditorVisible: "powerwriter.inlineEditorVisible",
  chatVisible: "powerwriter.chatVisible",
  audioEditorVisible: "powerwriter.audioEditorVisible"
} as const;
const DEFAULT_SIDEBAR_WIDTH = 280;
const DEFAULT_INSTRUCTIONS_RATIO = 0.32;
const DEFAULT_INLINE_RATIO = 0.26;
const MIN_INSTRUCTIONS_RATIO = 0.18;
const MIN_INLINE_RATIO = 0.18;
const MIN_DOCUMENT_RATIO = 0.28;
const DEFAULT_INLINE_EDITOR_RATIO = 0.55;
const MIN_INLINE_EDITOR_RATIO = 0.2;
const MAX_INLINE_EDITOR_RATIO = 0.85;
const DEFAULT_FOLDER_COLOR = "#6b6b6b";
const AUTO_SAVE_DELAY_MS = 1200;

const inferBlobExtension = (mimeType: string): string => {
  if (mimeType.includes("audio/mpeg")) return "mp3";
  if (mimeType.includes("audio/wav")) return "wav";
  if (mimeType.includes("audio/ogg")) return "ogg";
  if (mimeType.includes("audio/mp4") || mimeType.includes("audio/aac")) {
    return "m4a";
  }
  return "webm";
};

const buildOptimisticAudioFileName = (
  documentName: string | undefined,
  mimeType: string
) => {
  const baseName = documentName
    ? documentName.replace(/\.[^./\\]+$/g, "")
    : "recording";
  const sanitizedBase = baseName
    .normalize("NFKD")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim() || "recording";
  const extension = inferBlobExtension(mimeType);
  return `${sanitizedBase}.${extension}`;
};

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const createIcon = (path: ReactNode, viewBox = "0 0 24 24") =>
  function Icon({ size = 18, ...props }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...props}
      >
        {path}
      </svg>
    );
  };

const IconRecord = createIcon(
  <circle cx="12" cy="12" r="6" fill="currentColor" stroke="none" />
);
const IconStop = createIcon(<rect x="7" y="7" width="10" height="10" rx="2" />);
const IconPlay = createIcon(
  <polygon points="9 6.5 18 12 9 17.5" fill="currentColor" stroke="none" />
);
const IconPause = createIcon(
  <>
    <rect x="7" y="6" width="3.5" height="12" rx="1.2" />
    <rect x="13.5" y="6" width="3.5" height="12" rx="1.2" />
  </>
);
const IconRewind = createIcon(
  <>
    <polygon points="11 12 19 7 19 17" />
    <polygon points="5 12 13 7 13 17" />
  </>
);
const IconSwap = createIcon(
  <>
    <path d="M7 7h10" />
    <path d="M17 7l-3-3" />
    <path d="M17 7l-3 3" />
    <path d="M7 17h10" />
    <path d="M7 17l3-3" />
    <path d="M7 17l3 3" />
  </>
);
const IconDocument = createIcon(
  <>
    <path d="M8 4h5l5 5v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    <path d="M13 4v4h4" />
  </>
);
const IconTextEditor = createIcon(
  <>
    <path d="M5 5h14" />
    <path d="M5 9h14" />
    <path d="M9 9v10" />
    <path d="M15 9v6" />
    <path d="M13 19h4" />
  </>
);
const IconInline = createIcon(
  <>
    <path d="M12 4v4" />
    <path d="M12 16v4" />
    <path d="M7 9l2 3-2 3" />
    <path d="M17 9l-2 3 2 3" />
    <circle cx="12" cy="12" r="3.2" />
  </>
);
const IconChat = createIcon(
  <>
    <path d="M5 19l1.3-3.9A7 7 0 1 1 12 19a6.9 6.9 0 0 1-2.9-.6z" />
  </>
);
const IconLayers = createIcon(
  <>
    <path d="m12 3 9 5-9 5-9-5z" />
    <path d="m3 13 9 5 9-5" />
    <path d="m3 18 9 5 9-5" />
  </>
);
const IconSettings = createIcon(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.09a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.09a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </>
);
const IconSimplify = createIcon(
  <>
    <path d="M7 6h10" />
    <path d="M5 10h14" />
    <path d="M8 14h8" />
    <path d="M10 18h4" />
  </>
);
const IconPunch = createIcon(
  <>
    <path d="M13 2v4" />
    <path d="m6 11 3-3 2 2 3-3 2 2" />
    <path d="M5 22h14" />
    <path d="M9 22v-4h1.5l2.5-3" />
  </>
);
const IconSensory = createIcon(
  <>
    <path d="M12 8c-1.5 0-3 .75-3 2s1.5 2 3 2 3 .75 3 2-1.5 2-3 2" />
    <path d="M12 5v1" />
    <path d="M12 20v-1" />
    <path d="M16 4l-.5 1" />
    <path d="M8.5 19l-.5 1" />
    <path d="M19 9l-1 .5" />
    <path d="M6 14.5 5 15" />
    <path d="m18 15-1-.5" />
    <path d="m7 9.5-1-.5" />
  </>
);
const IconAudioEditor = createIcon(
  <>
    <path d="M2 10v4" />
    <path d="M6 6v12" />
    <path d="M10 4v16" />
    <path d="M14 8v8" />
    <path d="M18 10v4" />
    <path d="M4 18h16" />
    <path d="M6 18v-8" />
  </>
);
const IconMic = createIcon(
  <>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
    <line x1="12" y1="19" x2="12" y2="23" />
    <line x1="8" y1="23" x2="16" y2="23" />
  </>
);
const IconVideo = createIcon(
  <>
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </>
);
const IconEye = createIcon(
  <>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </>
);
const IconEyeOff = createIcon(
  <>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </>
);
const IconTrash = createIcon(
  <>
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </>
);

const VARIANT_ICONS: Partial<Record<VariantMode, (props: IconProps) => JSX.Element>> = {
  simplify: IconSimplify,
  punchUp: IconPunch,
  sensory: IconSensory,
  expand: IconInline,
  rephrase: IconTextEditor,
  summarize: IconDocument
};

type DocumentSnapshot = {
  content: string;
  instructions: string;
  completed: boolean;
};

type FolderSnapshot = {
  instructions: string;
  color: string | null;
};

const toDocumentSnapshot = (details: DocumentDetails): DocumentSnapshot => ({
  content: details.content,
  instructions: details.instructions,
  completed: details.completed
});

const toFolderSnapshot = (details: FolderDetails): FolderSnapshot => ({
  instructions: details.instructions,
  color: details.color
});

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeRatios = (instructions: number, inline: number) => {
  let inst = clamp(instructions, MIN_INSTRUCTIONS_RATIO, 0.7);
  let inl = clamp(inline, MIN_INLINE_RATIO, 0.7);
  const maxSum = 1 - MIN_DOCUMENT_RATIO;
  if (inst + inl > maxSum) {
    const scale = maxSum / (inst + inl);
    inst *= scale;
    inl *= scale;
  }
  return [inst, inl] as const;
};

function getInitialSidebarWidth() {
  if (typeof window !== "undefined") {
    const stored = parseInt(
      window.localStorage.getItem(LS_KEYS.sidebarWidth) ?? "",
      10
    );
    if (Number.isFinite(stored)) {
      return clamp(stored, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
    }
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

function getInitialRatios() {
  if (typeof window !== "undefined") {
    const storedInstructions = parseFloat(
      window.localStorage.getItem(LS_KEYS.instructionsWidth) ?? ""
    );
    const storedInline = parseFloat(
      window.localStorage.getItem(LS_KEYS.inlineWidth) ?? ""
    );
    const [inst, inl] = normalizeRatios(
      Number.isFinite(storedInstructions)
        ? storedInstructions
        : DEFAULT_INSTRUCTIONS_RATIO,
      Number.isFinite(storedInline)
        ? storedInline
        : DEFAULT_INLINE_RATIO
    );
    return { instructions: inst, inline: inl };
  }
  const [inst, inl] = normalizeRatios(
    DEFAULT_INSTRUCTIONS_RATIO,
    DEFAULT_INLINE_RATIO
  );
  return { instructions: inst, inline: inl };
}

function getInitialInlineEditorRatio() {
  if (typeof window !== "undefined") {
    const stored = parseFloat(
      window.localStorage.getItem(LS_KEYS.inlineEditorHeight) ?? ""
    );
    if (Number.isFinite(stored)) {
      return clamp(
        stored,
        MIN_INLINE_EDITOR_RATIO,
        MAX_INLINE_EDITOR_RATIO
      );
    }
  }
  return DEFAULT_INLINE_EDITOR_RATIO;
}

const VARIANT_LABELS: Record<VariantMode, string> = {
  simplify: "Simplify",
  expand: "Expand",
  rephrase: "Rephrase",
  summarize: "Summarize",
  punchUp: "Punch Up",
  sensory: "Enrich Detail"
};
const SELECTION_ACTIONS: VariantMode[] = ["simplify", "expand", "rephrase"];
const PARAGRAPH_ACTIONS: VariantMode[] = ["simplify", "punchUp", "sensory"];

function findNodeByPath(nodes: TreeNode[], targetPath: string): TreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) {
      return node;
    }
    if (node.type === "folder" && node.children) {
      const found = findNodeByPath(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

function getInitialInlineOrder() {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem(LS_KEYS.inlineOrder) === "true";
  }
  return false;
}

function Tree({
  nodes,
  collapsed,
  onToggle,
  onSelect,
  selectedPath,
  onRename,
  onDelete,
  onReorder,
  onDropInto,
  onDragStart,
  onDragEnd,
  draggedItem,
  onDropToRoot
}: {
  nodes: TreeNode[];
  collapsed: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (item: Selection) => void;
  selectedPath: string | null;
  onRename: (item: Selection) => void;
  onDelete: (item: Selection) => void;
  onReorder: (item: Selection, direction: "up" | "down") => void;
  onDropInto: (
    targetPath: string | null,
    item: Selection
  ) => void | Promise<void>;
  onDragStart: (item: Selection) => void;
  onDragEnd: () => void;
  draggedItem: Selection | null;
  onDropToRoot: () => void | Promise<void>;
}) {
  return (
    <div
      className="tree"
      onDragOver={(event) => {
        if (draggedItem) {
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(event) => {
        if (!draggedItem) return;
        event.preventDefault();
        onDropToRoot();
      }}
    >
      {nodes.map((node) => (
        <TreeNodeItem
          key={node.path}
          node={node}
          collapsed={collapsed}
          onToggle={onToggle}
          onSelect={onSelect}
          selectedPath={selectedPath}
          depth={0}
          onRename={onRename}
          onDelete={onDelete}
          onReorder={onReorder}
          onDropInto={onDropInto}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          draggedItem={draggedItem}
        />
      ))}
    </div>
  );
}

function TreeNodeItem({
  node,
  collapsed,
  onToggle,
  onSelect,
  selectedPath,
  depth,
  onRename,
  onDelete,
  onReorder,
  onDropInto,
  onDragStart,
  onDragEnd,
  draggedItem
}: {
  node: TreeNode;
  collapsed: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (item: Selection) => void;
  selectedPath: string | null;
  depth: number;
  onRename: (item: Selection) => void;
  onDelete: (item: Selection) => void;
  onReorder: (item: Selection, direction: "up" | "down") => void;
  onDropInto: (
    targetPath: string | null,
    item: Selection
  ) => void | Promise<void>;
  onDragStart: (item: Selection) => void;
  onDragEnd: () => void;
  draggedItem: Selection | null;
}) {
  const isFolder = node.type === "folder";
  const isCollapsed = isFolder && collapsed[node.path];
  const isActive = node.path === selectedPath;
  const isCompleted = node.type === "document" && node.completed;
  const paddingLeft = 16 + depth * 16;
  const accentColor =
    node.type === "folder" && node.color ? node.color : undefined;

  const handleSelect = () => {
    onSelect({
      type: node.type,
      path: node.path,
      name: node.name,
      color: node.color ?? undefined
    });
  };

  const handleDrop = () => {
    if (!draggedItem) return;
    onDropInto(node.path, draggedItem);
  };

  const allowDrop =
    isFolder &&
    draggedItem &&
    draggedItem.path !== node.path &&
    !draggedItem.path.startsWith(`${node.path}/`);

  return (
    <div>
      <div
        className={clsx(
          "tree-item",
          isActive && "tree-item active",
          isCompleted && "tree-item-completed",
          accentColor && "tree-item-colored"
        )}
        style={{
          paddingLeft,
          borderLeft: accentColor ? `3px solid ${accentColor}` : undefined
        }}
        onDragOver={(event) => {
          if (allowDrop) {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }
        }}
        onDrop={(event) => {
          if (!allowDrop) return;
          event.preventDefault();
          event.stopPropagation();
          handleDrop();
        }}
      >
        {isFolder ? (
          <button
            type="button"
            aria-label={isCollapsed ? "Expand folder" : "Collapse folder"}
            onClick={() => onToggle(node.path)}
          >
            {isCollapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span style={{ width: 14 }} />
        )}
        {isFolder && accentColor ? (
          <span
            className="color-dot"
            style={{ backgroundColor: accentColor }}
          />
        ) : null}
        <button
          type="button"
          className="title"
          draggable
          onClick={handleSelect}
          onDragStart={(event) => {
            event.stopPropagation();
            event.dataTransfer.effectAllowed = "move";
            onDragStart({
              type: node.type,
              path: node.path,
              name: node.name
            });
          }}
          onDragEnd={(event) => {
            event.stopPropagation();
            onDragEnd();
          }}
        >
          {node.name}
        </button>
        <div className="tree-actions">
          <button
            type="button"
            aria-label="Move up"
            title="Move up"
            onClick={(event) => {
              event.stopPropagation();
              onReorder(
                {
                  type: node.type,
                  path: node.path,
                  name: node.name
                },
                "up"
              );
            }}
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Move down"
            title="Move down"
            onClick={(event) => {
              event.stopPropagation();
              onReorder(
                {
                  type: node.type,
                  path: node.path,
                  name: node.name
                },
                "down"
              );
            }}
          >
            ↓
          </button>
          <button
            type="button"
            aria-label="Rename"
            title="Rename"
            onClick={(event) => {
              event.stopPropagation();
              onRename({
                type: node.type,
                path: node.path,
                name: node.name
              });
            }}
          >
            ✎
          </button>
          <button
            type="button"
            aria-label="Delete"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              onDelete({
                type: node.type,
                path: node.path,
                name: node.name
              });
            }}
          >
            ✕
          </button>
        </div>
      </div>
      {isFolder && !isCollapsed && node.children?.length ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.path}
              node={child}
              collapsed={collapsed}
              onToggle={onToggle}
              onSelect={onSelect}
              selectedPath={selectedPath}
              depth={depth + 1}
              onRename={onRename}
              onDelete={onDelete}
              onReorder={onReorder}
              onDropInto={onDropInto}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              draggedItem={draggedItem}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function App() {
  console.info("[PowerWriter] bundle version 2025-02-20-1");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const initialRatiosRef = useRef(getInitialRatios());
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
  const [sidebarVisible, setSidebarVisible] = useState(() => {
    const stored = window.localStorage.getItem("powerwriter.sidebarVisible");
    return stored !== null ? stored === "true" : true;
  });
  const [currentMode, setCurrentMode] = useState<"planning" | "recording" | "editing">(() => {
    const stored = window.localStorage.getItem("powerwriter.currentMode");
    return (stored as "planning" | "recording" | "editing") || "planning";
  });
  const [recordingType, setRecordingType] = useState<"audio" | "audio+video">("audio");
  const [videoAspectRatio, setVideoAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [theme, setThemeState] = useState(() => getTheme());
  const [isRecordingSettingsOpen, setIsRecordingSettingsOpen] = useState(false);
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null);
  const [showVideoPreview, setShowVideoPreview] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isWebcamOn, setIsWebcamOn] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("default");
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("default");
  
  // Save mode to localStorage when it changes
  useEffect(() => {
    window.localStorage.setItem("powerwriter.currentMode", currentMode);
  }, [currentMode]);
  
  // Save sidebar visibility to localStorage when it changes
  useEffect(() => {
    window.localStorage.setItem("powerwriter.sidebarVisible", String(sidebarVisible));
  }, [sidebarVisible]);

  // Theme sync (shared across all Saas apps)
  useEffect(() => {
    const unsub = initThemeSync();
    const handler = () => setThemeState(getTheme());
    window.addEventListener("saas-theme-change", handler);
    return () => {
      unsub?.();
      window.removeEventListener("saas-theme-change", handler);
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Apply mic mute to active stream
  useEffect(() => {
    const stream = audioStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(track => {
      track.enabled = !isMicMuted;
    });
  }, [isMicMuted]);

  // Webcam toggle controls recording type and preview preference
  useEffect(() => {
    setRecordingType(isWebcamOn ? "audio+video" : "audio");
    setShowVideoPreview(isWebcamOn);
    if (!isWebcamOn) {
      // Turn off live preview stream if present
      if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
      if (videoStreamRef.current) {
        videoStreamRef.current.getVideoTracks().forEach(t => t.stop());
        // Keep audio tracks alive
        videoStreamRef.current = null;
      }
    }
  }, [isWebcamOn]);

  // Load audio/video devices
  useEffect(() => {
    const loadDevices = async () => {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          // Request permission first to get device labels
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          } catch (e) {
            // Permission denied, but we can still enumerate devices (without labels)
          }
          
          const devices = await navigator.mediaDevices.enumerateDevices();
          const audioInputs = devices.filter(device => device.kind === "audioinput");
          const videoInputs = devices.filter(device => device.kind === "videoinput");
          setAudioDevices(audioInputs);
          setVideoDevices(videoInputs);
        }
      } catch (error) {
        console.error("Failed to enumerate devices:", error);
      }
    };
    loadDevices();
    
    // Reload devices when they change
    const handleDeviceChange = () => {
      loadDevices();
    };
    navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices?.removeEventListener("devicechange", handleDeviceChange);
    };
  }, []);
  const [instructionsRatio, setInstructionsRatio] = useState(
    initialRatiosRef.current.instructions
  );
  const [inlineRatio, setInlineRatio] = useState(initialRatiosRef.current.inline);
  const [draggingResizer, setDraggingResizer] = useState<
    "sidebar" | "instructions" | "inline" | "inlineHeight" | "audioEditor" | null
  >(null);
  const [inlineBeforeDocument, setInlineBeforeDocument] =
    useState(getInitialInlineOrder);

  const [status, setStatus] = useState<
    { type: "success" | "error"; message: string } | null
  >(null);

  const [folderDetails, setFolderDetails] = useState<FolderDetails | null>(
    null
  );
  const [documentDetails, setDocumentDetails] =
    useState<DocumentDetails | null>(null);
  const [loadingSelection, setLoadingSelection] = useState(false);

  const [chatPrompt, setChatPrompt] = useState("");
  const [chatResponses, setChatResponses] = useState<
    { id: number; message: string }[]
  >([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDocGenerating, setIsDocGenerating] = useState(false);
  const [draggedItem, setDraggedItem] = useState<Selection | null>(null);
  const [selectionMenu, setSelectionMenu] =
    useState<SelectionMenuState | null>(null);
  const [variantModal, setVariantModal] =
    useState<VariantModalState | null>(null);
  const [inlineActionsEnabled, setInlineActionsEnabled] = useState(true);
  const [documentNameInput, setDocumentNameInput] = useState("");
  const [folderColorInput, setFolderColorInput] =
    useState<string>(DEFAULT_FOLDER_COLOR);
  const [folderColorCustom, setFolderColorCustom] = useState(false);
  const [showAggregated, setShowAggregated] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [settingsKey, setSettingsKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [instructionsVisible, setInstructionsVisible] = useState(() => {
    const stored = window.localStorage.getItem(LS_KEYS.instructionsVisible);
    return stored !== null ? stored === "true" : true;
  });
  const [documentVisible, setDocumentVisible] = useState(() => {
    const stored = window.localStorage.getItem(LS_KEYS.documentVisible);
    return stored !== null ? stored === "true" : true;
  });
  const [inlineEditorVisible, setInlineEditorVisible] = useState(() => {
    const stored = window.localStorage.getItem(LS_KEYS.inlineEditorVisible);
    return stored !== null ? stored === "true" : true;
  });
  const [chatVisible, setChatVisible] = useState(() => {
    const stored = window.localStorage.getItem(LS_KEYS.chatVisible);
    return stored !== null ? stored === "true" : false;
  });
  const [audioEditorVisible, setAudioEditorVisible] = useState(() => {
    const stored = window.localStorage.getItem(LS_KEYS.audioEditorVisible);
    return stored !== null ? stored === "true" : false;
  });
  const [audioEditorRatio, setAudioEditorRatio] = useState(() => {
    if (typeof window !== "undefined") {
      const stored = parseFloat(
        window.localStorage.getItem(LS_KEYS.audioEditorWidth) ?? ""
      );
      if (Number.isFinite(stored)) {
        return clamp(stored, 0.18, 0.7);
      }
    }
    return 0.32;
  });

  // Captions state for Edit Studio when no video is available
  const [captionCurrentIndex, setCaptionCurrentIndex] = useState<number | null>(null);
  useEffect(() => {
    const onWord = (e: any) => {
      const idx = e?.detail?.index;
      if (typeof idx === "number") {
        setCaptionCurrentIndex(idx >= 0 ? idx : null);
      }
    };
    const onStop = () => setCaptionCurrentIndex(null);
    window.addEventListener("audioeditor:word", onWord);
    window.addEventListener("audioeditor:stop", onStop);
    return () => {
      window.removeEventListener("audioeditor:word", onWord);
      window.removeEventListener("audioeditor:stop", onStop);
    };
  }, []);

  function CaptionsPanel({ transcription }: { transcription: Transcription | null }) {
    const words = transcription?.words || [];
    const [currentWordIndex, setCurrentWordIndex] = useState<number | null>(null);
    
    // Listen for word playback events from AudioEditor
    useEffect(() => {
      const handleWordEvent = (e: any) => {
        const index = e?.detail?.index;
        if (typeof index === "number" && index >= 0) {
          setCurrentWordIndex(index);
        } else {
          setCurrentWordIndex(null);
        }
      };
      const handleStopEvent = () => {
        setCurrentWordIndex(null);
      };
      
      window.addEventListener("audioeditor:word", handleWordEvent);
      window.addEventListener("audioeditor:stop", handleStopEvent);
      
      return () => {
        window.removeEventListener("audioeditor:word", handleWordEvent);
        window.removeEventListener("audioeditor:stop", handleStopEvent);
      };
    }, []);
    
    // Group words into sentences for better caption display
    const captionLines = useMemo(() => {
      if (words.length === 0) return [];
      
      const lines: Array<{ words: typeof words; startIndex: number; endIndex: number }> = [];
      let currentLine: typeof words = [];
      let lineStartIndex = 0;
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        currentLine.push(word);
        
        // Break line after punctuation or every ~8-10 words
        const wordText = word.word.trim();
        const isPunctuation = /[.!?]$/.test(wordText);
        const shouldBreak = isPunctuation || currentLine.length >= 10;
        
        if (shouldBreak || i === words.length - 1) {
          lines.push({
            words: [...currentLine],
            startIndex: lineStartIndex,
            endIndex: i
          });
          currentLine = [];
          lineStartIndex = i + 1;
        }
      }
      
      return lines;
    }, [words]);
    
    // Find which line is currently playing
    const currentLineIndex = useMemo(() => {
      if (currentWordIndex === null) return null;
      return captionLines.findIndex(
        line => currentWordIndex >= line.startIndex && currentWordIndex <= line.endIndex
      );
    }, [currentWordIndex, captionLines]);
    
    if (words.length === 0) {
      return (
        <div 
          style={{ 
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--text-secondary)",
            fontSize: 14
          }}
        >
          No transcription available.
        </div>
      );
    }
    
    return (
      <div 
        style={{ 
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Animated Captions Overlay */}
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            maxWidth: "80%",
            textAlign: "center",
            zIndex: 10
          }}
        >
          {captionLines.map((line, lineIdx) => {
            const isActive = currentLineIndex === lineIdx;
            // Show current line and adjacent lines, or show all if not playing
            const isVisible = currentLineIndex === null 
              ? true 
              : Math.abs((currentLineIndex ?? -1) - lineIdx) <= 1;
            
            if (!isVisible) return null;
            
            return (
              <div
                key={`line-${lineIdx}`}
                style={{
                  marginBottom: lineIdx < captionLines.length - 1 ? "12px" : 0,
                  opacity: isActive ? 1 : (currentLineIndex !== null ? 0.3 : 0.6),
                  transform: isActive ? "scale(1)" : "scale(0.95)",
                  transition: "opacity 300ms ease, transform 300ms ease"
                }}
              >
                <div
                  style={{
                    display: "inline-block",
                    padding: "12px 24px",
                    background: isActive ? "rgba(0, 0, 0, 0.85)" : "rgba(0, 0, 0, 0.6)",
                    borderRadius: "8px",
                    backdropFilter: "blur(8px)",
                    border: isActive ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid rgba(255, 255, 255, 0.15)",
                    boxShadow: isActive ? "0 4px 16px rgba(0, 0, 0, 0.5)" : "0 2px 8px rgba(0, 0, 0, 0.3)"
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(20px, 3vw, 36px)",
                      fontWeight: isActive ? 600 : 400,
                      color: "#ffffff",
                      lineHeight: 1.4,
                      textShadow: "0 2px 8px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 0.8)",
                      letterSpacing: "0.5px"
                    }}
                  >
                    {line.words.map((word, wordIdx) => {
                      const wordOriginalIndex = (word as any).originalIndex ?? (line.startIndex + wordIdx);
                      const isWordActive = isActive && currentWordIndex === wordOriginalIndex;
                      
                      return (
                        <span
                          key={`word-${lineIdx}-${wordIdx}`}
                          style={{
                            color: isWordActive ? "#60a5fa" : "#ffffff",
                            fontWeight: isWordActive ? 700 : (isActive ? 600 : 400),
                            transition: "color 150ms ease, font-weight 150ms ease",
                            marginRight: "4px"
                          }}
                        >
                          {word.word}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
  const audioEditorRef = useRef<HTMLDivElement | null>(null);
  const [inlineEditorRatio, setInlineEditorRatio] = useState(
    getInitialInlineEditorRatio
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const editStudioVideoRef = useRef<HTMLVideoElement | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const shouldDiscardRecordingRef = useRef(false);
  const isMountedRef = useRef(true);
  const localAudioUrlRef = useRef<string | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingFileName, setRecordingFileName] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const formattedElapsed = useMemo(() => {
    const minutes = Math.floor(recordingElapsed / 60)
      .toString()
      .padStart(2, "0");
    const seconds = (recordingElapsed % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
  }, [recordingElapsed]);
  const [documentDirty, setDocumentDirty] = useState(false);
  const [folderDirty, setFolderDirty] = useState(false);
  const [documentSavingPath, setDocumentSavingPath] = useState<string | null>(
    null
  );
  const [folderSavingPath, setFolderSavingPath] = useState<string | null>(null);
  const documentSaveTimeoutRef = useRef<number | null>(null);
  const folderSaveTimeoutRef = useRef<number | null>(null);
  const documentLastSavedRef = useRef<DocumentSnapshot | null>(null);
  const folderLastSavedRef = useRef<FolderSnapshot | null>(null);
  const pendingDocumentSaveRef = useRef<{
    path: string;
    state: DocumentSnapshot;
  } | null>(null);
  const pendingFolderSaveRef = useRef<{
    path: string;
    state: FolderSnapshot;
  } | null>(null);
  const clearDocumentSaveTimeout = useCallback(() => {
    if (documentSaveTimeoutRef.current !== null) {
      window.clearTimeout(documentSaveTimeoutRef.current);
      documentSaveTimeoutRef.current = null;
    }
  }, []);
  const clearFolderSaveTimeout = useCallback(() => {
    if (folderSaveTimeoutRef.current !== null) {
      window.clearTimeout(folderSaveTimeoutRef.current);
      folderSaveTimeoutRef.current = null;
    }
  }, []);
  const clearRecordingTimer = useCallback(() => {
    if (recordingIntervalRef.current !== null) {
      window.clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    recordingStartRef.current = null;
    setRecordingElapsed(0);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.sidebarWidth,
      String(Math.round(sidebarWidth))
    );
  }, [sidebarWidth]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.instructionsWidth,
      instructionsRatio.toFixed(4)
    );
  }, [instructionsRatio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.inlineWidth,
      inlineRatio.toFixed(4)
    );
  }, [inlineRatio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.inlineEditorHeight,
      inlineEditorRatio.toFixed(4)
    );
  }, [inlineEditorRatio]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.inlineOrder,
      inlineBeforeDocument ? "true" : "false"
    );
  }, [inlineBeforeDocument]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        shouldDiscardRecordingRef.current = true;
        mediaRecorderRef.current.stop();
      }
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach((track) => track.stop());
        audioStreamRef.current = null;
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach((track) => track.stop());
        videoStreamRef.current = null;
      }
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = null;
      }
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
        localAudioUrlRef.current = null;
      }
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
      clearRecordingTimer();
    };
  }, [clearRecordingTimer]);

  useEffect(() => {
    if (selected?.type !== "document") {
      clearRecordingTimer();
      setAudioUrl(null);
      setVideoUrl(null);
      setAudioError(null);
      setRecordingFileName(null);
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
        localAudioUrlRef.current = null;
      }
      return;
    }
    // Load recordings array or fall back to legacy single audio/video
    const recordings = documentDetails?.recordings || [];
    let remoteUrl: string | null = null;
    if (recordings.length > 0) {
      // Use selected recording or latest
      const recordingToUse = selectedRecordingId 
        ? recordings.find(r => r.id === selectedRecordingId) || recordings[recordings.length - 1]
        : recordings[recordings.length - 1];
      remoteUrl = recordingToUse.audioUrl;
      setAudioUrl(recordingToUse.audioUrl);
      setVideoUrl(recordingToUse.videoUrl || null);
      setRecordingFileName(recordingToUse.audioFileName);
    } else {
      // Legacy support
      remoteUrl = documentDetails?.audioUrl ?? null;
      const remoteVideoUrl = documentDetails?.videoUrl ?? null;
      setAudioUrl(remoteUrl);
      setVideoUrl(remoteVideoUrl);
      setRecordingFileName(documentDetails?.audioFileName ?? null);
    }
    if (remoteUrl && localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current);
      localAudioUrlRef.current = null;
    }
  }, [
    selected?.type,
    selected?.path,
    documentDetails?.audioUrl,
    documentDetails?.videoUrl,
    documentDetails?.recordings,
    selectedRecordingId,
    documentDetails?.audioFileName,
    clearRecordingTimer
  ]);

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.load();
      setAudioCurrentTime(0);
      setAudioDuration(0);
    }
  }, [audioUrl]);

  // Track audio duration and current time
  useEffect(() => {
    const audioElement = audioPlayerRef.current;
    if (!audioElement || !audioUrl) return;

    const updateTime = () => {
      const currentTime = audioElement.currentTime;
      setAudioCurrentTime(currentTime);
      // Sync video with audio
      if (videoPreviewRef.current && (videoUrl || documentDetails?.videoUrl)) {
        const videoElement = videoPreviewRef.current;
        if (videoElement.src && Math.abs(videoElement.currentTime - currentTime) > 0.1) {
          videoElement.currentTime = currentTime;
        }
      }
    };

    const updateDuration = () => {
      setAudioDuration(audioElement.duration || 0);
    };

    const handlePlay = () => {
      updateTime();
      setIsPlaying(true);
    };

    const handlePause = () => {
      updateTime();
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setAudioCurrentTime(0);
      setIsPlaying(false);
      // Also stop video if it exists
      if (videoPreviewRef.current) {
        videoPreviewRef.current.pause();
        videoPreviewRef.current.currentTime = 0;
      }
    };

    audioElement.addEventListener('timeupdate', updateTime);
    audioElement.addEventListener('loadedmetadata', updateDuration);
    audioElement.addEventListener('durationchange', updateDuration);
    audioElement.addEventListener('play', handlePlay);
    audioElement.addEventListener('pause', handlePause);
    audioElement.addEventListener('ended', handleEnded);

    // Initial values
    updateDuration();
    updateTime();

    return () => {
      audioElement.removeEventListener('timeupdate', updateTime);
      audioElement.removeEventListener('loadedmetadata', updateDuration);
      audioElement.removeEventListener('durationchange', updateDuration);
      audioElement.removeEventListener('play', handlePlay);
      audioElement.removeEventListener('pause', handlePause);
      audioElement.removeEventListener('ended', handleEnded);
    };
  }, [audioUrl, videoUrl, documentDetails?.videoUrl]);

  // Handle video URL changes and ensure video loads properly (including when take is selected)
  // This effect specifically handles Recording Studio mode
  useEffect(() => {
    // Only handle video loading in Recording Studio mode
    if (currentMode !== "recording") return;
    
    const videoElement = videoPreviewRef.current;
    if (!videoElement) {
      console.log("Recording Studio: Video element not found in ref");
      return;
    }
    
    const videoSrc = videoUrl || documentDetails?.videoUrl;
    
    // If we're not recording and have a video URL, ensure video is set up
    if (!isRecordingAudio && videoSrc && recordingType === "audio+video") {
      // Always clear srcObject first to ensure recorded video can play
      if (videoElement.srcObject) {
        console.log("Recording Studio: Clearing srcObject");
        videoElement.srcObject = null;
        videoElement.pause();
      }
      
      // Get the full URL (handle both relative and absolute URLs)
      const currentSrc = videoElement.src || videoElement.getAttribute('src') || '';
      const srcToSet = videoSrc.startsWith('http') || videoSrc.startsWith('/') || videoSrc.startsWith('blob:')
        ? videoSrc
        : `/${videoSrc}`;
      
      // Always reload when src changes (e.g., when a different take is selected)
      if (currentSrc !== srcToSet) {
        console.log("Recording Studio: Setting video src and loading", {
          currentSrc,
          srcToSet,
          selectedRecordingId,
          videoElementVisible: videoElement.offsetParent !== null
        });
        videoElement.src = srcToSet;
        videoElement.load();
      } else {
        console.log("Recording Studio: Video src unchanged, but ensuring it's loaded", {
          src: srcToSet,
          readyState: videoElement.readyState,
          selectedRecordingId
        });
        // Even if src is the same, ensure video is loaded
        if (videoElement.readyState < 2) {
          videoElement.load();
        }
      }
    }
  }, [videoUrl, documentDetails?.videoUrl, isRecordingAudio, recordingType, selectedRecordingId, currentMode]);

  useEffect(() => {
    if (!isRecordingAudio) return;
    if (selected?.type !== "document") {
      shouldDiscardRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
      setIsRecordingAudio(false);
    }
  }, [isRecordingAudio, selected?.type]);

  const stopMediaStream = () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach((track) => track.stop());
      videoStreamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
  };

  const uploadRecording = useCallback(
    async (blob: Blob, previewUrl: string | null) => {
      const pathForUpload =
        documentDetails?.path ??
        (selected?.type === "document" ? selected.path : null);
      if (!pathForUpload) {
        setAudioError("Select a document before recording audio.");
        return;
      }
      console.log("[Recorder] upload start", {
        pathForUpload,
        blobSize: blob.size
      });
      const optimisticFileName = buildOptimisticAudioFileName(
        documentDetails?.name ??
          (selected?.type === "document" ? selected.name : undefined),
        blob.type
      );
      setRecordingFileName(optimisticFileName);
      setIsUploadingAudio(true);
      setAudioError(null);
      try {
        console.log("[Recorder] sending form data", {
          pathForUpload,
          mimeType: blob.type,
          optimisticFileName
        });
        // Always append new recordings
        const hasExistingRecordings = documentDetails?.recordings && documentDetails.recordings.length > 0;
        const result = await uploadDocumentAudio(pathForUpload, blob, true);
        if (!isMountedRef.current) return;
        console.log("[Recorder] upload success", result.audioUrl, result.recording);
        if (previewUrl && localAudioUrlRef.current === previewUrl) {
          URL.revokeObjectURL(previewUrl);
          localAudioUrlRef.current = null;
        }
        
        // Update recordings array
        const existingRecordings = documentDetails?.recordings || [];
        const newRecording = result.recording || {
          id: result.recordingId || `rec_${Date.now()}`,
          audioUrl: result.audioUrl,
          audioFileName: result.audioFileName,
          type: recordingType,
          createdAt: Date.now(),
          ...(recordingType === "audio+video" ? { videoUrl: result.audioUrl, videoFileName: result.audioFileName } : {})
        };
        
        const updatedRecordings = [...existingRecordings, newRecording];
        
        if (recordingType === "audio+video") {
          setVideoUrl(result.audioUrl);
          setAudioUrl(result.audioUrl);
        } else {
          setAudioUrl(result.audioUrl);
        }
        setRecordingFileName(result.audioFileName);
        setDocumentDetails((prev) =>
          prev
            ? {
                ...prev,
                audioUrl: result.audioUrl, // Latest for backward compatibility
                audioFileName: result.audioFileName,
                ...(recordingType === "audio+video" ? { videoUrl: result.audioUrl } : {}),
                recordings: updatedRecordings
              }
            : prev
        );
        setStatus({
          type: "success",
          message: `${recordingType === "audio+video" ? "Video" : "Audio"} recording added to this document`
        });
      } catch (error) {
        console.error("[Recorder] upload error", error);
        if (!isMountedRef.current) return;
        const message =
          error instanceof Error
            ? error.message
            : "Unable to save audio recording.";
        setAudioError(message);
        setStatus({ type: "error", message });
        setRecordingFileName(null);
      } finally {
        if (isMountedRef.current) {
          setIsUploadingAudio(false);
        }
        console.log("[Recorder] upload end");
      }
    },
    [documentDetails?.path, selected?.type, selected?.path]
  );

  const startRecording = useCallback(async () => {
    if (
      isRecordingAudio ||
      isUploadingAudio ||
      selected?.type !== "document"
    ) {
      return;
    }
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== "function" ||
      typeof window.MediaRecorder === "undefined"
    ) {
      setAudioError("Recording is not supported in this browser.");
      return;
    }
    try {
      const constraints: MediaStreamConstraints = { 
        audio: selectedAudioDeviceId === "default" 
          ? true 
          : { deviceId: { exact: selectedAudioDeviceId } },
        video: recordingType === "audio+video" ? {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          facingMode: "user",
          ...(selectedVideoDeviceId !== "default" ? { deviceId: { exact: selectedVideoDeviceId } } : {})
        } : false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      audioStreamRef.current = stream;
      if (recordingType === "audio+video") {
        videoStreamRef.current = stream;
      }
      
      // Set up video preview if recording video
      if (recordingType === "audio+video" && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(console.error);
      }
      
      const recorder = new MediaRecorder(stream, {
        mimeType: recordingType === "audio+video" 
          ? (MediaRecorder.isTypeSupported("video/webm") ? "video/webm" : "video/mp4")
          : (MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4")
      });
      mediaRecorderRef.current = recorder;
      shouldDiscardRecordingRef.current = false;
      audioChunksRef.current = [];
      videoChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(
            "[Recorder] ondataavailable chunk",
            event.data.size,
            event.data.type
          );
          if (recordingType === "audio+video") {
            videoChunksRef.current.push(event.data);
          } else {
            audioChunksRef.current.push(event.data);
          }
        } else {
          console.log("[Recorder] ondataavailable zero-size chunk");
        }
      };
      recorder.onerror = (event) => {
        console.error("MediaRecorder error", event.error);
        stopMediaStream();
        audioChunksRef.current = [];
        if (!isMountedRef.current) return;
        setIsRecordingAudio(false);
        setAudioError(
          event.error?.message ?? "Recording failed. Please try again."
        );
      };
      recorder.onstop = () => {
        console.log(
          "[Recorder] onstop triggered, chunks:",
          audioChunksRef.current.length
        );
        const discard = shouldDiscardRecordingRef.current;
        shouldDiscardRecordingRef.current = false;
        stopMediaStream();
        
        // Explicitly clear video preview srcObject and pause to ensure recorded video can load
        if (videoPreviewRef.current && recordingType === "audio+video") {
          videoPreviewRef.current.srcObject = null;
          videoPreviewRef.current.pause();
          videoPreviewRef.current.currentTime = 0;
          console.log("[Recorder] Cleared video preview srcObject after recording stop");
        }
        
        const chunks = recordingType === "audio+video" 
          ? videoChunksRef.current.slice() 
          : audioChunksRef.current.slice();
        if (recordingType === "audio+video") {
          videoChunksRef.current = [];
        } else {
          audioChunksRef.current = [];
        }
        console.log("[Recorder] onstop details", {
          discard,
          chunkCount: chunks.length,
          isMounted: isMountedRef.current,
          recordingType
        });
        if (!isMountedRef.current) {
          console.warn("[Recorder] upload skipped: component unmounted");
          return;
        }
        setIsRecordingAudio(false);
        clearRecordingTimer();
        
        if (discard || chunks.length === 0) {
          if (!discard && chunks.length === 0) {
            setAudioError(
              `No ${recordingType === "audio+video" ? "video" : "audio"} data was captured. Please try recording again.`
            );
            console.warn("[Recorder] upload skipped: empty chunks");
          }
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        console.log(
          "[Recorder] Captured blob",
          blob.size,
          recorder.mimeType,
          recordingType
        );
        if (recordingType === "audio+video") {
          if (videoUrl) {
            URL.revokeObjectURL(videoUrl);
          }
          const previewUrl = URL.createObjectURL(blob);
          setVideoUrl(previewUrl);
          // Also extract audio for audioUrl
          if (localAudioUrlRef.current) {
            URL.revokeObjectURL(localAudioUrlRef.current);
            localAudioUrlRef.current = null;
          }
          // For now, use the same blob for audio (will be separated on server)
          localAudioUrlRef.current = previewUrl;
          setAudioUrl(previewUrl);
          
          // Set the video element src to the preview URL after a short delay
          // to ensure the element is ready and srcObject is cleared
          setTimeout(() => {
            if (videoPreviewRef.current && !videoPreviewRef.current.srcObject) {
              const videoElement = videoPreviewRef.current;
              if (videoElement.src !== previewUrl) {
                videoElement.src = previewUrl;
                videoElement.load();
                console.log("[Recorder] Set video element src to preview URL", previewUrl);
              }
            }
          }, 50);
        } else {
          if (localAudioUrlRef.current) {
            URL.revokeObjectURL(localAudioUrlRef.current);
            localAudioUrlRef.current = null;
          }
          const previewUrl = URL.createObjectURL(blob);
          localAudioUrlRef.current = previewUrl;
          setAudioUrl(previewUrl);
        }
        console.log("[Recorder] calling uploadRecording");
        uploadRecording(blob, recordingType === "audio+video" ? videoUrl || "" : localAudioUrlRef.current || "")
          .then(() => {
            console.log("[Recorder] upload promise resolved");
          })
          .catch((error) => {
            console.error("[Recorder] upload promise rejected", error);
          });
      };
      recorder.start();
      console.log("[Recorder] started", recorder.mimeType);
      setIsRecordingAudio(true);
      setAudioError(null);
      recordingStartRef.current = Date.now();
      setRecordingElapsed(0);
      if (recordingIntervalRef.current !== null) {
        window.clearInterval(recordingIntervalRef.current);
      }
      recordingIntervalRef.current = window.setInterval(() => {
        if (!recordingStartRef.current) return;
        setRecordingElapsed(
          Math.floor((Date.now() - recordingStartRef.current) / 1000)
        );
      }, 250);
    } catch (error) {
      stopMediaStream();
      const message =
        error instanceof Error
          ? error.message.includes("denied")
            ? "Microphone permission denied."
            : error.message
          : "Unable to access the microphone.";
      setAudioError(message);
    }
  }, [
    documentDetails,
    isRecordingAudio,
    isUploadingAudio,
    selected?.type,
    uploadRecording,
    recordingType,
    selectedAudioDeviceId,
    selectedVideoDeviceId
  ]);

  const stopRecording = useCallback(() => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }
    console.log("[Recorder] stop requested");
    shouldDiscardRecordingRef.current = false;
    if (mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.requestData();
      } catch (error) {
        console.warn("requestData failed", error);
      }
    }
    mediaRecorderRef.current.stop();
    setIsRecordingAudio(false);
    clearRecordingTimer();
  }, [clearRecordingTimer]);

  const cancelRecording = useCallback(() => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === "inactive"
    ) {
      return;
    }
    console.log("[Recorder] cancel requested");
    shouldDiscardRecordingRef.current = true;
    if (mediaRecorderRef.current.state === "recording") {
      try {
        mediaRecorderRef.current.requestData();
      } catch (error) {
        console.warn("requestData failed", error);
      }
    }
    mediaRecorderRef.current.stop();
    setIsRecordingAudio(false);
    clearRecordingTimer();
  }, [clearRecordingTimer]);

  const handlePlayAudio = useCallback(() => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.currentTime = Math.max(
      audioPlayerRef.current.currentTime,
      0
    );
    audioPlayerRef.current
      .play()
      .then(() => {
        setAudioError(null);
        setIsPlaying(true);
        // Also play video if it exists
        const audioEl = audioPlayerRef.current;
        if (videoPreviewRef.current && audioEl && (videoUrl || documentDetails?.videoUrl) && recordingType === "audio+video") {
          const videoElement = videoPreviewRef.current;
          
          // Clear srcObject if it exists (from live preview)
          if (videoElement.srcObject) {
            videoElement.srcObject = null;
          }
          
          // Ensure src is set
          const videoSrc = videoUrl || documentDetails?.videoUrl;
          if (videoSrc && !videoElement.src && !videoElement.getAttribute('src')) {
            videoElement.src = videoSrc;
            videoElement.load();
          }
          
          // Wait for video to be ready, then play
          const tryPlayVideo = () => {
            if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA or better
              videoElement.currentTime = audioEl.currentTime;
              videoElement.play().catch((err) => {
                console.error("Error playing video:", err);
              });
            } else {
              videoElement.addEventListener('loadeddata', () => {
                videoElement.currentTime = audioEl.currentTime;
                videoElement.play().catch((err) => {
                  console.error("Error playing video:", err);
                });
              }, { once: true });
              videoElement.load();
            }
          };
          
          tryPlayVideo();
        }
      })
      .catch(() => {
        setAudioError("Unable to play audio. Try downloading instead.");
        setIsPlaying(false);
      });
  }, [videoUrl, documentDetails?.videoUrl]);

  const handlePauseAudio = useCallback(() => {
    audioPlayerRef.current?.pause();
    setIsPlaying(false);
    // Also pause video if it exists
    if (videoPreviewRef.current) {
      videoPreviewRef.current.pause();
    }
  }, []);

  const handleRewindAudio = useCallback(() => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.pause();
    audioPlayerRef.current.currentTime = 0;
    setIsPlaying(false);
    // Also rewind video if it exists
    if (videoPreviewRef.current) {
      videoPreviewRef.current.pause();
      videoPreviewRef.current.currentTime = 0;
    }
  }, []);

  const previousDocumentPathRef = useRef<string | null>(null);
  useEffect(() => {
    const currentDocumentPath =
      selected?.type === "document" ? selected.path : null;
    if (
      previousDocumentPathRef.current &&
      currentDocumentPath &&
      previousDocumentPathRef.current !== currentDocumentPath &&
      isRecordingAudio
    ) {
      cancelRecording();
    }
    previousDocumentPathRef.current = currentDocumentPath;
  }, [selected?.path, selected?.type, isRecordingAudio, cancelRecording]);

  const audioStatusText = isUploadingAudio
    ? "Uploading…"
    : isRecordingAudio
    ? `Recording ${formattedElapsed}`
    : audioUrl
    ? "Audio ready"
    : null;

  const audioStatusClass = clsx("audio-status", {
    recording: isRecordingAudio,
    uploading: isUploadingAudio,
    ready: !isRecordingAudio && !isUploadingAudio && audioUrl
  });

  const hasAudio = Boolean(audioUrl);
  const canStartRecording =
    selected?.type === "document" &&
    Boolean(documentDetails) &&
    !isRecordingAudio &&
    !isUploadingAudio;

  const aggregatedInstructions = useMemo(() => {
    if (selected?.type === "document") {
      return documentDetails?.aggregatedInstructions ?? "";
    }
    if (selected?.type === "folder") {
      return folderDetails?.aggregatedInstructions ?? "";
    }
    return "";
  }, [selected, documentDetails, folderDetails]);

  const aggregatedPreview = useMemo(() => {
    if (aggregatedInstructions.trim()) return aggregatedInstructions;
    if (selected) {
      return "No instructions defined for this selection yet.";
    }
    return "Select a folder or document to see aggregated instructions.";
  }, [aggregatedInstructions, selected]);

  const paragraphEntries = useMemo(() => {
    if (!inlineActionsEnabled || selected?.type !== "document") return [];
    const content = documentDetails?.content ?? "";
    return content
      .split(/\n{2,}/)
      .map((text, index) => ({
        id: `${index}-${text.slice(0, 8)}`,
        text: text.trim()
      }))
      .filter((entry) => entry.text.length > 0);
  }, [selected?.type, documentDetails?.content, inlineActionsEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const nodes =
      document.querySelectorAll<HTMLTextAreaElement>(".paragraph-card-textarea");
    nodes.forEach((element) => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    });
  }, [paragraphEntries]);

  useEffect(() => {
    setSelectionMenu(null);
  }, [selected?.path]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selected) {
      window.localStorage.setItem(
        STORAGE_KEYS.lastSelection,
        JSON.stringify({ type: selected.type, path: selected.path })
      );
    } else {
      window.localStorage.removeItem(STORAGE_KEYS.lastSelection);
    }
  }, [selected?.path, selected?.type]);

  useEffect(() => {
    if (selected || tree.length === 0) return;
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEYS.lastSelection);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        type: Selection["type"];
        path: string;
      };
      if (!parsed?.path || !parsed?.type) return;
      const node = findNodeByPath(tree, parsed.path);
      if (!node || node.type !== parsed.type) {
        window.localStorage.removeItem(STORAGE_KEYS.lastSelection);
        return;
      }
      if (node.type === "document") {
        setSelected({
          type: "document",
          path: node.path,
          name: node.name
        });
      } else {
        setSelected({
          type: "folder",
          path: node.path,
          name: node.name,
          color: node.color ?? undefined
        });
      }
    } catch {
      window.localStorage.removeItem(STORAGE_KEYS.lastSelection);
    }
  }, [selected, tree]);

  // Save panel visibility states to localStorage
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEYS.instructionsVisible, String(instructionsVisible));
  }, [instructionsVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEYS.documentVisible, String(documentVisible));
  }, [documentVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEYS.inlineEditorVisible, String(inlineEditorVisible));
  }, [inlineEditorVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEYS.chatVisible, String(chatVisible));
  }, [chatVisible]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(LS_KEYS.audioEditorVisible, String(audioEditorVisible));
  }, [audioEditorVisible]);

  useEffect(() => {
    if (selected?.type === "document") {
      setDocumentNameInput(selected.name);
    } else {
      setDocumentNameInput("");
    }
  }, [selected?.type, selected?.name]);

  useEffect(() => {
    if (selected?.type === "folder" && folderDetails) {
      if (folderDetails.color) {
        setFolderColorInput(folderDetails.color);
        setFolderColorCustom(true);
      } else {
        setFolderColorInput(DEFAULT_FOLDER_COLOR);
        setFolderColorCustom(false);
      }
    }
    if (selected?.type !== "folder") {
      setFolderColorInput(DEFAULT_FOLDER_COLOR);
      setFolderColorCustom(false);
    }
  }, [selected?.type, folderDetails?.color]);

  useEffect(() => {
    if (!inlineActionsEnabled) {
      setSelectionMenu(null);
    }
  }, [inlineActionsEnabled]);

  useEffect(() => {
    if (variantModal) {
      setSelectionMenu(null);
    }
  }, [variantModal]);

  useEffect(() => {
    if (showAggregated) {
      setSelectionMenu(null);
    }
  }, [showAggregated]);

  useEffect(() => {
    const hideMenu = () => setSelectionMenu(null);
    window.addEventListener("scroll", hideMenu, true);
    window.addEventListener("resize", hideMenu);
    return () => {
      window.removeEventListener("scroll", hideMenu, true);
      window.removeEventListener("resize", hideMenu);
    };
  }, []);

  const currentInstructions = useMemo(() => {
    if (selected?.type === "document") {
      return documentDetails?.instructions ?? "";
    }
    if (selected?.type === "folder") {
      return folderDetails?.instructions ?? "";
    }
    return "";
  }, [selected, documentDetails, folderDetails]);

  const currentDocumentContent =
    selected?.type === "document"
      ? documentDetails?.content ?? ""
      : "";

  const showDocumentPanel = selected?.type === "document";

  const showFolderPanel = selected?.type === "folder";

  const mainContentRef = useRef<HTMLDivElement | null>(null);
  const inlinePanelRef = useRef<HTMLDivElement | null>(null);
  const hasEditableInstructions = showFolderPanel || showDocumentPanel;
  const inlinePanelVisible = inlineEditorVisible || chatVisible;
  const isDocumentSelected = selected?.type === "document";
  const isFolderSelected = selected?.type === "folder";
  const currentDocumentSaving =
    isDocumentSelected && documentSavingPath === selected?.path;
  const currentFolderSaving =
    isFolderSelected && folderSavingPath === selected?.path;
  const currentDocumentDirty = isDocumentSelected && documentDirty;
  const currentFolderDirty = isFolderSelected && folderDirty;
  const instructionsSaving = showFolderPanel
    ? currentFolderSaving
    : showDocumentPanel
    ? currentDocumentSaving
    : false;
  const instructionsDirty = showFolderPanel
    ? currentFolderDirty
    : showDocumentPanel
    ? currentDocumentDirty
    : false;
  const instructionsAutosaveLabel = instructionsSaving
    ? "Saving…"
    : instructionsDirty
    ? "Unsaved changes"
    : "All changes saved";
  const instructionsAutosaveClass = instructionsSaving
    ? "saving"
    : instructionsDirty
    ? "dirty"
    : "saved";
  const documentAutosaveLabel = currentDocumentSaving
    ? "Saving…"
    : currentDocumentDirty
    ? "Unsaved changes"
    : "All changes saved";
  const documentAutosaveClass = currentDocumentSaving
    ? "saving"
    : currentDocumentDirty
    ? "dirty"
    : "saved";
  const fallbackStatusMessage = loadingSelection
    ? "Loading selection..."
    : currentDocumentSaving || currentFolderSaving
    ? "Saving changes…"
    : currentDocumentDirty || currentFolderDirty
    ? "Unsaved changes will auto-save shortly."
    : "Ready to write mindful experiences.";
  const audioEditorShare = audioEditorVisible ? audioEditorRatio : 0;
  const instructionsShare = instructionsVisible ? instructionsRatio : 0;
  const inlineShare = inlinePanelVisible ? inlineRatio : 0;
  const baseDocumentShare = documentVisible
    ? Math.max(MIN_DOCUMENT_RATIO, 1 - audioEditorShare - instructionsShare - inlineShare)
    : 0;
  const totalShare =
    (audioEditorVisible ? audioEditorShare : 0) +
    (instructionsVisible ? instructionsShare : 0) +
      (documentVisible ? baseDocumentShare : 0) +
      (inlinePanelVisible ? inlineShare : 0) || 1;
  const audioEditorFlexBasis = audioEditorVisible
    ? `${(audioEditorShare / totalShare) * 100}%`
    : undefined;
  const instructionsFlexBasis = instructionsVisible
    ? `${(instructionsShare / totalShare) * 100}%`
    : undefined;
  const documentFlexBasis = documentVisible
    ? `${(baseDocumentShare / totalShare) * 100}%`
    : undefined;
  const inlineFlexBasis = inlinePanelVisible
    ? `${(inlineShare / totalShare) * 100}%`
    : undefined;
  const instructionsPlaceholder = showFolderPanel
    ? "Add folder-specific instructions that are applied to documents inside this folder."
    : showDocumentPanel
    ? "Add document-specific instructions that refine the prompt."
    : "Select a folder or document to edit its instructions.";
  const instructionsValue = hasEditableInstructions
    ? currentInstructions
    : aggregatedPreview;
  const selectedName = selected?.name ?? "Document";

  const refreshTree = useCallback(async () => {
    try {
      const treeData = await fetchTree();
      setTree(treeData);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load data";
      setStatus({ type: "error", message });
    }
  }, []);

  useEffect(() => {
    refreshTree();
  }, [refreshTree]);

  const performDocumentSave = useCallback(
    async (path: string, snapshot: DocumentSnapshot) => {
      clearDocumentSaveTimeout();
      pendingDocumentSaveRef.current = null;
      const previousSnapshot = documentLastSavedRef.current;
      const shouldRefreshTree =
        previousSnapshot?.completed !== snapshot.completed;
      setDocumentSavingPath(path);
      try {
        await saveDocument(path, snapshot.content, snapshot.instructions, {
          completed: snapshot.completed
        });
        if (shouldRefreshTree) {
          await refreshTree();
        }
        if (selected?.type === "document" && selected.path === path) {
          documentLastSavedRef.current = snapshot;
          setDocumentDirty(false);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save document";
        setStatus({ type: "error", message });
        pendingDocumentSaveRef.current = { path, state: snapshot };
      } finally {
        setDocumentSavingPath((prev) => (prev === path ? null : prev));
      }
    },
    [
      clearDocumentSaveTimeout,
      refreshTree,
      selected?.path,
      selected?.type,
      setStatus
    ]
  );

  const performFolderSave = useCallback(
    async (path: string, snapshot: FolderSnapshot) => {
      clearFolderSaveTimeout();
      pendingFolderSaveRef.current = null;
      const previousSnapshot = folderLastSavedRef.current;
      const colorChanged =
        (previousSnapshot?.color ?? null) !== (snapshot.color ?? null);
      setFolderSavingPath(path);
      try {
        await saveFolderInstructions(
          path,
          snapshot.instructions,
          snapshot.color ?? ""
        );
        if (colorChanged) {
          await refreshTree();
          setSelected((prev) =>
            prev && prev.type === "folder" && prev.path === path
              ? { ...prev, color: snapshot.color ?? undefined }
              : prev
          );
        }
        if (selected?.type === "folder" && selected.path === path) {
          folderLastSavedRef.current = snapshot;
          setFolderDirty(false);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to save folder";
        setStatus({ type: "error", message });
        pendingFolderSaveRef.current = { path, state: snapshot };
      } finally {
        setFolderSavingPath((prev) => (prev === path ? null : prev));
      }
    },
    [
      clearFolderSaveTimeout,
      refreshTree,
      selected?.path,
      selected?.type,
      setSelected,
      setStatus
    ]
  );

  useEffect(() => {
    if (!draggingResizer) return;

    const handleMove = (event: MouseEvent) => {
      if (draggingResizer === "sidebar") {
        const next = clamp(event.clientX, MIN_SIDEBAR_WIDTH, MAX_SIDEBAR_WIDTH);
        setSidebarWidth(next);
        return;
      }
      if (
        (draggingResizer === "instructions" ||
          draggingResizer === "inline" ||
          draggingResizer === "audioEditor") &&
        mainContentRef.current
      ) {
        const rect = mainContentRef.current.getBoundingClientRect();
        const offset = event.clientX - rect.left;
        const width = rect.width;
        if (width <= 0) {
          return;
        }

        if (draggingResizer === "instructions") {
          const maxInstructions = Math.max(
            MIN_INSTRUCTIONS_RATIO,
            1 - audioEditorRatio - inlineRatio - MIN_DOCUMENT_RATIO
          );
          const desired =
            offset / width < 0
              ? MIN_INSTRUCTIONS_RATIO
              : offset / width;
          const clamped = clamp(desired, MIN_INSTRUCTIONS_RATIO, maxInstructions);
          const [inst, inl] = normalizeRatios(clamped, inlineRatio);
          setInstructionsRatio(inst);
          setInlineRatio(inl);
        } else if (draggingResizer === "audioEditor") {
          const desiredAudio =
            offset / width < 0
              ? 0.18
              : offset / width;
          const maxAudio = Math.max(
            0.18,
            1 - instructionsRatio - inlineRatio - MIN_DOCUMENT_RATIO
          );
          const clamped = clamp(desiredAudio, 0.18, maxAudio);
          setAudioEditorRatio(clamped);
        } else if (draggingResizer === "inline") {
          const desiredInline =
            offset / width > 1
              ? MIN_INLINE_RATIO
              : 1 - offset / width;
          const maxInline = Math.max(
            MIN_INLINE_RATIO,
            1 - instructionsRatio - audioEditorRatio - MIN_DOCUMENT_RATIO
          );
          const clamped = clamp(desiredInline, MIN_INLINE_RATIO, maxInline);
          const [inst, inl] = normalizeRatios(instructionsRatio, clamped);
          setInstructionsRatio(inst);
          setInlineRatio(inl);
        }
        return;
      }
      if (
        draggingResizer === "inlineHeight" &&
        inlinePanelRef.current &&
        inlineEditorVisible &&
        chatVisible
      ) {
        const rect = inlinePanelRef.current.getBoundingClientRect();
        const offset = event.clientY - rect.top;
        const height = rect.height;
        if (height <= 0) {
          return;
        }
        const desiredRatio = clamp(
          offset / height,
          MIN_INLINE_EDITOR_RATIO,
          MAX_INLINE_EDITOR_RATIO
        );
        setInlineEditorRatio(desiredRatio);
      }
    };

    const handleUp = () => {
      setDraggingResizer(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    const cursor =
      draggingResizer === "inlineHeight" ? "row-resize" : "col-resize";
    document.body.style.cursor = cursor;
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [
    draggingResizer,
    instructionsRatio,
    inlineRatio,
    audioEditorRatio,
    inlineEditorVisible,
    chatVisible
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      LS_KEYS.audioEditorWidth,
      audioEditorRatio.toFixed(4)
    );
  }, [audioEditorRatio]);

  useEffect(() => {
    const keys = loadApiKeys();
    if (keys.openai) {
      setUserApiKey(keys.openai);
      setSettingsKey(keys.openai);
    }
  }, []);

  useEffect(() => {
    if (isSettingsOpen) {
      const keys = loadApiKeys();
      setSettingsKey(keys.openai);
    }
  }, [isSettingsOpen]);

  useEffect(() => {
    let timer: number | undefined;
    if (status) {
      timer = window.setTimeout(() => setStatus(null), COMMON_STATUS_TIMEOUT);
    }
    return () => {
      if (timer) {
        window.clearTimeout(timer);
      }
    };
  }, [status]);

  useEffect(() => {
    const fetchDetails = async () => {
      if (!selected) {
        setFolderDetails(null);
        setDocumentDetails(null);
        documentLastSavedRef.current = null;
        folderLastSavedRef.current = null;
        pendingDocumentSaveRef.current = null;
        pendingFolderSaveRef.current = null;
        clearDocumentSaveTimeout();
        clearFolderSaveTimeout();
        setDocumentDirty(false);
        setFolderDirty(false);
        setDocumentSavingPath(null);
        setFolderSavingPath(null);
        return;
      }

      setLoadingSelection(true);
      try {
        if (selected.type === "folder") {
          clearFolderSaveTimeout();
          pendingFolderSaveRef.current = null;
          const details = await getFolderDetails(selected.path);
          setFolderDetails(details);
          setFolderColorInput(details.color ?? DEFAULT_FOLDER_COLOR);
          setFolderColorCustom(Boolean(details.color));
          setDocumentDetails(null);
          folderLastSavedRef.current = toFolderSnapshot(details);
          setFolderDirty(false);
          setFolderSavingPath((prev) => (prev === selected.path ? null : prev));
          documentLastSavedRef.current = null;
          setDocumentDirty(false);
        } else {
          clearDocumentSaveTimeout();
          pendingDocumentSaveRef.current = null;
          const details = await getDocumentDetails(selected.path);
          setDocumentDetails(details);
          setRecordingFileName(details.audioFileName ?? null);
          setFolderDetails(null);
          documentLastSavedRef.current = toDocumentSnapshot(details);
          setDocumentDirty(false);
          setDocumentSavingPath((prev) =>
            prev === selected.path ? null : prev
          );
          folderLastSavedRef.current = null;
          setFolderDirty(false);
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unable to load item";
        setStatus({ type: "error", message });
      } finally {
        setLoadingSelection(false);
      }
    };

    void fetchDetails();
  }, [selected]);

  useEffect(() => {
    if (selected?.type !== "document" || !documentDetails) {
      pendingDocumentSaveRef.current = null;
      clearDocumentSaveTimeout();
      setDocumentDirty(false);
      return;
    }
    if (documentDetails.path !== selected.path) {
      return;
    }
    const snapshot = toDocumentSnapshot(documentDetails);
    const savedSnapshot = documentLastSavedRef.current;
    const isDirty =
      !savedSnapshot ||
      savedSnapshot.content !== snapshot.content ||
      savedSnapshot.instructions !== snapshot.instructions ||
      savedSnapshot.completed !== snapshot.completed;
    setDocumentDirty(isDirty);
    if (!isDirty) {
      pendingDocumentSaveRef.current = null;
      clearDocumentSaveTimeout();
      return;
    }
    pendingDocumentSaveRef.current = { path: selected.path, state: snapshot };
    clearDocumentSaveTimeout();
    documentSaveTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingDocumentSaveRef.current;
      if (!pending) return;
      pendingDocumentSaveRef.current = null;
      void performDocumentSave(pending.path, pending.state);
    }, AUTO_SAVE_DELAY_MS);
  }, [
    documentDetails,
    selected?.type,
    selected?.path,
    clearDocumentSaveTimeout,
    performDocumentSave
  ]);

  useEffect(() => {
    if (selected?.type !== "folder" || !folderDetails) {
      pendingFolderSaveRef.current = null;
      clearFolderSaveTimeout();
      setFolderDirty(false);
      return;
    }
    if (folderDetails.path !== selected.path) {
      return;
    }
    const snapshot = toFolderSnapshot(folderDetails);
    const savedSnapshot = folderLastSavedRef.current;
    const isDirty =
      !savedSnapshot ||
      savedSnapshot.instructions !== snapshot.instructions ||
      (savedSnapshot.color ?? null) !== (snapshot.color ?? null);
    setFolderDirty(isDirty);
    if (!isDirty) {
      pendingFolderSaveRef.current = null;
      clearFolderSaveTimeout();
      return;
    }
    pendingFolderSaveRef.current = { path: selected.path, state: snapshot };
    clearFolderSaveTimeout();
    folderSaveTimeoutRef.current = window.setTimeout(() => {
      const pending = pendingFolderSaveRef.current;
      if (!pending) return;
      pendingFolderSaveRef.current = null;
      void performFolderSave(pending.path, pending.state);
    }, AUTO_SAVE_DELAY_MS);
  }, [
    folderDetails,
    selected?.type,
    selected?.path,
    clearFolderSaveTimeout,
    performFolderSave
  ]);

  useEffect(() => {
    return () => {
      clearDocumentSaveTimeout();
      clearFolderSaveTimeout();
    };
  }, [clearDocumentSaveTimeout, clearFolderSaveTimeout]);

  const handleToggle = (path: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleSelect = (item: Selection) => {
    const switchingToDifferentItem = selected?.path
      ? selected.path !== item.path
      : true;
    if (
      switchingToDifferentItem &&
      selected?.type === "document" &&
      documentDetails &&
      (documentDirty ||
        documentSaveTimeoutRef.current !== null ||
        pendingDocumentSaveRef.current)
    ) {
      const snapshot = toDocumentSnapshot(documentDetails);
      clearDocumentSaveTimeout();
      pendingDocumentSaveRef.current = null;
      void performDocumentSave(selected.path, snapshot);
    }
    if (
      switchingToDifferentItem &&
      selected?.type === "folder" &&
      folderDetails &&
      (folderDirty ||
        folderSaveTimeoutRef.current !== null ||
        pendingFolderSaveRef.current)
    ) {
      const snapshot = toFolderSnapshot(folderDetails);
      clearFolderSaveTimeout();
      pendingFolderSaveRef.current = null;
      void performFolderSave(selected.path, snapshot);
    }
    setSelected(item);
    if (!switchingToDifferentItem) {
      return;
    }
    setDocumentDetails(null);
    setFolderDetails(null);
  };

  const handleGenerateForDocument = async () => {
    if (selected?.type !== "document" || !documentDetails) return;
    setIsDocGenerating(true);
    try {
      const response = await generateAnswer({
        path: selected.path,
        prompt:
          "Generate updated content for this document following all aggregated instructions.",
        apiKey: userApiKey || undefined
      });
      setDocumentDetails((prev) =>
        prev
          ? {
              ...prev,
              content: prev.content
                ? `${prev.content}\n\n${response.message}`
                : response.message
            }
          : prev
      );
      setStatus({
        type: "success",
        message: "Generated content added to document"
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate content";
      setStatus({ type: "error", message });
    } finally {
      setIsDocGenerating(false);
    }
  };

  const handleToggleCompleted = (checked: boolean) => {
    if (selected?.type !== "document" || !documentDetails) return;
    setDocumentDetails({
      ...documentDetails,
      completed: checked
    });
  };

  const promptForName = (label: string) => {
    const value = window.prompt(label);
    if (!value) return null;
    return value.trim();
  };

  const handleCreateFolder = async () => {
    const name = promptForName("Folder name");
    if (!name) return;

    const parentPath =
      selected && selected.type === "folder"
        ? selected.path
        : selected && selected.type === "document"
        ? selected.path.split("/").slice(0, -1).join("/") || null
        : null;

    try {
      await createFolder(parentPath, name);
      setStatus({ type: "success", message: "Folder created" });
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create folder";
      setStatus({ type: "error", message });
    }
  };

  const handleCreateDocument = async () => {
    const name = promptForName("Document name (without extension)");
    if (!name) return;

    const folderPath =
      selected && selected.type === "folder"
        ? selected.path
        : selected && selected.type === "document"
        ? selected.path.split("/").slice(0, -1).join("/") || null
        : null;

    try {
      const fileName = name.endsWith(".txt") ? name : `${name}.txt`;
      await createDocument(folderPath, fileName);
      setStatus({ type: "success", message: "Document created" });
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to create document";
      setStatus({ type: "error", message });
    }
  };

  const handleFolderColorChange = (value: string) => {
    setFolderColorInput(value);
    setFolderColorCustom(true);
    if (folderDetails) {
      setFolderDetails({
        ...folderDetails,
        color: value
      });
    }
  };

  const handleFolderColorReset = () => {
    setFolderColorInput(DEFAULT_FOLDER_COLOR);
    setFolderColorCustom(false);
    if (folderDetails) {
      setFolderDetails({
        ...folderDetails,
        color: null
      });
    }
  };

  const handleRename = async (item: Selection) => {
    const label =
      item.type === "folder" ? "New folder name" : "New document name";
    const value = promptForName(label);
    if (!value) return;
    const finalName =
      item.type === "document" && !value.endsWith(".txt")
        ? `${value}.txt`
        : value;
    try {
      const result =
        item.type === "folder"
          ? await renameFolder(item.path, finalName)
          : await renameDocument(item.path, finalName);
      setStatus({
        type: "success",
        message: `${item.type === "folder" ? "Folder" : "Document"} renamed`
      });
      setSelected((prev) =>
        prev && prev.path === item.path
          ? { ...prev, path: result.path, name: finalName }
          : prev
      );
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to rename item";
      setStatus({ type: "error", message });
    }
  };

  const handleDeleteItem = async (item: Selection) => {
    const confirmed = window.confirm(
      `Delete ${item.type === "folder" ? "folder" : "document"} "${item.name}"?`
    );
    if (!confirmed) return;
    try {
      if (item.type === "folder") {
        await deleteFolder(item.path);
      } else {
        await deleteDocument(item.path);
      }
      setStatus({
        type: "success",
        message: `${item.type === "folder" ? "Folder" : "Document"} deleted`
      });
      setSelected((prev) => {
        if (!prev) return prev;
        if (prev.path === item.path) return null;
        if (
          item.type === "folder" &&
          prev.path.startsWith(`${item.path}/`)
        ) {
          return null;
        }
        return prev;
      });
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete item";
      setStatus({ type: "error", message });
    }
  };

  const handleReorderItem = async (
    item: Selection,
    direction: "up" | "down"
  ) => {
    try {
      await reorderItem(item.path, direction);
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to reorder item";
      setStatus({ type: "error", message });
    }
  };

  const handleDropInto = async (targetPath: string | null, item: Selection) => {
    try {
      if (item.type === "folder") {
        if (
          targetPath &&
          (item.path === targetPath ||
            targetPath.startsWith(`${item.path}/`))
        ) {
          return;
        }
        const result = await moveFolder(item.path, targetPath);
        setSelected((prev) =>
          prev && prev.path === item.path
            ? { ...prev, path: result.path }
            : prev
        );
      } else {
        const result = await moveDocument(item.path, targetPath);
        setSelected((prev) =>
          prev && prev.path === item.path
            ? { ...prev, path: result.path }
            : prev
        );
      }
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to move item";
      setStatus({ type: "error", message });
    } finally {
      setDraggedItem(null);
    }
  };

  const handleDragStartItem = (item: Selection) => {
    setDraggedItem(item);
  };

  const handleDragEndItem = () => {
    setDraggedItem(null);
  };

  const handleDropToRoot = () => {
    if (!draggedItem) return;
    void handleDropInto(null, draggedItem);
  };

  const handleDocumentNameSubmit = async () => {
    if (selected?.type !== "document") return;
    const trimmed = documentNameInput.trim();
    if (!trimmed || trimmed === selected.name) {
      setDocumentNameInput(selected.name);
      return;
    }
    const finalName = trimmed.endsWith(".txt") ? trimmed : `${trimmed}.txt`;
    try {
      const result = await renameDocument(selected.path, finalName);
      setStatus({ type: "success", message: "Document renamed" });
      await refreshTree();
      const newPath = result.path;
      setSelected({
        type: "document",
        path: newPath,
        name: finalName
      });
      setDocumentDetails((prev) =>
        prev
          ? {
              ...prev,
              name: finalName,
              path: newPath
            }
          : prev
      );
      setDocumentNameInput(finalName);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to rename document";
      setStatus({ type: "error", message });
      setDocumentNameInput(selected.name);
    }
  };

  const handleDocumentNameKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleDocumentNameSubmit();
    } else if (event.key === "Escape" && selected?.type === "document") {
      setDocumentNameInput(selected.name);
      event.currentTarget.blur();
    }
  };

  const handleDocumentMouseUp = (
    event: React.MouseEvent<HTMLTextAreaElement>
  ) => {
    if (!inlineActionsEnabled) {
      setSelectionMenu(null);
      return;
    }
    if (selected?.type !== "document" || !documentDetails) {
      setSelectionMenu(null);
      return;
    }
    const { selectionStart, selectionEnd, value } = event.currentTarget;
    if (
      selectionStart === null ||
      selectionEnd === null ||
      selectionStart === selectionEnd
    ) {
      setSelectionMenu(null);
      return;
    }
    const selectedText = value
      .slice(selectionStart, selectionEnd)
      .trim();
    if (!selectedText) {
      setSelectionMenu(null);
      return;
    }
    const x = Math.min(
      event.clientX,
      window.innerWidth - SELECTION_MENU_WIDTH
    );
    const y = Math.min(
      event.clientY,
      window.innerHeight - SELECTION_MENU_HEIGHT
    );
    setSelectionMenu({
      text: selectedText,
      x,
      y
    });
  };

  const startVariantFlow = async (mode: VariantMode, source: string) => {
    if (!selected || selected.type !== "document") {
      setStatus({
        type: "error",
        message: "Select a document before using writing tools."
      });
      return;
    }

    setVariantModal({
      mode,
      source,
      variants: [],
      loading: true,
      error: null
    });

    try {
      const response = await generateVariants({
        path: selected.path,
        text: source,
        mode: (mode === "summarize" || mode === "punchUp" || mode === "sensory")
          ? "rephrase"
          : mode,
        apiKey: userApiKey || undefined
      });
      setVariantModal((prev) =>
        prev && prev.mode === mode && prev.source === source
          ? {
              ...prev,
              variants: response.variants,
              loading: false
            }
          : prev
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate variants";
      setVariantModal((prev) =>
        prev && prev.mode === mode && prev.source === source
          ? { ...prev, loading: false, error: message }
          : prev
      );
    }
  };

  const handleVariantOption = async (mode: VariantMode) => {
    if (!selectionMenu?.text) return;
    const source = selectionMenu.text;
    setSelectionMenu(null);
    await startVariantFlow(mode, source);
  };

  const handleParagraphAction = async (
    mode: VariantMode,
    paragraph: string
  ) => {
    if (!paragraph.trim()) return;
    await startVariantFlow(mode, paragraph.trim());
  };

  const handleCopyVariant = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setStatus({ type: "success", message: "Variant copied to clipboard" });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to copy variant";
      setStatus({ type: "error", message });
    }
  };

  const closeVariantModal = () => {
    setVariantModal(null);
  };

  const handleSaveApiKey = () => {
    const trimmed = settingsKey.trim();
    if (!trimmed) {
      setStatus({
        type: "error",
        message: "Enter a valid API key before saving"
      });
      return;
    }
    saveApiKeys({ openai: trimmed });
    setUserApiKey(trimmed);
    setStatus({
      type: "success",
      message: "OpenAI API key saved (shared across Saas apps)"
    });
    setIsSettingsOpen(false);
  };

  const handleClearApiKey = () => {
    saveApiKeys({ openai: "" });
    setSettingsKey("");
    setUserApiKey("");
    setStatus({
      type: "success",
      message: "OpenAI API key cleared from shared storage"
    });
  };

  const handleGenerate = async () => {
    if (!chatPrompt.trim()) return;
    setIsGenerating(true);
    try {
      const response = await generateAnswer({
        path: selected?.path ?? null,
        prompt: chatPrompt,
        apiKey: userApiKey || undefined
      });
      setChatResponses((prev) => [
        { id: Date.now(), message: response.message },
        ...prev
      ]);
      setChatPrompt("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to generate response";
      setStatus({ type: "error", message });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="app">
      {/* Mode Tabs */}
      <div className="mode-tabs">
        {/* Menu Toggle Button */}
        <button
          className="menu-toggle-button"
          onClick={() => setSidebarVisible(!sidebarVisible)}
          title={sidebarVisible ? "Hide menu" : "Show menu"}
          aria-label={sidebarVisible ? "Hide menu" : "Show menu"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {sidebarVisible ? (
              <path d="M3 12h18M3 6h18M3 18h18" />
            ) : (
              <path d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
            <button
              className={clsx("mode-tab", { active: currentMode === "planning" })}
              onClick={() => setCurrentMode("planning")}
            >
              Creative Studio
            </button>
        <button
          className={clsx("mode-tab", { active: currentMode === "recording" })}
          onClick={() => setCurrentMode("recording")}
        >
          Recording Studio
        </button>
        <button
          className={clsx("mode-tab", { active: currentMode === "editing" })}
          onClick={() => setCurrentMode("editing")}
        >
          Edit Studio
        </button>
        
        {/* Panel Toggle Buttons */}
        <div className="panel-toggle-buttons">
          {currentMode === "planning" && (
            <>
              <button
                type="button"
                aria-pressed={instructionsVisible}
                className={clsx("panel-toggle-btn", !instructionsVisible && "toggle-off")}
                onClick={() => setInstructionsVisible((prev) => !prev)}
                title={`${instructionsVisible ? "Hide" : "Show"} Instructions Panel`}
              >
                <IconDocument className="icon" />
              </button>
              <button
                type="button"
                aria-pressed={documentVisible}
                className={clsx("panel-toggle-btn", !documentVisible && "toggle-off")}
                onClick={() => setDocumentVisible((prev) => !prev)}
                title={`${documentVisible ? "Hide" : "Show"} Text Editor Panel`}
              >
                <IconTextEditor className="icon" />
              </button>
              <button
                type="button"
                aria-pressed={inlineEditorVisible}
                className={clsx("panel-toggle-btn", !inlineEditorVisible && "toggle-off")}
                onClick={() => setInlineEditorVisible((prev) => !prev)}
                title={`${inlineEditorVisible ? "Hide" : "Show"} Inline Editor Panel`}
              >
                <IconInline className="icon" />
              </button>
              <button
                type="button"
                aria-pressed={chatVisible}
                className={clsx("panel-toggle-btn", !chatVisible && "toggle-off")}
                onClick={() => setChatVisible((prev) => !prev)}
                title={`${chatVisible ? "Hide" : "Show"} ChatGPT Panel`}
              >
                <IconChat className="icon" />
              </button>
                  <div className="action-buttons-separator" />
                  <button
                type="button"
                className="panel-toggle-btn"
                onClick={() => setShowAggregated(true)}
                aria-label="View aggregated instructions"
                title="View Aggregated Instructions"
              >
                <IconLayers className="icon" />
              </button>
              <ThemeToggle theme={theme} onToggle={(t) => { setTheme(t); setThemeState(t); }} className="panel-toggle-btn" />
              <button
                type="button"
                className={clsx("panel-toggle-btn", isSettingsOpen && "toggle-active")}
                onClick={() => setIsSettingsOpen((prev) => !prev)}
                aria-label={isSettingsOpen ? "Close settings" : "Open settings"}
                title={isSettingsOpen ? "Close Settings" : "Open Settings"}
              >
                <IconSettings className="icon" />
              </button>
            </>
          )}
          {currentMode === "recording" && (
            <>
              <button
                type="button"
                aria-pressed={documentVisible}
                className={clsx("panel-toggle-btn", !documentVisible && "toggle-off")}
                onClick={() => setDocumentVisible((prev) => !prev)}
                title={`${documentVisible ? "Hide" : "Show"} Text Editor Panel`}
              >
                <IconTextEditor className="icon" />
              </button>
              {selected?.type === "document" && (
                <button
                  type="button"
                  aria-pressed={audioEditorVisible}
                  className={clsx("panel-toggle-btn", !audioEditorVisible && "toggle-off")}
                  onClick={() => setAudioEditorVisible((prev) => !prev)}
                  title={`${audioEditorVisible ? "Hide" : "Show"} Audio/Video Recording Panel`}
                >
                  <IconAudioEditor className="icon" />
                </button>
              )}
            </>
          )}
          {currentMode === "editing" && (
            <>
              {selected?.type === "document" && (
                <>
                  <button
                    type="button"
                    aria-pressed={audioEditorVisible}
                    className={clsx("panel-toggle-btn", !audioEditorVisible && "toggle-off")}
                    onClick={() => setAudioEditorVisible((prev) => !prev)}
                    title={`${audioEditorVisible ? "Hide" : "Show"} Audio Editor Panel`}
                  >
                    <IconAudioEditor className="icon" />
                  </button>
                  {(videoUrl || documentDetails?.videoUrl) && (
                    <div className="video-aspect-ratio-selector">
                      <button
                        type="button"
                        className={clsx("aspect-ratio-btn", videoAspectRatio === "16:9" && "active")}
                        onClick={() => setVideoAspectRatio("16:9")}
                        title="16:9 aspect ratio"
                      >
                        16:9
                      </button>
                      <button
                        type="button"
                        className={clsx("aspect-ratio-btn", videoAspectRatio === "9:16" && "active")}
                        onClick={() => setVideoAspectRatio("9:16")}
                        title="9:16 aspect ratio"
                      >
                        9:16
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      
      <aside className="sidebar" style={{ width: sidebarWidth, display: sidebarVisible ? "block" : "none" }}>
        <div className="sidebar-header">
          <h1>PowerWriter</h1>
          <p style={{ margin: "4px 0 0", color: "#475467", fontSize: 13 }}>
            Meditation workspace
          </p>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button 
              type="button" 
              onClick={handleCreateFolder}
              title="Create new folder"
              aria-label="Create new folder"
            >
              + Folder
            </button>
            <button 
              type="button" 
              onClick={handleCreateDocument}
              title="Create new document"
              aria-label="Create new document"
            >
              + Document
            </button>
          </div>
        </div>
        <Tree
          nodes={tree}
          collapsed={collapsed}
          onToggle={handleToggle}
          onSelect={handleSelect}
          selectedPath={selected?.path ?? null}
          onRename={handleRename}
          onDelete={handleDeleteItem}
          onReorder={handleReorderItem}
          onDropInto={handleDropInto}
          onDragStart={handleDragStartItem}
          onDragEnd={handleDragEndItem}
          draggedItem={draggedItem}
          onDropToRoot={handleDropToRoot}
        />
      </aside>
      <div
        className="resizer resizer-vertical sidebar-resizer"
        onMouseDown={() => setDraggingResizer("sidebar")}
        role="presentation"
      />

      <main className="main">
        {/* Recording Settings Dialog */}
        {isRecordingSettingsOpen ? (
          <div className="settings-overlay" onClick={() => setIsRecordingSettingsOpen(false)}>
            <div className="settings-dialog" onClick={(e) => e.stopPropagation()}>
              <div className="settings-dialog-header">
                <h2>Setup</h2>
                <button
                  type="button"
                  onClick={() => setIsRecordingSettingsOpen(false)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    fontSize: "24px",
                    padding: "0",
                    width: "32px",
                    height: "32px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  ×
                </button>
              </div>
              <div className="settings-dialog-content">
                <div className="settings-row">
                  <label htmlFor="audio-device">Microphone</label>
                  <select
                    id="audio-device"
                    value={selectedAudioDeviceId}
                    onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px",
                      background: "var(--field-bg)",
                      border: "1px solid var(--field-border)",
                      borderRadius: "4px",
                      color: "var(--text-primary)",
                      fontSize: "14px"
                    }}
                  >
                    <option value="default">Default - Microphone</option>
                    {audioDevices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId}>
                        {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                      </option>
                    ))}
                  </select>
                </div>
                {recordingType === "audio+video" && (
                  <div className="settings-row">
                    <label htmlFor="video-device">Camera</label>
                    <select
                      id="video-device"
                      value={selectedVideoDeviceId}
                      onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px",
                        background: "var(--field-bg)",
                        border: "1px solid var(--field-border)",
                        borderRadius: "4px",
                        color: "var(--text-primary)",
                        fontSize: "14px"
                      }}
                    >
                      <option value="default">Default - Camera</option>
                      {videoDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {isSettingsOpen ? (
          <div className="settings-panel">
            <div className="settings-row">
              <label htmlFor="openai-key">OpenAI API key</label>
              <input
                id="openai-key"
                type="password"
                placeholder="sk-..."
                value={settingsKey}
                onChange={(event) => setSettingsKey(event.target.value)}
              />
            </div>
            <div className="toolbar">
              <button
                type="button"
                onClick={handleClearApiKey}
                disabled={!userApiKey && !settingsKey}
              >
                Clear
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleSaveApiKey}
                disabled={!settingsKey.trim()}
              >
                Save Key
              </button>
            </div>
            <p className="settings-hint">
              API keys are stored once and shared across all Saas apps (PitchDeck, InfoGraphics, ColorWriter, StoryWriter, etc.).
            </p>
          </div>
        ) : null}

        <div className="main-content" ref={mainContentRef}>
          {/* Creative Studio Mode */}
          {currentMode === "planning" && instructionsVisible && (
            <section
              className="instructions-panel"
              style={{
                flexBasis: instructionsFlexBasis,
                flexGrow: 0,
                flexShrink: 0,
                order: 0
              }}
            >
              <p className="panel-label">Instructions</p>
              <div className="panel-header">
                <h2>
                  {selected?.name ?? "Instructions"} {loadingSelection ? "…" : ""}
                </h2>
                <div className="toolbar">
                  {hasEditableInstructions ? (
                    <span
                      className={clsx("autosave-indicator", instructionsAutosaveClass)}
                    >
                      {instructionsAutosaveLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="panel-body">
                <textarea
                  value={instructionsValue}
                  readOnly={!hasEditableInstructions}
                  onChange={(event) => {
                    if (!hasEditableInstructions) return;
                    if (selected?.type === "folder" && folderDetails) {
                      setFolderDetails({
                        ...folderDetails,
                        instructions: event.target.value
                      });
                    }
                    if (selected?.type === "document" && documentDetails) {
                      setDocumentDetails({
                        ...documentDetails,
                        instructions: event.target.value
                      });
                    }
                  }}
                  placeholder={instructionsPlaceholder}
                />
                {showFolderPanel && folderDetails ? (
                  <div className="color-control">
                    <label htmlFor="folder-color">Folder accent color</label>
                    <div className="color-control-row">
                      <input
                        id="folder-color"
                        type="color"
                        value={folderColorInput}
                        onChange={(event) =>
                          handleFolderColorChange(event.target.value)
                        }
                      />
                      <button
                        type="button"
                        className="ghost"
                        onClick={handleFolderColorReset}
                      >
                        Use default
                      </button>
                      <span
                        className="color-preview"
                        style={{
                          backgroundColor: folderColorCustom
                            ? folderColorInput
                            : DEFAULT_FOLDER_COLOR
                        }}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {currentMode === "planning" && instructionsVisible && (documentVisible || inlinePanelVisible) && (
            <div
              className="resizer resizer-vertical panel-resizer instructions-resizer"
              onMouseDown={() => setDraggingResizer("instructions")}
              role="presentation"
              style={{ order: 1 }}
            />
          )}

          {/* Edit Studio - Audio/Video Editor */}
          {(currentMode === "editing" && audioEditorVisible && selected?.type === "document" && documentDetails) ? (
            <section
              className="audio-editor-panel"
              style={{
                flexBasis: audioEditorFlexBasis,
                flexGrow: 0,
                flexShrink: 0,
                order: 2
              }}
            >
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <p className="panel-label" style={{ margin: 0 }}>Audio Editor</p>
                {documentDetails?.recordings && documentDetails.recordings.length > 0 && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <select
                      value={selectedRecordingId || ""}
                      onChange={(e) => setSelectedRecordingId(e.target.value || null)}
                      style={{
                        padding: "4px 8px",
                        background: "var(--field-bg)",
                        border: "1px solid var(--field-border)",
                        borderRadius: "4px",
                        color: "var(--text-primary)",
                        fontSize: "12px"
                      }}
                    >
                      <option value="">All Recordings</option>
                      {documentDetails.recordings.map((recording) => (
                        <option key={recording.id} value={recording.id}>
                          Recording {new Date(recording.createdAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                    {selectedRecordingId && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!selectedRecordingId || !documentDetails) return;
                          const recording = documentDetails.recordings?.find(r => r.id === selectedRecordingId);
                          if (!recording) return;
                          if (confirm(`Delete this recording?`)) {
                            const updatedRecordings = documentDetails.recordings?.filter(r => r.id !== selectedRecordingId) || [];
                            const updatedDetails = {
                              ...documentDetails,
                              recordings: updatedRecordings
                            };
                            setDocumentDetails(updatedDetails);
                            setSelectedRecordingId(null);
                            // Save document
                            const snapshot = toDocumentSnapshot(updatedDetails);
                            void performDocumentSave(documentDetails.path, snapshot);
                          }
                        }}
                        style={{
                          padding: "4px 8px",
                          background: "var(--error-bg, #fee2e2)",
                          border: "1px solid var(--error-border, #fca5a5)",
                          borderRadius: "4px",
                          color: "var(--error-text, #dc2626)",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                        title="Delete selected recording"
                      >
                        <IconTrash size={14} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="panel-body">
                <AudioEditor
                  documentPath={documentDetails.path}
                  audioUrl={documentDetails.audioUrl ?? null}
                  transcription={documentDetails.transcription ?? null}
                  documentContent={documentDetails.content}
                  apiKey={userApiKey || undefined}
                  onTranscriptionUpdate={(transcription) => {
                    if (documentDetails) {
                      const updatedDetails = {
                        ...documentDetails,
                        transcription
                      };
                      setDocumentDetails(updatedDetails);
                      // Auto-save document when transcription is updated
                      if (selected?.type === "document" && selected.path === documentDetails.path) {
                        const snapshot = toDocumentSnapshot(updatedDetails);
                        // Trigger save
                        void performDocumentSave(documentDetails.path, snapshot);
                      }
                    }
                  }}
                  recordings={documentDetails.recordings}
                  selectedRecordingId={selectedRecordingId}
                  onSelectRecording={setSelectedRecordingId}
                  onDeleteRecording={async (recordingId) => {
                    if (!documentDetails) return;
                    const updatedRecordings = documentDetails.recordings?.filter(r => r.id !== recordingId) || [];
                    const updatedDetails = {
                      ...documentDetails,
                      recordings: updatedRecordings
                    };
                    setDocumentDetails(updatedDetails);
                    if (selectedRecordingId === recordingId) {
                      setSelectedRecordingId(null);
                    }
                    // Save document
                    const snapshot = toDocumentSnapshot(updatedDetails);
                    void performDocumentSave(documentDetails.path, snapshot);
                  }}
                  audioPlayerRef={audioPlayerRef}
                />
              </div>
            </section>
          ) : null}

          {/* Resizer between Audio Editor and Video/Captions Panel in Edit Studio */}
          {currentMode === "editing" && audioEditorVisible && (
            <div
              className="resizer resizer-vertical panel-resizer audio-editor-resizer"
              onMouseDown={() => setDraggingResizer("audioEditor")}
              role="presentation"
              style={{ order: 3 }}
            />
          )}

          {/* Edit Studio - Video or Captions (Right Panel) */}
          {currentMode === "editing" && (
            <section
              className="video-preview-panel"
              style={{
                flexBasis: "40%",
                flexGrow: 0,
                flexShrink: 0,
                order: 4,
                minWidth: 300
              }}
            >
              <p className="panel-label">Video Preview</p>
              <div className="panel-body" style={{ padding: 0, display: "flex", flexDirection: "column", height: "100%" }}>
                <div 
                  className="video-preview-container"
                  style={{
                    aspectRatio: videoAspectRatio === "16:9" ? "16/9" : "9/16",
                    width: "100%",
                    backgroundColor: "#000",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                    overflow: "hidden"
                  }}
                >
                  {/* Video element - only show if video exists */}
                  {(videoUrl || documentDetails?.videoUrl) && (
                    <video
                      ref={editStudioVideoRef}
                      key={`edit-studio-video-${selectedRecordingId || 'none'}-${videoUrl || documentDetails?.videoUrl || 'none'}`}
                      src={videoUrl || documentDetails?.videoUrl || undefined}
                      controls
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        position: "absolute",
                        inset: 0,
                        zIndex: 1
                      }}
                      onLoadedData={() => {
                        console.log("Edit Studio: Video loaded successfully", {
                          src: videoUrl || documentDetails?.videoUrl,
                          selectedRecordingId
                        });
                      }}
                      onError={(e) => {
                        console.error("Edit Studio: Video playback error:", e, {
                          src: videoUrl || documentDetails?.videoUrl,
                          selectedRecordingId
                        });
                      }}
                    />
                  )}
                  
                  {/* Captions overlay - always shown, on top of video if video exists */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      zIndex: 2,
                      pointerEvents: "none"
                    }}
                  >
                    <CaptionsPanel transcription={documentDetails?.transcription || null} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Recording Studio - Unified Recording & Preview Panel (Right) */}
          {currentMode === "recording" && audioEditorVisible && selected?.type === "document" && documentDetails ? (
            <section
              className="audio-editor-panel"
              style={{
                flexBasis: (documentVisible && showDocumentPanel) ? "45%" : "100%",
                flexGrow: 0,
                flexShrink: 0,
                order: 2,
                minWidth: (documentVisible && showDocumentPanel) ? 400 : "auto"
              }}
            >
              <div className="panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <p className="panel-label" style={{ margin: 0 }}>Recording</p>
                  <div style={{ display: "flex", gap: "4px", marginLeft: "8px" }}>
                    <button
                      type="button"
                      className={clsx("panel-toggle-btn", recordingType === "audio" && "toggle-active")}
                      onClick={() => setRecordingType("audio")}
                      title="Record audio only"
                      style={{ width: "32px", height: "32px" }}
                    >
                      <IconMic className="icon" />
                    </button>
                    <button
                      type="button"
                      className={clsx("panel-toggle-btn", recordingType === "audio+video" && "toggle-active")}
                      onClick={() => setRecordingType("audio+video")}
                      title="Record audio and video"
                      style={{ width: "32px", height: "32px" }}
                    >
                      <IconVideo className="icon" />
                    </button>
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setIsRecordingSettingsOpen(true)}
                    title="Recording Settings"
                    style={{
                      padding: "4px 8px",
                      background: "transparent",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: "4px",
                      color: "var(--text-primary)",
                      cursor: "pointer"
                    }}
                  >
                    <IconSettings className="icon" />
                  </button>
                </div>
              </div>
              <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%" }}>
                {/* Video Preview - Always shown when in video mode, or audio-only preview */}
                {(recordingType === "audio+video" || (recordingType === "audio" && hasAudio)) && (
                  <div style={{ flexShrink: 0 }}>
                    <p className="panel-label" style={{ marginBottom: "8px", fontSize: "12px", fontWeight: 600 }}>Preview</p>
                    <div 
                      className="video-preview-container"
                      style={{
                        aspectRatio: recordingType === "audio+video" ? "16/9" : "auto",
                        minHeight: recordingType === "audio" ? "120px" : "auto",
                        width: "100%",
                        backgroundColor: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: "8px"
                      }}
                    >
                      {isRecordingAudio && videoStreamRef.current && recordingType === "audio+video" ? (
                        <video
                          ref={videoPreviewRef}
                          autoPlay
                          muted
                          playsInline
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain"
                          }}
                        />
                      ) : (videoUrl || documentDetails?.videoUrl) && recordingType === "audio+video" ? (
                        <video
                          ref={(el) => {
                            if (el) {
                              videoPreviewRef.current = el;
                              // Clear srcObject immediately if it exists
                              if (el.srcObject) {
                                el.srcObject = null;
                                el.pause();
                              }
                              // Set src immediately
                              const videoSrc = videoUrl || documentDetails?.videoUrl;
                              if (videoSrc && !isRecordingAudio) {
                                const srcToSet = videoSrc.startsWith('http') || videoSrc.startsWith('/') || videoSrc.startsWith('blob:')
                                  ? videoSrc
                                  : `/${videoSrc}`;
                                if (el.src !== srcToSet) {
                                  el.src = srcToSet;
                                  el.load();
                                  console.log("Recording Studio: Video ref callback - Setting src", srcToSet);
                                }
                              }
                            }
                          }}
                          key={`recording-studio-video-${selectedRecordingId || 'none'}-${videoUrl || documentDetails?.videoUrl || 'none'}`}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            display: "block"
                          }}
                          onTimeUpdate={() => {
                            // Sync video with audio player
                            if (audioPlayerRef.current && videoPreviewRef.current && !isRecordingAudio) {
                              const audioTime = audioPlayerRef.current.currentTime;
                              const videoTime = videoPreviewRef.current.currentTime;
                              if (Math.abs(audioTime - videoTime) > 0.1) {
                                videoPreviewRef.current.currentTime = audioTime;
                              }
                            }
                          }}
                          onLoadedData={() => {
                            console.log("Recording Studio: Video loaded successfully", {
                              src: videoPreviewRef.current?.src,
                              readyState: videoPreviewRef.current?.readyState,
                              selectedRecordingId,
                              videoUrl: videoUrl || documentDetails?.videoUrl,
                              videoVisible: videoPreviewRef.current?.offsetParent !== null
                            });
                          }}
                          onCanPlay={() => {
                            console.log("Recording Studio: Video can play", {
                              src: videoPreviewRef.current?.src,
                              readyState: videoPreviewRef.current?.readyState,
                              videoVisible: videoPreviewRef.current?.offsetParent !== null
                            });
                          }}
                          onError={(e) => {
                            console.error("Recording Studio: Video playback error:", e, {
                              src: videoUrl || documentDetails?.videoUrl,
                              videoElementSrc: videoPreviewRef.current?.src,
                              videoElementSrcObject: !!videoPreviewRef.current?.srcObject,
                              error: videoPreviewRef.current?.error,
                              selectedRecordingId,
                              videoElement: videoPreviewRef.current,
                              videoVisible: videoPreviewRef.current?.offsetParent !== null
                            });
                          }}
                        />
                      ) : recordingType === "audio" && hasAudio ? (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          color: "var(--text-primary)",
                          fontSize: "16px",
                          fontWeight: 500
                        }}>
                          {isPlaying ? "Playing Audio" : "Audio Ready"}
                        </div>
                      ) : (
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "100%",
                          height: "100%",
                          color: "var(--text-muted)",
                          fontSize: "14px"
                        }}>
                          No video available
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Unified Recording & Playback Control Panel */}
                <div className="audio-editor-unified-player" style={{ flexShrink: 0 }}>
                  {/* Header with Take selector */}
                  <div className="audio-editor-player-header">
                    <span className="audio-editor-recording-label">Recording</span>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      {/* Takes selector */}
                      {documentDetails.recordings && documentDetails.recordings.length > 0 && (
                        <>
                          <select
                            value={selectedRecordingId || ""}
                            onChange={(e) => setSelectedRecordingId(e.target.value || null)}
                            title="Select take"
                            className="audio-editor-take-selector"
                          >
                            <option value="">All Takes</option>
                            {documentDetails.recordings.map((r, i) => (
                              <option key={r.id} value={r.id}>{`Take ${i + 1}`}</option>
                            ))}
                          </select>
                          {selectedRecordingId && (
                            <button
                              type="button"
                              className="audio-editor-delete-take-button"
                              onClick={async () => {
                                if (!selectedRecordingId || !documentDetails) return;
                                if (confirm("Delete this take?")) {
                                  const updatedRecordings = documentDetails.recordings?.filter(r => r.id !== selectedRecordingId) || [];
                                  const updatedDetails = {
                                    ...documentDetails,
                                    recordings: updatedRecordings
                                  };
                                  setDocumentDetails(updatedDetails);
                                  setSelectedRecordingId(null);
                                  const snapshot = toDocumentSnapshot(updatedDetails);
                                  void performDocumentSave(documentDetails.path, snapshot);
                                }
                              }}
                              title="Delete selected take"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                              </svg>
                            </button>
                          )}
                        </>
                      )}
                      {isRecordingAudio && (
                        <span className="audio-editor-recording-status recording">
                          {formattedElapsed}
                        </span>
                      )}
                      {!isRecordingAudio && hasAudio && (
                        <span className="audio-editor-recording-status ready">Ready</span>
                      )}
                    </div>
                  </div>

                  {/* Timeline */}
                  {hasAudio && (
                    <div className="audio-editor-timeline-wrapper">
                      <div 
                        className="audio-editor-timeline"
                        onClick={(e) => {
                          if (!audioPlayerRef.current || !audioDuration) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const percentage = Math.max(0, Math.min(1, x / rect.width));
                          const newTime = percentage * audioDuration;
                          if (audioPlayerRef.current) {
                            audioPlayerRef.current.currentTime = newTime;
                            setAudioCurrentTime(newTime);
                            // Also seek video if it exists
                            if (videoPreviewRef.current && (videoUrl || documentDetails?.videoUrl)) {
                              videoPreviewRef.current.currentTime = newTime;
                            }
                          }
                        }}
                      >
                        <div 
                          className="audio-editor-timeline-progress"
                          style={{ width: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                        />
                        <div 
                          className="audio-editor-timeline-playhead"
                          style={{ left: `${audioDuration > 0 ? (audioCurrentTime / audioDuration) * 100 : 0}%` }}
                        />
                        {audioDuration === 0 && (
                          <div style={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "var(--text-muted)",
                            fontSize: "12px"
                          }}>
                            Loading...
                          </div>
                        )}
                      </div>
                      <div className="audio-editor-timeline-time">
                        <span>{(() => {
                          const mins = Math.floor(audioCurrentTime / 60);
                          const secs = Math.floor(audioCurrentTime % 60);
                          return `${mins}:${secs.toString().padStart(2, "0")}`;
                        })()}</span>
                        <span style={{ color: "var(--text-secondary)" }}> / {audioDuration > 0 ? (() => {
                          const mins = Math.floor(audioDuration / 60);
                          const secs = Math.floor(audioDuration % 60);
                          return `${mins}:${secs.toString().padStart(2, "0")}`;
                        })() : "--:--"}</span>
                      </div>
                    </div>
                  )}

                  {/* Playback Controls */}
                  <div className="audio-editor-player-controls">
                    <button
                      className="audio-editor-icon-button"
                      onClick={() => startRecording()}
                      disabled={!canStartRecording}
                      title="Start recording (Ctrl/Cmd + R)"
                    >
                      <IconRecord className="audio-editor-icon" />
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={() => stopRecording()}
                      disabled={!isRecordingAudio}
                      title="Stop recording"
                    >
                      <IconStop className="audio-editor-icon" />
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={() => handlePlayAudio()}
                      disabled={!hasAudio || isRecordingAudio}
                      title="Play audio"
                    >
                      <IconPlay className="audio-editor-icon" />
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={() => handlePauseAudio()}
                      disabled={!hasAudio}
                      title="Pause audio"
                    >
                      <IconPause className="audio-editor-icon" />
                    </button>
                    <button
                      className="audio-editor-icon-button"
                      onClick={() => handleRewindAudio()}
                      disabled={!hasAudio}
                      title="Rewind to beginning"
                    >
                      <IconRewind className="audio-editor-icon" />
                    </button>
                  </div>

                  {recordingFileName && !isRecordingAudio && (
                    <div className="audio-editor-recording-filename">
                      {recordingFileName}
                    </div>
                  )}
                </div>

                
                {/* Audio Editing Section */}
                <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <AudioEditor
                    documentPath={documentDetails.path}
                    audioUrl={documentDetails.audioUrl ?? null}
                    transcription={null}
                    documentContent={documentDetails.content}
                    apiKey={userApiKey || undefined}
                    onTranscriptionUpdate={undefined}
                    isRecordingAudio={isRecordingAudio}
                    recordingElapsed={recordingElapsed}
                    recordingFileName={recordingFileName}
                    onStartRecording={startRecording}
                    onStopRecording={stopRecording}
                    onPlayAudio={handlePlayAudio}
                    onPauseAudio={handlePauseAudio}
                    onRewindAudio={handleRewindAudio}
                    canStartRecording={canStartRecording}
                    hasAudio={hasAudio}
                    recordings={documentDetails.recordings}
                    selectedRecordingId={selectedRecordingId}
                    onSelectRecording={setSelectedRecordingId}
                    onDeleteRecording={async (recordingId) => {
                      if (!documentDetails) return;
                      const updatedRecordings = documentDetails.recordings?.filter(r => r.id !== recordingId) || [];
                      const updatedDetails = {
                        ...documentDetails,
                        recordings: updatedRecordings
                      };
                      setDocumentDetails(updatedDetails);
                      if (selectedRecordingId === recordingId) {
                        setSelectedRecordingId(null);
                      }
                      // Save document
                      const snapshot = toDocumentSnapshot(updatedDetails);
                      void performDocumentSave(documentDetails.path, snapshot);
                    }}
                    audioPlayerRef={audioPlayerRef}
                    hideUnifiedPlayer={true}
                  />
                </div>
                
                {/* Hidden audio element for duration tracking and playback */}
                {hasAudio && (
                  <audio
                    ref={audioPlayerRef}
                    src={audioUrl || documentDetails?.audioUrl || undefined}
                    style={{ display: "none" }}
                    onLoadedMetadata={() => {
                      if (audioPlayerRef.current) {
                        setAudioDuration(audioPlayerRef.current.duration || 0);
                      }
                    }}
                  />
                )}
              </div>
            </section>
          ) : null}


          {audioEditorVisible && selected?.type === "document" && (documentVisible || inlinePanelVisible) && (
            <div
              className="resizer resizer-vertical panel-resizer audio-editor-resizer"
              onMouseDown={() => setDraggingResizer("audioEditor")}
              role="presentation"
              style={{ order: 3 }}
            />
          )}

          {/* Creative Studio & Recording Studio - Document Editor */}
          {((currentMode === "planning" || currentMode === "recording") && documentVisible && showDocumentPanel) ? (
            <section
              className="document-panel"
              style={{
                flexBasis: documentFlexBasis,
                flexGrow: 1,
                flexShrink: 0,
                order: currentMode === "recording" ? 1 : (inlineBeforeDocument ? 4 : 2)
              }}
            >
              <div className="panel-header">
                {selected?.type === "document" ? (
                  <form
                    className="name-input-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleDocumentNameSubmit();
                    }}
                  >
                    <input
                      className="name-input"
                      value={documentNameInput}
                      onChange={(event) =>
                        setDocumentNameInput(event.target.value)
                      }
                      onBlur={() => void handleDocumentNameSubmit()}
                      onKeyDown={handleDocumentNameKeyDown}
                      placeholder="Document name"
                    />
                  </form>
                ) : (
                  <h2>{selectedName}</h2>
                )}
                <div className="toolbar">
                  {documentDetails ? (
                    <label className="toolbar-checkbox">
                      <input
                        type="checkbox"
                        checked={documentDetails.completed}
                        onChange={(event) =>
                          handleToggleCompleted(event.target.checked)
                        }
                      />
                      Completed
                    </label>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleGenerateForDocument}
                    disabled={
                      loadingSelection || !documentDetails || isDocGenerating
                    }
                  >
                    {isDocGenerating ? "Generating…" : "Generate Draft"}
                  </button>
                  {documentDetails ? (
                    <span
                      className={clsx("autosave-indicator", documentAutosaveClass)}
                    >
                      {documentAutosaveLabel}
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="panel-body">
                <textarea
                  value={currentDocumentContent}
                  onChange={(event) => {
                    if (documentDetails) {
                      setDocumentDetails({
                        ...documentDetails,
                        content: event.target.value
                      });
                    }
                  }}
                  onMouseUp={handleDocumentMouseUp}
                  onScroll={() => setSelectionMenu(null)}
                  onBlur={() => setSelectionMenu(null)}
                  placeholder="Start writing your meditation script..."
                />
              </div>
            </section>
          ) : documentVisible ? (
            <section
              className="document-panel"
              style={{
                flexBasis: documentFlexBasis,
                flexGrow: 1,
                flexShrink: 0,
                order: inlineBeforeDocument ? 4 : 2
              }}
            >
              <div className="panel-header">
                <h2>No document selected</h2>
              </div>
              <div
                className="panel-body"
                style={{ justifyContent: "center", color: "#667085" }}
              >
                <p>
                  Select or create a document to start editing its content.
                </p>
              </div>
            </section>
          ) : null}

          {documentVisible && inlinePanelVisible && (
            <div
              className="resizer resizer-vertical panel-resizer inline-resizer"
              onMouseDown={() => setDraggingResizer("inline")}
              role="presentation"
              style={{ order: 3 }}
            />
          )}

          {inlinePanelVisible && (
            <section
              className="inline-panel"
              style={{
                flexBasis: inlineFlexBasis,
                flexGrow: 0,
                flexShrink: 0,
                order: inlineBeforeDocument ? 2 : 4
              }}
              ref={inlinePanelRef}
            >
              {/* Creative Studio - Inline Editor (full width now that chat is separate) */}
              {currentMode === "planning" && inlineEditorVisible && (
                <div
                  className="inline-panel-section inline-editor-section"
                  style={{
                    flexBasis: "100%"
                  }}
                >
                  <div className="panel-header">
                    <h2>Inline Editor</h2>
                  </div>
                  <div className="panel-body inline-editor-body">
                    {!documentDetails ? (
                      <p className="inline-editor-placeholder">
                        Select a document to enable inline actions.
                      </p>
                    ) : !inlineActionsEnabled ? (
                      <p className="inline-editor-placeholder">
                        Inline actions are currently disabled.
                      </p>
                    ) : paragraphEntries.length === 0 ? (
                      <p className="inline-editor-placeholder">
                        Write paragraphs in the document to see inline actions.
                      </p>
                    ) : (
                      <div className="inline-editor-list">
                        {paragraphEntries.map((entry, index) => (
                          <div className="paragraph-card" key={entry.id}>
                            <div className="paragraph-card-editor">
                              <textarea
                                className="paragraph-card-textarea"
                                defaultValue={entry.text}
                                onChange={(event) => {
                                  if (!documentDetails) return;
                                  const updatedParagraphs = [...paragraphEntries];
                                  updatedParagraphs[index] = {
                                    ...entry,
                                    text: event.target.value
                                  };
                                  const merged = updatedParagraphs
                                    .map((item) => item.text)
                                    .join("\n\n");
                                  setDocumentDetails({
                                    ...documentDetails,
                                    content: merged
                                  });
                                }}
                                onInput={(event) => {
                                  const element = event.currentTarget;
                                  element.style.height = "auto";
                                  element.style.height = `${element.scrollHeight}px`;
                                }}
                              />
                              <div className="paragraph-card-actions">
                                {PARAGRAPH_ACTIONS.map((mode) => {
                                  const IconComponent =
                                    VARIANT_ICONS[mode] ?? IconDocument;
                                  return (
                                    <button
                                      type="button"
                                      key={`${entry.id}-${mode}`}
                                      onClick={() =>
                                        void handleParagraphAction(mode, entry.text)
                                      }
                                      aria-label={VARIANT_LABELS[mode]}
                                      title={VARIANT_LABELS[mode]}
                                    >
                                      <IconComponent className="icon" size={16} />
                                      <span className="sr-only">
                                        {VARIANT_LABELS[mode]}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {inlineEditorVisible && chatVisible && (
                <div
                  className="resizer resizer-horizontal panel-resizer inline-height-resizer"
                  onMouseDown={() => setDraggingResizer("inlineHeight")}
                  role="presentation"
                />
              )}

            </section>
          )}

          {/* Resizer between Inline Panel and Chat Panel in Creative Studio */}
          {currentMode === "planning" && inlinePanelVisible && chatVisible && (
            <div
              className="resizer resizer-vertical panel-resizer inline-resizer"
              onMouseDown={() => setDraggingResizer("inline")}
              role="presentation"
              style={{ order: 5 }}
            />
          )}

          {/* Creative Studio - ChatGPT Panel (Right Vertical Panel) */}
          {currentMode === "planning" && chatVisible && (
            <section
              className="chat-panel"
              style={{
                flexBasis: "35%",
                flexGrow: 0,
                flexShrink: 0,
                order: 6,
                minWidth: 300
              }}
            >
              <div className="panel-header">
                <h2>Generate with ChatGPT</h2>
                <div className="toolbar">
                  <button
                    type="button"
                    className="primary"
                    onClick={handleGenerate}
                    disabled={isGenerating || !chatPrompt.trim()}
                  >
                    {isGenerating ? "Generating…" : "Send"}
                  </button>
                </div>
              </div>
              <div className="panel-body inline-chat-body">
                <textarea
                  value={chatPrompt}
                  onChange={(event) => setChatPrompt(event.target.value)}
                  placeholder="Ask ChatGPT for ideas, revisions, or expansions..."
                />
                <div className="chat-responses">
                  {chatResponses.length === 0 ? (
                    <p style={{ color: "#667085", margin: 0 }}>
                      Responses will appear here.
                    </p>
                  ) : (
                    chatResponses.map((item) => (
                      <article
                        key={item.id}
                        style={{ marginBottom: 12, whiteSpace: "pre-wrap" }}
                      >
                        {item.message}
                      </article>
                    ))
                  )}
                </div>
              </div>
            </section>
          )}
        </div>

        {status ? (
          <div
            className={clsx(
              "status-bar",
              status.type === "success" ? "status-success" : "status-error"
            )}
          >
            {status.message}
          </div>
        ) : (
          <div className="status-bar">{fallbackStatusMessage}</div>
        )}
      </main>

      {inlineActionsEnabled && selectionMenu ? (
        <div
          className="selection-menu"
          style={{
            top: selectionMenu.y,
            left: selectionMenu.x
          }}
        >
          {SELECTION_ACTIONS.map((mode) => (
            <button
              type="button"
              key={mode}
              onClick={(event) => {
                event.stopPropagation();
                void handleVariantOption(mode);
              }}
            >
              {VARIANT_LABELS[mode]}
            </button>
          ))}
        </div>
      ) : null}

      {variantModal ? (
        <div
          className="overlay variant-overlay"
          role="presentation"
          onClick={closeVariantModal}
        >
          <div
            className="variant-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`${VARIANT_LABELS[variantModal.mode]} suggestions`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>{VARIANT_LABELS[variantModal.mode]}</h2>
              <div className="toolbar">
                <button type="button" onClick={closeVariantModal}>
                  Close
                </button>
              </div>
            </div>
            <div className="panel-body">
              <div className="variant-source">{variantModal.source}</div>
              {variantModal.loading ? (
                <p style={{ margin: 0, color: "#475467" }}>
                  Generating variations…
                </p>
              ) : variantModal.error ? (
                <p className="status-error" style={{ margin: 0 }}>
                  {variantModal.error}
                </p>
              ) : variantModal.variants.length === 0 ? (
                <p style={{ margin: 0, color: "#475467" }}>
                  No variations returned.
                </p>
              ) : (
                <div className="variant-list">
                  {variantModal.variants.map((variant, index) => (
                    <div className="variant-card" key={`${variant}-${index}`}>
                      <div className="variant-card-header">
                        <span>Version {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => void handleCopyVariant(variant)}
                        >
                          Copy
                        </button>
                      </div>
                      <pre>{variant}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showAggregated ? (
        <div
          className="overlay aggregated-overlay"
          role="presentation"
          onClick={() => setShowAggregated(false)}
        >
          <div
            className="aggregated-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Aggregated instructions"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="panel-header">
              <h2>Aggregated instructions</h2>
              <div className="toolbar">
                <button type="button" onClick={() => setShowAggregated(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="panel-body">
              <textarea
                className="readonly"
                value={aggregatedPreview}
                readOnly
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

