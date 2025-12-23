import { Scene } from '../App'
import SceneItem from './SceneItem'

interface ScriptStepProps {
  scenes: Scene[]
  onAddScene: () => void
  onUpdateScene: (id: string, updates: Partial<Scene>) => void
  onDeleteScene: (id: string) => void
}

export default function ScriptStep({
  scenes,
  onAddScene,
  onUpdateScene,
  onDeleteScene,
}: ScriptStepProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-full max-w-3xl px-8">
        <div className="space-y-1">
          {scenes.map((scene, index) => (
            <SceneItem
              key={scene.id}
              scene={scene}
              sceneNumber={index + 1}
              onUpdate={(updates) => onUpdateScene(scene.id, updates)}
              onDelete={() => onDeleteScene(scene.id)}
            />
          ))}
        </div>
        <button
          onClick={onAddScene}
          className="mt-6 text-white hover:text-gray-300 transition-colors text-base"
        >
          + Add scene
        </button>
      </div>
    </div>
  )
}

