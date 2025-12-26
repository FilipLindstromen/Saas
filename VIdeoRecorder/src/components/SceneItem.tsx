import { useState } from 'react'
import { Scene } from '../App'

interface SceneItemProps {
  scene: Scene
  sceneNumber: number
  onUpdate: (updates: Partial<Scene>) => void
  onDelete: () => void
}

export default function SceneItem({
  scene,
  sceneNumber,
  onUpdate,
  onDelete,
}: SceneItemProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [isEditingDescription, setIsEditingDescription] = useState(false)
  const [editTitle, setEditTitle] = useState(scene.title)
  const [editDescription, setEditDescription] = useState(scene.description || '')

  const handleSaveTitle = () => {
    onUpdate({ title: editTitle })
    setIsEditingTitle(false)
  }

  const handleSaveDescription = () => {
    onUpdate({ description: editDescription })
    setIsEditingDescription(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle()
    } else if (e.key === 'Escape') {
      setEditTitle(scene.title)
      setIsEditingTitle(false)
    }
  }

  const handleDescriptionKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setEditDescription(scene.description || '')
      setIsEditingDescription(false)
    }
    // Allow Shift+Enter for new lines, Enter alone saves
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveDescription()
    }
  }

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-gray-400 text-sm whitespace-nowrap">
          Scene {sceneNumber}
        </span>
        <div className="w-0.5 h-6 bg-green-500"></div>
        {isEditingTitle ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={handleTitleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-white text-base"
            autoFocus
          />
        ) : (
          <span
            className="text-white text-base cursor-pointer hover:text-gray-300 flex-1"
            onClick={() => setIsEditingTitle(true)}
          >
            {scene.title || `Scene ${sceneNumber}`}
          </span>
        )}
      </div>
      
      {/* Description */}
      <div className="ml-12">
        {isEditingDescription ? (
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            onBlur={handleSaveDescription}
            onKeyDown={handleDescriptionKeyDown}
            placeholder="Add a description (optional)"
            className="w-full bg-transparent border border-gray-600 rounded px-2 py-1 text-gray-300 text-sm outline-none focus:border-gray-400 resize-none"
            rows={2}
            autoFocus
          />
        ) : (
          <div
            className="text-gray-400 text-sm cursor-pointer hover:text-gray-300 min-h-[1.5rem]"
            onClick={() => setIsEditingDescription(true)}
          >
            {scene.description || (
              <span className="italic text-gray-500">Click to add description (optional)</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

