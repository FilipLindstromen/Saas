import { useState, useEffect, useCallback, useRef } from 'react'
import TopBar from './components/TopBar'
import ScriptStep from './components/ScriptStep'
import RecordStep from './components/RecordStep'
import EditStep from './components/EditStep'
import BottomNavigation from './components/BottomNavigation'
import { projectManager } from './utils/projectManager'
import type { ProjectData } from './utils/projectManager'

export type Step = 'script' | 'record' | 'edit'

export interface RecordingTake {
  id: string
  // Separate files for each layer
  cameraBlob?: Blob // Camera video file
  microphoneBlob?: Blob // Microphone audio file
  screenBlob?: Blob // Screen video file
  // Legacy support - combined blob (deprecated)
  blob?: Blob
  duration: number // in seconds
  timestamp: number
  selected: boolean
  // Metadata about what was recorded
  hasCamera: boolean
  hasMicrophone: boolean
  hasScreen: boolean
}

export interface Scene {
  id: string
  title: string
  description: string
  recordings: RecordingTake[]
}

function App() {
  // Restore last step from localStorage
  const getInitialStep = (): Step => {
    const lastStep = localStorage.getItem('lastSelectedStep')
    if (lastStep === 'script' || lastStep === 'record' || lastStep === 'edit') {
      return lastStep
    }
    return 'script'
  }
  
  const [currentStep, setCurrentStep] = useState<Step>(getInitialStep())
  
  // Save step to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('lastSelectedStep', currentStep)
  }, [currentStep])
  const [scenes, setScenes] = useState<Scene[]>([
    { id: '1', title: 'Intro', description: '', recordings: [] },
    { id: '2', title: 'Speaking part of the brain', description: '', recordings: [] },
    { id: '3', title: 'Quiet part of the brain', description: '', recordings: [] },
  ])
  const [isEdited, setIsEdited] = useState(false)
  const [projectTitle, setProjectTitle] = useState('Untitled')
  const [hasProject, setHasProject] = useState(false)
  const [showExportDialog, setShowExportDialog] = useState(false)
  const saveEditDataRef = useRef<(() => Promise<void>) | null>(null)

  // Restore last project on mount
  useEffect(() => {
    const restoreLastProject = async () => {
      try {
        const projectHandle = await projectManager.restoreLastProject()
        if (projectHandle) {
          setProjectTitle(projectHandle.data.title)
          setScenes(projectHandle.data.scenes)
          setHasProject(true)
          setIsEdited(false)
        }
      } catch (error) {
        console.error('Error restoring last project:', error)
      }
    }
    restoreLastProject()
  }, [])

  // Save project data (scenes, title, etc.)
  const saveProject = useCallback(async (scenesToSave?: Scene[], titleToSave?: string) => {
    if (!hasProject) return

    // Use provided values or current state
    const scenesData = scenesToSave || scenes
    const titleData = titleToSave !== undefined ? titleToSave : projectTitle

    try {
      const projectData: ProjectData = {
        id: projectManager.getCurrentProject()?.data.id || Date.now().toString(),
        title: titleData,
        scenes: scenesData.map((scene) => ({
          id: scene.id,
          title: scene.title || '',
          description: scene.description || '',
          recordings: (scene.recordings || []).map((take) => ({
            id: take.id,
            duration: take.duration,
            timestamp: take.timestamp,
            selected: take.selected,
            hasCamera: take.hasCamera || false,
            hasMicrophone: take.hasMicrophone || false,
            hasScreen: take.hasScreen || false,
            blob: undefined, // Don't store blob in JSON, it's in the file system
            cameraBlob: undefined,
            microphoneBlob: undefined,
            screenBlob: undefined,
          })),
        })),
        createdAt: projectManager.getCurrentProject()?.data.createdAt || Date.now(),
        updatedAt: Date.now(),
      }
      await projectManager.saveProject(projectData)
      setIsEdited(false)
    } catch (error) {
      console.error('Error saving project:', error)
    }
  }, [hasProject, projectTitle, scenes])

  const handleCreateProject = async () => {
    try {
      const projectHandle = await projectManager.createNewProject(projectTitle)
      setProjectTitle(projectHandle.data.title)
      setScenes(projectHandle.data.scenes)
      setHasProject(true)
      setIsEdited(false)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        alert('Failed to create project. Make sure your browser supports the File System Access API.')
      }
    }
  }

  const handleLoadProject = async () => {
    try {
      const projectHandle = await projectManager.loadProject()
      setProjectTitle(projectHandle.data.title)
      setScenes(projectHandle.data.scenes)
      setHasProject(true)
      setIsEdited(false)
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        alert('Failed to load project: ' + (error as Error).message)
      }
    }
  }

  const handleDeleteProject = async () => {
    try {
      await projectManager.deleteProject()
      setHasProject(false)
      setProjectTitle('Untitled')
      setScenes([
        { id: '1', title: 'Intro', description: '', recordings: [] },
        { id: '2', title: 'Speaking part of the brain', description: '', recordings: [] },
        { id: '3', title: 'Quiet part of the brain', description: '', recordings: [] },
      ])
      setIsEdited(false)
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const handleSaveProject = async () => {
    // Force save with current state to avoid stale closure issues
    if (!hasProject) return

    try {
      // Save project data (scenes, title, etc.)
      const projectData: ProjectData = {
        id: projectManager.getCurrentProject()?.data.id || Date.now().toString(),
        title: projectTitle,
        scenes: scenes.map((scene) => ({
          id: scene.id,
          title: scene.title || '',
          description: scene.description || '',
          recordings: (scene.recordings || []).map((take) => ({
            id: take.id,
            duration: take.duration,
            timestamp: take.timestamp,
            selected: take.selected,
            hasCamera: take.hasCamera || false,
            hasMicrophone: take.hasMicrophone || false,
            hasScreen: take.hasScreen || false,
            blob: undefined, // Don't store blob in JSON, it's in the file system
            cameraBlob: undefined,
            microphoneBlob: undefined,
            screenBlob: undefined,
          })),
        })),
        createdAt: projectManager.getCurrentProject()?.data.createdAt || Date.now(),
        updatedAt: Date.now(),
      }
      await projectManager.saveProject(projectData)

      // Save edit data (timeline clips, layout clips, settings, etc.)
      if (saveEditDataRef.current) {
        try {
          await saveEditDataRef.current()
          console.log('Edit data saved successfully')
        } catch (error) {
          console.error('Error saving edit data:', error)
          // Don't fail the entire save if edit data save fails
        }
      } else {
        console.warn('Edit data save function not available - EditStep may not be mounted')
      }

      setIsEdited(false)
    } catch (error) {
      console.error('Error saving project:', error)
      alert('Failed to save project: ' + (error as Error).message)
    }
  }

  const handleAddScene = () => {
    const newScene: Scene = {
      id: Date.now().toString(),
      title: `Scene ${scenes.length + 1}`,
      description: '',
      recordings: [],
    }
    setScenes([...scenes, newScene])
    setIsEdited(true)
  }

  const handleUpdateScene = (id: string, updates: Partial<Scene>) => {
    setScenes(
      scenes.map((scene) => (scene.id === id ? { ...scene, ...updates } : scene))
    )
    setIsEdited(true)
  }

  const handleDeleteScene = (id: string) => {
    setScenes(scenes.filter((scene) => scene.id !== id))
    setIsEdited(true)
  }

  const handleProjectTitleChange = (title: string) => {
    setProjectTitle(title)
    setIsEdited(true)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'script':
        return (
          <ScriptStep
            scenes={scenes}
            onAddScene={handleAddScene}
            onUpdateScene={handleUpdateScene}
            onDeleteScene={handleDeleteScene}
          />
        )
      case 'record':
        return (
          <RecordStep
            scenes={scenes}
            onScenesChange={setScenes}
            onEditedChange={setIsEdited}
          />
        )
      case 'edit':
        return (
          <EditStep
            scenes={scenes}
            onScenesChange={setScenes}
            showExportDialog={showExportDialog}
            onExportDialogChange={setShowExportDialog}
            onSaveRequest={(saveFn) => {
              saveEditDataRef.current = saveFn
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="flex flex-col h-screen bg-black text-white">
      <TopBar
        title={projectTitle}
        onTitleChange={handleProjectTitleChange}
        isEdited={isEdited}
        onCreateProject={handleCreateProject}
        onLoadProject={handleLoadProject}
        onDeleteProject={handleDeleteProject}
        onSaveProject={handleSaveProject}
        hasProject={hasProject}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onExportClick={() => setShowExportDialog(true)}
      />
      <div className="flex-1 overflow-auto">{renderStep()}</div>
    </div>
  )
}

export default App

