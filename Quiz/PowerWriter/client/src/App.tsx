import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import "./App.css";
import type { DocumentDetails, FolderDetails, TreeNode } from "./types";
import {
  createDocument,
  createFolder,
  fetchTree,
  generateAnswer,
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
    }
  | {
      type: "document";
      path: string;
      name: string;
    };

const COMMON_STATUS_TIMEOUT = 2500;
const MIN_SIDEBAR_WIDTH = 220;
const MAX_SIDEBAR_WIDTH = 420;
const MIN_PANEL_RATIO = 0.25;
const MAX_PANEL_RATIO = 0.75;
const STORAGE_KEYS = {
  openAiApiKey: "powerwriter.openaiKey"
} as const;

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

  const handleSelect = () => {
    onSelect({
      type: node.type,
      path: node.path,
      name: node.name
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
          isCompleted && "tree-item-completed"
        )}
        style={{ paddingLeft }}
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
  const [sidebarWidth, setSidebarWidth] = useState(280);
  const [instructionsRatio, setInstructionsRatio] = useState(0.5);
  const [draggingResizer, setDraggingResizer] = useState<
    "sidebar" | "instructions" | null
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
  const [showAggregated, setShowAggregated] = useState(false);
  const [userApiKey, setUserApiKey] = useState("");
  const [settingsKey, setSettingsKey] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
        const next = Math.min(
          Math.max(event.clientX, MIN_SIDEBAR_WIDTH),
          MAX_SIDEBAR_WIDTH
        );
        setSidebarWidth(next);
        return;
      }
      if (
        draggingResizer === "instructions" &&
        mainContentRef.current
      ) {
        const rect = mainContentRef.current.getBoundingClientRect();
        const offset = event.clientX - rect.left;
        const ratio = offset / rect.width;
        setInstructionsRatio(
          Math.min(Math.max(ratio, MIN_PANEL_RATIO), MAX_PANEL_RATIO)
        );
      }
    };

    const handleUp = () => {
      setDraggingResizer(null);
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleUp);
    const previousCursor = document.body.style.cursor;
    const previousSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousSelect;
    };
  }, [draggingResizer]);

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
      await saveFolderInstructions(selected.path, folderDetails.instructions);
      setStatus({ type: "success", message: "Folder instructions saved" });
      await refreshTree();
      setSelected((prev) =>
        prev ? { ...prev } : prev
      ); // trigger refresh
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
          {(showFolderPanel || showDocumentPanel) && (
            <section
              className="instructions-panel"
              style={{ flexBasis: `${instructionsRatio * 100}%` }}
            >
              <p className="panel-label">Instructions</p>
              <div className="panel-header">
                <h2>
                  {selected?.name ?? "Instructions"}{" "}
                  {loadingSelection ? "…" : ""}
                </h2>
                <div className="toolbar">
                  {(showFolderPanel || showDocumentPanel) && (
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
                  value={currentInstructions}
                  onChange={(event) => {
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
                  placeholder={
                    selected?.type === "folder"
                      ? "Add folder-specific instructions that are applied to documents inside this folder."
                      : "Add document-specific instructions that refine the prompt."
                  }
                />
              </div>
            </section>
          )}

          {(showFolderPanel || showDocumentPanel) && (
            <div
              className="resizer resizer-vertical panel-resizer"
              onMouseDown={() => setDraggingResizer("instructions")}
              role="presentation"
            />
          )}

          {showDocumentPanel ? (
            <section
              className="document-panel"
              style={{ flexBasis: `${(1 - instructionsRatio) * 100}%` }}
            >
              <div className="panel-header">
                <h2>{selected?.name}</h2>
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
                  placeholder="Start writing your meditation script..."
                />
              </div>
            </section>
          ) : (
            <section
              className="document-panel"
              style={{ flexBasis: `${(1 - instructionsRatio) * 100}%` }}
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
          )}
        </div>

        <section className="chat-panel">
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
          <div className="panel-body">
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

      {showAggregated ? (
        <div
          className="overlay"
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

