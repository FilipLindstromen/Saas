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
  openAiApiKey: "powerwriter.openaiKey",
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

function App() {
  console.info("[PowerWriter] bundle version 2025-02-20-1");
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Selection | null>(null);
  const initialRatiosRef = useRef(getInitialRatios());
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth);
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
  const audioChunksRef = useRef<Blob[]>([]);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const shouldDiscardRecordingRef = useRef(false);
  const isMountedRef = useRef(true);
  const localAudioUrlRef = useRef<string | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);
  const recordingStartRef = useRef<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState(0);
  const [recordingFileName, setRecordingFileName] = useState<string | null>(null);
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
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
        localAudioUrlRef.current = null;
      }
      clearRecordingTimer();
    };
  }, [clearRecordingTimer]);

  useEffect(() => {
    if (selected?.type !== "document") {
      clearRecordingTimer();
      setAudioUrl(null);
      setAudioError(null);
      setRecordingFileName(null);
      if (localAudioUrlRef.current) {
        URL.revokeObjectURL(localAudioUrlRef.current);
        localAudioUrlRef.current = null;
      }
      return;
    }
    const remoteUrl = documentDetails?.audioUrl ?? null;
    setAudioUrl(remoteUrl);
    setRecordingFileName(documentDetails?.audioFileName ?? null);
    if (remoteUrl && localAudioUrlRef.current) {
      URL.revokeObjectURL(localAudioUrlRef.current);
      localAudioUrlRef.current = null;
    }
  }, [
    selected?.type,
    selected?.path,
    documentDetails?.audioUrl,
    documentDetails?.audioFileName,
    clearRecordingTimer
  ]);

  useEffect(() => {
    if (audioPlayerRef.current) {
      audioPlayerRef.current.pause();
      audioPlayerRef.current.currentTime = 0;
      audioPlayerRef.current.load();
    }
  }, [audioUrl]);

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
        const result = await uploadDocumentAudio(pathForUpload, blob);
        if (!isMountedRef.current) return;
        console.log("[Recorder] upload success", result.audioUrl);
        if (previewUrl && localAudioUrlRef.current === previewUrl) {
          URL.revokeObjectURL(previewUrl);
          localAudioUrlRef.current = null;
        }
        setAudioUrl(result.audioUrl);
        setRecordingFileName(result.audioFileName);
        setDocumentDetails((prev) =>
          prev
            ? {
                ...prev,
                audioUrl: result.audioUrl,
                audioFileName: result.audioFileName
              }
            : prev
        );
        setStatus({
          type: "success",
          message: "Audio recording saved to this document"
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
      setAudioError("Audio recording is not supported in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      shouldDiscardRecordingRef.current = false;
      audioChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          console.log(
            "[Recorder] ondataavailable chunk",
            event.data.size,
            event.data.type
          );
          audioChunksRef.current.push(event.data);
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
        const chunks = audioChunksRef.current.slice();
        audioChunksRef.current = [];
        console.log("[Recorder] onstop details", {
          discard,
          chunkCount: chunks.length,
          isMounted: isMountedRef.current
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
              "No audio data was captured. Please try recording again."
            );
            console.warn("[Recorder] upload skipped: empty chunks");
          }
          return;
        }
        const blob = new Blob(chunks, { type: recorder.mimeType });
        console.log(
          "[Recorder] Captured audio blob",
          blob.size,
          recorder.mimeType
        );
        if (localAudioUrlRef.current) {
          URL.revokeObjectURL(localAudioUrlRef.current);
          localAudioUrlRef.current = null;
        }
        const previewUrl = URL.createObjectURL(blob);
        localAudioUrlRef.current = previewUrl;
        setAudioUrl(previewUrl);
        console.log("[Recorder] calling uploadRecording");
        uploadRecording(blob, previewUrl)
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
    uploadRecording
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
      })
      .catch(() => {
        setAudioError("Unable to play audio. Try downloading instead.");
      });
  }, []);

  const handlePauseAudio = useCallback(() => {
    audioPlayerRef.current?.pause();
  }, []);

  const handleRewindAudio = useCallback(() => {
    if (!audioPlayerRef.current) return;
    audioPlayerRef.current.pause();
    audioPlayerRef.current.currentTime = 0;
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
    if (typeof window === "undefined") return;
    const storedKey = window.localStorage.getItem(
      STORAGE_KEYS.openAiApiKey
    );
    if (storedKey) {
      setUserApiKey(storedKey);
      setSettingsKey(storedKey);
    }
  }, []);

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
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEYS.openAiApiKey, trimmed);
    }
    setUserApiKey(trimmed);
    setStatus({
      type: "success",
      message: "OpenAI API key saved in this browser"
    });
    setIsSettingsOpen(false);
  };

  const handleClearApiKey = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.openAiApiKey);
    }
    setSettingsKey("");
    setUserApiKey("");
    setStatus({
      type: "success",
      message: "OpenAI API key cleared from this browser"
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
      <aside className="sidebar" style={{ width: sidebarWidth }}>
        <div className="sidebar-header">
          <h1>PowerWriter</h1>
          <p style={{ margin: "4px 0 0", color: "#475467", fontSize: 13 }}>
            Meditation workspace
          </p>
          <div className="toolbar" style={{ marginTop: 12 }}>
            <button type="button" onClick={handleCreateFolder}>
              + Folder
            </button>
            <button type="button" onClick={handleCreateDocument}>
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
        <div className="main-header">
          <div className="main-header-summary">
            <strong>Workspace</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475467" }}>
              Instructions are aggregated from folders, sub-folders, and the
              selected document.
            </p>
          </div>
          <div className="main-header-recording">
            <div className="main-header-recording-header">
              <span className="main-header-recording-label">Record Audio</span>
              {audioStatusText ? (
                <span className={audioStatusClass}>{audioStatusText}</span>
              ) : null}
            </div>
            <div className="audio-controls compact">
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={!canStartRecording}
                aria-label="Start recording"
              >
                <IconRecord className="icon" />
                <span className="sr-only">
                  {isRecordingAudio ? "Recording…" : "Record"}
                </span>
              </button>
              <button
                type="button"
                onClick={stopRecording}
                disabled={!isRecordingAudio}
                aria-label="Stop recording"
              >
                <IconStop className="icon" />
                <span className="sr-only">Stop</span>
              </button>
              <button
                type="button"
                onClick={handlePlayAudio}
                disabled={!hasAudio || isRecordingAudio}
                aria-label="Play audio"
              >
                <IconPlay className="icon" />
                <span className="sr-only">Play</span>
              </button>
              <button
                type="button"
                onClick={handlePauseAudio}
                disabled={!hasAudio}
                aria-label="Pause audio"
              >
                <IconPause className="icon" />
                <span className="sr-only">Pause</span>
              </button>
              <button
                type="button"
                onClick={handleRewindAudio}
                disabled={!hasAudio}
                aria-label="Rewind audio"
              >
                <IconRewind className="icon" />
                <span className="sr-only">Rewind</span>
              </button>
            </div>
            {audioUrl ? (
              <a className="audio-download" href={audioUrl} download>
                Download current recording
              </a>
            ) : null}
            {audioError ? <p className="audio-error">{audioError}</p> : null}
            <div className="audio-meta">
              {isRecordingAudio ? (
                <span className="audio-timer">{formattedElapsed}</span>
              ) : (
                <span className="audio-filename">
                  {recordingFileName ?? "No recording saved"}
                </span>
              )}
            </div>
            <audio
              ref={audioPlayerRef}
              src={audioUrl ?? undefined}
              preload="metadata"
              style={{ display: "none" }}
            />
          </div>
          <div className="main-header-actions">
              <div className="toolbar panel-toggle-toolbar">
                <button
                  type="button"
                  aria-pressed={instructionsVisible}
                  className={clsx(!instructionsVisible && "toggle-off")}
                  onClick={() => setInstructionsVisible((prev) => !prev)}
                  aria-label={`${instructionsVisible ? "Hide" : "Show"} instructions`}
                >
                  <IconDocument className="icon" />
                  <span className="sr-only">Instructions</span>
                </button>
                <button
                  type="button"
                  aria-pressed={documentVisible}
                  className={clsx(!documentVisible && "toggle-off")}
                  onClick={() => setDocumentVisible((prev) => !prev)}
                  aria-label={`${documentVisible ? "Hide" : "Show"} text editor`}
                >
                  <IconTextEditor className="icon" />
                  <span className="sr-only">Text Editor</span>
                </button>
                {selected?.type === "document" && (
                  <button
                    type="button"
                    aria-pressed={audioEditorVisible}
                    className={clsx(!audioEditorVisible && "toggle-off")}
                    onClick={() => setAudioEditorVisible((prev) => !prev)}
                    disabled={!documentDetails?.audioUrl}
                    aria-label={`${audioEditorVisible ? "Hide" : "Show"} audio editor`}
                    title={documentDetails?.audioUrl ? "Audio Editor" : "Audio Editor (record audio first)"}
                  >
                    <IconAudioEditor className="icon" />
                    <span className="sr-only">Audio Editor</span>
                  </button>
                )}
                <button
                  type="button"
                  aria-pressed={inlineEditorVisible}
                  className={clsx(!inlineEditorVisible && "toggle-off")}
                  onClick={() => setInlineEditorVisible((prev) => !prev)}
                  aria-label={`${inlineEditorVisible ? "Hide" : "Show"} inline editor`}
                >
                  <IconInline className="icon" />
                  <span className="sr-only">Inline Editor</span>
                </button>
                <button
                  type="button"
                  aria-pressed={chatVisible}
                  className={clsx(!chatVisible && "toggle-off")}
                  onClick={() => setChatVisible((prev) => !prev)}
                  aria-label={`${chatVisible ? "Hide" : "Show"} ChatGPT panel`}
                >
                  <IconChat className="icon" />
                  <span className="sr-only">Generate with ChatGPT</span>
                </button>
                <button
                  type="button"
                  aria-pressed={inlineBeforeDocument}
                  className={clsx(inlineBeforeDocument && "toggle-active")}
                  onClick={() => setInlineBeforeDocument((prev) => !prev)}
                  aria-label="Swap text editor and inline editor position"
                >
                  <IconSwap className="icon" />
                  <span className="sr-only">Swap editor layout</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowAggregated(true)}
                  aria-label="View aggregated instructions"
                >
                  <IconLayers className="icon" />
                  <span className="sr-only">View Aggregated</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen((prev) => !prev)}
                  aria-label={isSettingsOpen ? "Close settings" : "Open settings"}
                >
                  <IconSettings className="icon" />
                  <span className="sr-only">
                    {isSettingsOpen ? "Close Settings" : "Settings"}
                  </span>
                </button>
              </div>
            </div>
        </div>

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
              Stored only in this browser and included with generation requests.
            </p>
          </div>
        ) : null}

        <div className="main-content" ref={mainContentRef}>
          {instructionsVisible && (
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

          {instructionsVisible && (documentVisible || audioEditorVisible || inlinePanelVisible) && (
            <div
              className="resizer resizer-vertical panel-resizer instructions-resizer"
              onMouseDown={() => setDraggingResizer("instructions")}
              role="presentation"
              style={{ order: 1 }}
            />
          )}

          {audioEditorVisible && documentDetails?.audioUrl ? (
            <section
              className="audio-editor-panel"
              style={{
                flexBasis: audioEditorFlexBasis,
                flexGrow: 0,
                flexShrink: 0,
                order: 2
              }}
            >
              <p className="panel-label">Audio Editor</p>
              <div className="panel-body">
                <AudioEditor
                  documentPath={documentDetails.path}
                  audioUrl={documentDetails.audioUrl}
                  transcription={documentDetails.transcription}
                  documentContent={documentDetails.content}
                  apiKey={userApiKey || undefined}
                  onTranscriptionUpdate={(transcription) => {
                    if (documentDetails) {
                      setDocumentDetails({
                        ...documentDetails,
                        transcription
                      });
                    }
                  }}
                />
              </div>
            </section>
          ) : null}

          {audioEditorVisible && documentDetails?.audioUrl && (documentVisible || inlinePanelVisible) && (
            <div
              className="resizer resizer-vertical panel-resizer audio-editor-resizer"
              onMouseDown={() => setDraggingResizer("audioEditor")}
              role="presentation"
              style={{ order: 3 }}
            />
          )}

          {documentVisible && showDocumentPanel ? (
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
              {inlineEditorVisible && (
                <div
                  className="inline-panel-section inline-editor-section"
                  style={{
                    flexBasis: `${inlineEditorRatio * 100}%`
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

              {chatVisible && (
                <div
                  className="inline-panel-section inline-chat-section"
                  style={{
                    flexBasis: `${
                      (inlineEditorVisible ? 1 - inlineEditorRatio : 1) * 100
                    }%`
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
                </div>
              )}
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

export default App;

