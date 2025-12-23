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
  const [isEditing, setIsEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(scene.title)

  const handleSave = () => {
    onUpdate({ title: editTitle })
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave()
    } else if (e.key === 'Escape') {
      setEditTitle(scene.title)
      setIsEditing(false)
    }
  }

  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="text-gray-400 text-sm whitespace-nowrap">
        Scene {sceneNumber}
      </span>
      <div className="w-0.5 h-6 bg-green-500"></div>
      {isEditing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent border-none outline-none text-white text-base"
          autoFocus
        />
      ) : (
        <span
          className="text-white text-base cursor-pointer hover:text-gray-300 flex-1"
          onClick={() => setIsEditing(true)}
        >
          {scene.title || `Scene ${sceneNumber}`}
        </span>
      )}
    </div>
  )
}

