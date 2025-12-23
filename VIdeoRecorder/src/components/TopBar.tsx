import { useState } from 'react'

interface TopBarProps {
  title: string
  onTitleChange: (title: string) => void
  isEdited?: boolean
  onCreateProject?: () => void
  onLoadProject?: () => void
  onDeleteProject?: () => void
  onSaveProject?: () => void
  hasProject?: boolean
}

export default function TopBar({
  title,
  onTitleChange,
  isEdited = false,
  onCreateProject,
  onLoadProject,
  onDeleteProject,
  onSaveProject,
  hasProject = false,
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)

  const handleSave = () => {
    onTitleChange(editTitle)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditTitle(title)
      setIsEditing(false)
    }
  }

  return (
    <div className="bg-gray-800 h-12 flex items-center justify-between px-4 border-b border-gray-700">
      <div className="flex items-center gap-4">
        {/* Project Menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center gap-2 px-3 py-1 hover:bg-gray-700 rounded text-sm"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
            <span>Project</span>
          </button>
          {showMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowMenu(false)}
              />
              <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded shadow-lg z-20 min-w-48">
                <button
                  onClick={() => {
                    onCreateProject?.()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-600 rounded-t text-sm"
                >
                  New Project
                </button>
                <button
                  onClick={() => {
                    onLoadProject?.()
                    setShowMenu(false)
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-600 text-sm"
                >
                  Load Project
                </button>
                {hasProject && (
                  <button
                    onClick={() => {
                      if (confirm('Are you sure you want to delete this project?')) {
                        onDeleteProject?.()
                      }
                      setShowMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-gray-600 rounded-b text-sm text-red-400"
                  >
                    Delete Project
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {/* Save Project Button */}
        {hasProject && (
          <button
            onClick={() => onSaveProject?.()}
            disabled={!isEdited}
            className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors ${
              isEdited
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span>Save Project</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            className="bg-transparent border-none outline-none text-white flex-1"
            autoFocus
          />
        ) : (
          <>
            <span
              className="cursor-pointer hover:text-gray-300"
              onClick={() => setIsEditing(true)}
            >
              {title}
            </span>
            {isEdited && (
              <>
                <span className="text-gray-500">|</span>
                <span className="text-gray-400">Edited</span>
              </>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button 
          onClick={() => {/* TODO: Implement undo */}}
          className="p-1 hover:bg-gray-700 rounded"
          title="Undo"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
            />
          </svg>
        </button>
        <button 
          onClick={() => {/* TODO: Implement redo */}}
          className="p-1 hover:bg-gray-700 rounded"
          title="Redo"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 10h-6a8 8 0 00-8 8v2M21 10l-6-6m6 6l-6 6"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}

