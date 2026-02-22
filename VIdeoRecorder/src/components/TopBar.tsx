import { useState, useEffect } from 'react'
import ProjectSelector from '@shared/ProjectSelector/ProjectSelector'
import TabBar from '@shared/TabBar/TabBar'

type Step = 'script' | 'record' | 'edit'

interface TopBarProps {
  title: string
  onTitleChange: (title: string) => void
  isEdited?: boolean
  onCreateProject?: () => void
  onLoadProject?: () => void
  onDeleteProject?: () => void
  onSaveProject?: () => void | Promise<void>
  hasProject?: boolean
  currentStep?: Step
  onStepChange?: (step: Step) => void
  onExportClick?: () => void
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
  currentStep,
  onStepChange,
  onExportClick,
}: TopBarProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(title)
  const [isSaving, setIsSaving] = useState(false)

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

  const handleSaveProject = async () => {
    if (isSaving) return // Prevent multiple clicks
    
    setIsSaving(true)
    try {
      const result = onSaveProject?.()
      // Handle both sync and async cases
      if (result instanceof Promise) {
        await result
      }
    } catch (error) {
      console.error('Error saving project:', error)
      setIsSaving(false) // Re-enable on error
      return
    }
    
    // Keep button disabled and show "Data Saved" for 3 seconds
    setTimeout(() => {
      setIsSaving(false)
    }, 3000)
  }

  const [projects] = useState([{ id: 'default', name: 'Untitled' }])
  const [tabs, setTabs] = useState([{ id: '1', name: 'Recording 1' }])
  const [activeTabId, setActiveTabId] = useState('1')

  return (
    <div className="bg-gray-800 h-12 flex items-center justify-between px-4 border-b border-gray-700">
      <div className="flex items-center gap-4">
        <ProjectSelector
          projects={projects}
          currentProjectId="default"
          currentProjectName={title || 'Untitled'}
        />
        <div className="flex items-center gap-1 min-w-[120px] max-w-[200px]">
          <TabBar
            tabs={tabs}
            currentTabId={activeTabId}
            onSwitchTab={setActiveTabId}
            onAddTab={() => {
              const id = 't_' + Date.now()
              setTabs((prev) => [...prev, { id, name: 'Recording ' + (prev.length + 1) }])
              setActiveTabId(id)
            }}
            onRenameTab={(tabId, name) => {
              setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name } : t)))
            }}
            onDeleteTab={(tabId) => {
              if (tabs.length <= 1) return
              const nextTabs = tabs.filter((t) => t.id !== tabId)
              const nextActive = activeTabId === tabId ? (nextTabs[0]?.id ?? '1') : activeTabId
              setTabs(nextTabs)
              setActiveTabId(nextActive)
            }}
            defaultTabName="Recording"
            addTitle="Add recording"
          />
        </div>
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
            onClick={handleSaveProject}
            disabled={isSaving}
            className="flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors bg-gray-700 hover:bg-gray-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
            <span>{isSaving ? 'Data Saved' : 'Save Project'}</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 flex-1 justify-center">
        {/* Navigation Buttons - Script, Record, Edit */}
        {currentStep && onStepChange && (
          <div className="flex items-center gap-4">
            {[
              {
                id: 'script' as Step,
                label: 'Script',
                icon: (
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
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                ),
              },
              {
                id: 'record' as Step,
                label: 'Record',
                icon: (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <circle cx="12" cy="12" r="10" strokeWidth={2} />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                    />
                  </svg>
                ),
              },
              {
                id: 'edit' as Step,
                label: 'Edit',
                icon: (
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
                      d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
                    />
                  </svg>
                ),
              },
            ].map((step, index) => (
              <div key={step.id} className="flex items-center gap-2">
                <button
                  onClick={() => onStepChange(step.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                    currentStep === step.id
                      ? 'bg-white text-black'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {step.icon}
                  <span>{step.label}</span>
                </button>
                {index < 2 && (
                  <svg
                    className="w-4 h-4 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </div>
            ))}
            {/* Export Button */}
            {currentStep === 'edit' && onExportClick && (
              <>
                <svg
                  className="w-4 h-4 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <button
                  onClick={onExportClick}
                  className="flex items-center gap-2 px-4 py-2 rounded transition-colors text-gray-400 hover:text-white"
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  <span>Export</span>
                </button>
              </>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => {/* TODO: Implement undo */ }}
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
          onClick={() => {/* TODO: Implement redo */ }}
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

