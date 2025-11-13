import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  deleteFolder
} from "./api";

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
  openAiApiKey: "powerwriter.openaiKey"
} as const;
const LS_KEYS = {
  sidebarWidth: "powerwriter.sidebarWidth",
  instructionsWidth: "powerwriter.instructionsWidth",
  inlineWidth: "powerwriter.inlineWidth",
  inlineEditorHeight: "powerwriter.inlineEditorHeight"
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
const PARAGRAPH_ACTIONS: VariantMode[] = ["summarize", "punchUp", "sensory"];

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
    "sidebar" | "instructions" | "inline" | "inlineHeight" | null
  >(null);

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
  const [instructionsVisible, setInstructionsVisible] = useState(true);
  const [documentVisible, setDocumentVisible] = useState(true);
  const [inlineEditorVisible, setInlineEditorVisible] = useState(true);
  const [chatVisible, setChatVisible] = useState(true);
  const [inlineEditorRatio, setInlineEditorRatio] = useState(
    getInitialInlineEditorRatio
  );

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
  }, [selected?.type, documentDetails?.content]);

  useEffect(() => {
    setSelectionMenu(null);
  }, [selected?.path]);

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
  const instructionsShare = instructionsVisible ? instructionsRatio : 0;
  const inlineShare = inlinePanelVisible ? inlineRatio : 0;
  const baseDocumentShare = documentVisible
    ? Math.max(MIN_DOCUMENT_RATIO, 1 - instructionsShare - inlineShare)
    : 0;
  const totalShare =
    (instructionsVisible ? instructionsShare : 0) +
      (documentVisible ? baseDocumentShare : 0) +
      (inlinePanelVisible ? inlineShare : 0) || 1;
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
          draggingResizer === "inline") &&
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
            1 - inlineRatio - MIN_DOCUMENT_RATIO
          );
          const desired =
            offset / width < 0
              ? MIN_INSTRUCTIONS_RATIO
              : offset / width;
          const clamped = clamp(desired, MIN_INSTRUCTIONS_RATIO, maxInstructions);
          const [inst, inl] = normalizeRatios(clamped, inlineRatio);
          setInstructionsRatio(inst);
          setInlineRatio(inl);
        } else if (draggingResizer === "inline") {
          const desiredInline =
            offset / width > 1
              ? MIN_INLINE_RATIO
              : 1 - offset / width;
          const maxInline = Math.max(
            MIN_INLINE_RATIO,
            1 - instructionsRatio - MIN_DOCUMENT_RATIO
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
    inlineEditorVisible,
    chatVisible
  ]);

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
        return;
      }

      setLoadingSelection(true);
      try {
        if (selected.type === "folder") {
          const details = await getFolderDetails(selected.path);
          setFolderDetails(details);
          setFolderColorInput(details.color ?? DEFAULT_FOLDER_COLOR);
          setFolderColorCustom(Boolean(details.color));
          setDocumentDetails(null);
        } else {
          const details = await getDocumentDetails(selected.path);
          setDocumentDetails(details);
          setFolderDetails(null);
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

  const handleToggle = (path: string) => {
    setCollapsed((prev) => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  const handleSelect = (item: Selection) => {
    setSelected(item);
  };

  const handleSaveFolderInstructions = async () => {
    if (selected?.type !== "folder" || !folderDetails) return;
    try {
    await saveFolderInstructions(
      selected.path,
      folderDetails.instructions,
      folderColorCustom ? folderColorInput : ""
    );
      setStatus({ type: "success", message: "Folder instructions saved" });
      await refreshTree();
      setSelected((prev) =>
      prev
        ? {
            ...prev,
            color: folderColorCustom ? folderColorInput : undefined
          }
        : prev
      ); // trigger refresh
    setFolderDetails({
      ...folderDetails,
      color: folderColorCustom ? folderColorInput : null
    });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save folder";
      setStatus({ type: "error", message });
    }
  };

  const handleSaveDocument = async () => {
    if (selected?.type !== "document" || !documentDetails) return;
    try {
      await saveDocument(
        selected.path,
        documentDetails.content,
        documentDetails.instructions,
        { completed: documentDetails.completed }
      );
      setStatus({ type: "success", message: "Document saved" });
      await refreshTree();
      setSelected((prev) =>
        prev ? { ...prev } : prev
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to save document";
      setStatus({ type: "error", message });
    }
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

  const handleToggleCompleted = async (checked: boolean) => {
    if (selected?.type !== "document" || !documentDetails) return;
    const previous = documentDetails.completed;
    setDocumentDetails({
      ...documentDetails,
      completed: checked
    });
    try {
      await saveDocument(
        selected.path,
        documentDetails.content,
        documentDetails.instructions,
        { completed: checked }
      );
      await refreshTree();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update completion status";
      setStatus({ type: "error", message });
      setDocumentDetails((prev) =>
        prev
          ? {
              ...prev,
              completed: previous
            }
          : prev
      );
    }
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
        mode,
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
          <div>
            <strong>Workspace</strong>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: "#475467" }}>
              Instructions are aggregated from folders, sub-folders, and the
              selected document.
            </p>
          </div>
          <div className="main-header-actions">
            <div className="toolbar panel-toggle-toolbar">
              <button
                type="button"
                aria-pressed={instructionsVisible}
                className={clsx(!instructionsVisible && "toggle-off")}
                onClick={() => setInstructionsVisible((prev) => !prev)}
              >
                Instructions
              </button>
              <button
                type="button"
                aria-pressed={documentVisible}
                className={clsx(!documentVisible && "toggle-off")}
                onClick={() => setDocumentVisible((prev) => !prev)}
              >
                Text Editor
              </button>
              <button
                type="button"
                aria-pressed={inlineEditorVisible}
                className={clsx(!inlineEditorVisible && "toggle-off")}
                onClick={() => setInlineEditorVisible((prev) => !prev)}
              >
                Inline Editor
              </button>
              <button
                type="button"
                aria-pressed={chatVisible}
                className={clsx(!chatVisible && "toggle-off")}
                onClick={() => setChatVisible((prev) => !prev)}
              >
                Generate with ChatGPT
              </button>
            </div>
            <div className="toolbar">
              <button
                type="button"
                onClick={() => setShowAggregated(true)}
              >
                View Aggregated
              </button>
              <button
                type="button"
                onClick={() => setIsSettingsOpen((prev) => !prev)}
              >
                {isSettingsOpen ? "Close Settings" : "Settings"}
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
                flexShrink: 0
              }}
            >
              <p className="panel-label">Instructions</p>
              <div className="panel-header">
                <h2>
                  {selected?.name ?? "Instructions"} {loadingSelection ? "…" : ""}
                </h2>
                <div className="toolbar">
                  {hasEditableInstructions && (
                    <button
                      type="button"
                      className="primary"
                      onClick={
                        showFolderPanel
                          ? handleSaveFolderInstructions
                          : handleSaveDocument
                      }
                      disabled={
                        loadingSelection ||
                        (selected?.type === "document"
                          ? !documentDetails
                          : !folderDetails)
                      }
                    >
                      Save
                    </button>
                  )}
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

          {instructionsVisible && documentVisible && (
            <div
              className="resizer resizer-vertical panel-resizer instructions-resizer"
              onMouseDown={() => setDraggingResizer("instructions")}
              role="presentation"
            />
          )}

          {documentVisible && showDocumentPanel ? (
            <section
              className="document-panel"
              style={{
                flexBasis: documentFlexBasis,
                flexGrow: 1,
                flexShrink: 0
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
                  <h2>{selected?.name}</h2>
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
                  <button
                    type="button"
                    className="primary"
                    onClick={handleSaveDocument}
                    disabled={loadingSelection || !documentDetails}
                  >
                    Save Document
                  </button>
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
                flexShrink: 0
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
            />
          )}

          {inlinePanelVisible && (
            <section
              className="inline-panel"
              style={{
                flexBasis: inlineFlexBasis,
                flexGrow: 0,
                flexShrink: 0
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
                    <div className="toolbar">
                      <button
                        type="button"
                        onClick={() => setInlineActionsEnabled((prev) => !prev)}
                      >
                        {inlineActionsEnabled
                          ? "Inline Actions: On"
                          : "Inline Actions: Off"}
                      </button>
                    </div>
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
                        {paragraphEntries.map((entry) => (
                          <div className="paragraph-card" key={entry.id}>
                            <div className="paragraph-card-text">
                              {entry.text}
                            </div>
                            <div className="paragraph-card-actions">
                              {PARAGRAPH_ACTIONS.map((mode) => (
                                <button
                                  type="button"
                                  key={`${entry.id}-${mode}`}
                                  onClick={() =>
                                    void handleParagraphAction(mode, entry.text)
                                  }
                                >
                                  {VARIANT_LABELS[mode]}
                                </button>
                              ))}
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
          <div className="status-bar">
            {loadingSelection
              ? "Loading selection..."
              : "Ready to write mindful experiences."}
          </div>
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

