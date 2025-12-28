import { useState, useEffect, useRef } from 'react'
import { Scene, RecordingTake } from '../App'
import DevicePanel from './DevicePanel'
import { projectManager } from '../utils/projectManager'

interface RecordStepProps {
  scenes: Scene[]
  onScenesChange: (scenes: Scene[]) => void
  onEditedChange: (edited: boolean) => void
}

export default function RecordStep({
  scenes,
  onScenesChange,
  onEditedChange,
}: RecordStepProps) {
  const [selectedSceneId, setSelectedSceneId] = useState<string>(
    scenes[0]?.id || ''
  )
  // Store thumbnails for recordings: key = `${sceneId}_${takeId}`, value = data URL
  const [thumbnails, setThumbnails] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    if (scenes.length > 0 && !scenes.find((s) => s.id === selectedSceneId)) {
      setSelectedSceneId(scenes[0].id)
    }
  }, [scenes, selectedSceneId])

  // Track which thumbnails we've attempted to generate (to avoid duplicates)
  const thumbnailGenerationAttemptedRef = useRef<Set<string>>(new Set())

  // Generate thumbnails for existing recordings that don't have thumbnails yet
  useEffect(() => {
    const generateMissingThumbnails = async () => {
      for (const scene of scenes) {
        for (const take of scene.recordings) {
          const thumbnailKey = `${scene.id}_${take.id}`
          // Only generate if we haven't attempted it yet and don't already have it
          if (!thumbnails.has(thumbnailKey) && !thumbnailGenerationAttemptedRef.current.has(thumbnailKey)) {
            // Only generate if we have a video blob
            const blob = take.cameraBlob || take.screenBlob || take.blob
            if (blob) {
              thumbnailGenerationAttemptedRef.current.add(thumbnailKey)
              await generateTakeThumbnail(take, scene.id)
            }
          }
        }
      }
    }
    generateMissingThumbnails()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]) // Only run when scenes change
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null)

  // Separate recorders for each layer
  const cameraRecorderRef = useRef<MediaRecorder | null>(null)
  const microphoneRecorderRef = useRef<MediaRecorder | null>(null)
  const screenRecorderRef = useRef<MediaRecorder | null>(null)

  // Separate chunks for each layer
  const cameraChunksRef = useRef<Blob[]>([])
  const microphoneChunksRef = useRef<Blob[]>([])
  const screenChunksRef = useRef<Blob[]>([])

  // Individual streams
  const cameraStreamRef = useRef<MediaStream | null>(null)
  const microphoneStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)

  // Legacy support
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingStartTimeRef = useRef<number>(0)
  const timerRef = useRef<number>()

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      // Stop all recorders
      if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') {
        cameraRecorderRef.current.stop()
      }
      if (microphoneRecorderRef.current && microphoneRecorderRef.current.state !== 'inactive') {
        microphoneRecorderRef.current.stop()
      }
      if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
        screenRecorderRef.current.stop()
      }
      // Legacy
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      }
      // Stop streams
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop())
      microphoneStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      mediaStream?.getTracks().forEach((track) => track.stop())
    }
  }, [mediaStream])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // Generate thumbnail from video blob
  const generateThumbnail = async (blob: Blob): Promise<string | null> => {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const url = URL.createObjectURL(blob)
      video.src = url
      video.preload = 'metadata'
      
      video.onloadedmetadata = () => {
        // Seek to 0.1 seconds to avoid black frames
        video.currentTime = Math.min(0.1, video.duration * 0.1)
      }
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8)
          URL.revokeObjectURL(url)
          resolve(thumbnailUrl)
        } else {
          URL.revokeObjectURL(url)
          resolve(null)
        }
      }
      
      video.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
    })
  }

  // Generate thumbnail for a recording take
  const generateTakeThumbnail = async (take: RecordingTake, sceneId: string) => {
    // Priority: camera > screen > legacy blob
    const blob = take.cameraBlob || take.screenBlob || take.blob
    if (blob) {
      const thumbnail = await generateThumbnail(blob)
      if (thumbnail) {
        setThumbnails(prev => {
          const next = new Map(prev)
          next.set(`${sceneId}_${take.id}`, thumbnail)
          return next
        })
      }
    }
  }

  const getSceneStatus = (scene: Scene): 'green' | 'orange' => {
    return scene.recordings.length > 0 ? 'green' : 'orange'
  }

  const startCountdown = (): Promise<void> => {
    return new Promise((resolve) => {
      setCountdown(3)
      const countdownInterval = setInterval(() => {
        setCountdown((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(countdownInterval)
            setCountdown(null)
            resolve()
            return null
          }
          return prev - 1
        })
      }, 1000)
    })
  }

  const stopHandlerRef = useRef<(() => Promise<void>) | null>(null)

  const startRecording = async (sceneId?: string) => {
    // Use provided sceneId or fall back to selectedSceneId
    const targetSceneId = sceneId || selectedSceneId
    
    // Check if at least one input is available
    const hasCamera = cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0
    const hasMicrophone = microphoneStreamRef.current && microphoneStreamRef.current.getAudioTracks().length > 0
    const hasScreen = screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0

    if (!hasCamera && !hasMicrophone && !hasScreen) {
      alert('Please enable at least one input device (camera, microphone, or screen)')
      return
    }

    if (isRecording) {
      return // Already recording
    }

    await startCountdown()

    try {
      // Determine which layers to record
      const hasCamera = cameraStreamRef.current && cameraStreamRef.current.getVideoTracks().length > 0
      const hasMicrophone = microphoneStreamRef.current && microphoneStreamRef.current.getAudioTracks().length > 0
      const hasScreen = screenStreamRef.current && screenStreamRef.current.getVideoTracks().length > 0

      console.log('Starting separate layer recording:', {
        hasCamera,
        hasMicrophone,
        hasScreen
      })

      recordingStartTimeRef.current = Date.now()

      // Determine mime types for each layer
      const videoMimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4'

      const audioMimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/ogg'

      // Record camera separately
      if (hasCamera && cameraStreamRef.current) {
        cameraChunksRef.current = []
        const cameraRecorder = new MediaRecorder(cameraStreamRef.current, {
          mimeType: videoMimeType,
          videoBitsPerSecond: 2500000
        })

        cameraRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            cameraChunksRef.current.push(event.data)
          }
        }

        cameraRecorder.start(250)
        cameraRecorderRef.current = cameraRecorder
        console.log('Camera recorder started')
      }

      // Record microphone separately
      if (hasMicrophone && microphoneStreamRef.current) {
        microphoneChunksRef.current = []
        const microphoneRecorder = new MediaRecorder(microphoneStreamRef.current, {
          mimeType: audioMimeType,
          audioBitsPerSecond: 128000
        })

        microphoneRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            microphoneChunksRef.current.push(event.data)
          }
        }

        microphoneRecorder.start(250)
        microphoneRecorderRef.current = microphoneRecorder
        console.log('Microphone recorder started')
      }

      // Record screen separately
      if (hasScreen && screenStreamRef.current) {
        screenChunksRef.current = []
        const screenRecorder = new MediaRecorder(screenStreamRef.current, {
          mimeType: videoMimeType,
          videoBitsPerSecond: 2500000
        })

        screenRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            screenChunksRef.current.push(event.data)
          }
        }

        screenRecorder.start(250)
        screenRecorderRef.current = screenRecorder
        console.log('Screen recorder started')
      }

      // Track which recorders have stopped
      const stoppedRecorders = {
        camera: !cameraRecorderRef.current,
        microphone: !microphoneRecorderRef.current,
        screen: !screenRecorderRef.current
      }

      // Set up stop handler with race condition protection
      const handleStop = async () => {
        try {
          // Wait a bit for all recorders to finish collecting data
          await new Promise(resolve => setTimeout(resolve, 500))

        const duration = (Date.now() - recordingStartTimeRef.current) / 1000

        // Create blobs for each layer
        const cameraBlob = cameraChunksRef.current.length > 0
          ? new Blob(cameraChunksRef.current, { type: videoMimeType })
          : undefined
        const microphoneBlob = microphoneChunksRef.current.length > 0
          ? new Blob(microphoneChunksRef.current, { type: audioMimeType })
          : undefined
        const screenBlob = screenChunksRef.current.length > 0
          ? new Blob(screenChunksRef.current, { type: videoMimeType })
          : undefined

        console.log('Recording stopped. Layers:', {
          camera: cameraBlob?.size || 0,
          microphone: microphoneBlob?.size || 0,
          screen: screenBlob?.size || 0,
          duration
        })

        // Delete old take from this scene if it exists
        const currentScene = scenes.find(s => s.id === targetSceneId)
        if (currentScene && currentScene.recordings.length > 0) {
          const oldTake = currentScene.recordings[0]
          // Delete old recording files from project folder
          if (projectManager.hasProject()) {
            try {
              // Delete all layers of the old take
              if (oldTake.hasCamera) {
                await projectManager.deleteRecording(targetSceneId, `${oldTake.id}_camera`)
              }
              if (oldTake.hasMicrophone) {
                await projectManager.deleteRecording(targetSceneId, `${oldTake.id}_microphone`)
              }
              if (oldTake.hasScreen) {
                await projectManager.deleteRecording(targetSceneId, `${oldTake.id}_screen`)
              }
              // Also try legacy format in case it exists
              await projectManager.deleteRecording(targetSceneId, oldTake.id)
            } catch (error) {
              console.error('Error deleting old recording from project:', error)
            }
          }
        }

        const newTake: RecordingTake = {
          id: Date.now().toString(),
          cameraBlob,
          microphoneBlob,
          screenBlob,
          duration,
          timestamp: Date.now(),
          selected: true, // Only take, always selected
          hasCamera: !!cameraBlob,
          hasMicrophone: !!microphoneBlob,
          hasScreen: !!screenBlob,
        }

        // Replace recordings array with just the new take (only one take per scene)
        const updatedScenes = scenes.map((scene) => {
          if (scene.id === targetSceneId) {
            return {
              ...scene,
              recordings: [newTake],
            }
          }
          return scene
        })

        onScenesChange(updatedScenes)

        // Save recordings to project folder if project exists
        if (projectManager.hasProject()) {
          try {
            if (cameraBlob) {
              await projectManager.saveRecording(targetSceneId, `${newTake.id}_camera`, cameraBlob)
            }
            if (microphoneBlob) {
              await projectManager.saveRecording(targetSceneId, `${newTake.id}_microphone`, microphoneBlob)
            }
            if (screenBlob) {
              await projectManager.saveRecording(targetSceneId, `${newTake.id}_screen`, screenBlob)
            }
          } catch (error) {
            console.error('Error saving recordings to project:', error)
          }
        }

          // Generate thumbnail for the new recording
          await generateTakeThumbnail(newTake, targetSceneId)

          onEditedChange(true)
          setRecordingTime(0)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = undefined
          }
        } catch (error) {
          console.error('Error in handleStop:', error)
          // Still update UI state even if there's an error
          setIsRecording(false)
          setIsPaused(false)
          setRecordingTime(0)
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = undefined
          }
          alert('Error stopping recording: ' + (error instanceof Error ? error.message : 'Unknown error'))
        }
      }

      // Check if all recorders have stopped
      const checkAllStopped = () => {
        if (stoppedRecorders.camera && stoppedRecorders.microphone && stoppedRecorders.screen) {
          handleStop()
        }
      }

      // Set up onstop handlers for all recorders with error handling
      if (cameraRecorderRef.current) {
        cameraRecorderRef.current.onstop = () => {
          try {
            stoppedRecorders.camera = true
            checkAllStopped()
          } catch (error) {
            console.error('Error in camera recorder onstop:', error)
            stoppedRecorders.camera = true
            checkAllStopped() // Still check even on error
          }
        }
        cameraRecorderRef.current.onerror = (event) => {
          console.error('Camera recorder error:', event)
          stoppedRecorders.camera = true
          checkAllStopped()
        }
      }

      if (microphoneRecorderRef.current) {
        microphoneRecorderRef.current.onstop = () => {
          try {
            stoppedRecorders.microphone = true
            checkAllStopped()
          } catch (error) {
            console.error('Error in microphone recorder onstop:', error)
            stoppedRecorders.microphone = true
            checkAllStopped() // Still check even on error
          }
        }
        microphoneRecorderRef.current.onerror = (event) => {
          console.error('Microphone recorder error:', event)
          stoppedRecorders.microphone = true
          checkAllStopped()
        }
      }

      if (screenRecorderRef.current) {
        screenRecorderRef.current.onstop = () => {
          try {
            stoppedRecorders.screen = true
            checkAllStopped()
          } catch (error) {
            console.error('Error in screen recorder onstop:', error)
            stoppedRecorders.screen = true
            checkAllStopped() // Still check even on error
          }
        }
        screenRecorderRef.current.onerror = (event) => {
          console.error('Screen recorder error:', event)
          stoppedRecorders.screen = true
          checkAllStopped()
        }
      }

      // If no recorders were started, call handler immediately
      checkAllStopped()

      setIsRecording(true)
      setIsPaused(false)

      // Start timer
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1)
      }, 1000)
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording')
    }
  }

  const pauseRecording = () => {
    if (cameraRecorderRef.current && cameraRecorderRef.current.state === 'recording') {
      cameraRecorderRef.current.pause()
    }
    if (microphoneRecorderRef.current && microphoneRecorderRef.current.state === 'recording') {
      microphoneRecorderRef.current.pause()
    }
    if (screenRecorderRef.current && screenRecorderRef.current.state === 'recording') {
      screenRecorderRef.current.pause()
    }
    setIsPaused(true)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
  }

  const resumeRecording = () => {
    if (cameraRecorderRef.current && cameraRecorderRef.current.state === 'paused') {
      cameraRecorderRef.current.resume()
    }
    if (microphoneRecorderRef.current && microphoneRecorderRef.current.state === 'paused') {
      microphoneRecorderRef.current.resume()
    }
    if (screenRecorderRef.current && screenRecorderRef.current.state === 'paused') {
      screenRecorderRef.current.resume()
    }
    setIsPaused(false)
    timerRef.current = window.setInterval(() => {
      setRecordingTime((prev) => prev + 1)
    }, 1000)
  }

  const stopRecording = () => {
    // Stop all recorders
    if (cameraRecorderRef.current && cameraRecorderRef.current.state !== 'inactive') {
      cameraRecorderRef.current.stop()
    }
    if (microphoneRecorderRef.current && microphoneRecorderRef.current.state !== 'inactive') {
      microphoneRecorderRef.current.stop()
    }
    if (screenRecorderRef.current && screenRecorderRef.current.state !== 'inactive') {
      screenRecorderRef.current.stop()
    }

    setIsRecording(false)
    setIsPaused(false)

    // The stop handler will be called automatically when all recorders stop
  }

  const handleDeleteTake = async (sceneId: string, takeId: string) => {
    if (confirm('Are you sure you want to delete this take?')) {
      const scene = scenes.find(s => s.id === sceneId)
      const take = scene?.recordings.find(t => t.id === takeId)
      
      // Delete recording files from project folder if project exists
      if (projectManager.hasProject() && take) {
        try {
          // Delete all layers of the take
          if (take.hasCamera) {
            await projectManager.deleteRecording(sceneId, `${takeId}_camera`)
          }
          if (take.hasMicrophone) {
            await projectManager.deleteRecording(sceneId, `${takeId}_microphone`)
          }
          if (take.hasScreen) {
            await projectManager.deleteRecording(sceneId, `${takeId}_screen`)
          }
          // Also try legacy format in case it exists
          await projectManager.deleteRecording(sceneId, takeId)
        } catch (error) {
          console.error('Error deleting recording from project:', error)
        }
      }
      
      // Remove the take from the scene (empty recordings array)
      const updatedScenes = scenes.map((scene) => {
        if (scene.id === sceneId) {
          return {
            ...scene,
            recordings: [],
          }
        }
        return scene
      })
      
      // Remove thumbnail
      setThumbnails(prev => {
        const next = new Map(prev)
        next.delete(`${sceneId}_${takeId}`)
        return next
      })
      
      onScenesChange(updatedScenes)
      onEditedChange(true)
    }
  }

  const handleImportFile = (sceneId: string) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'video/*'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const blob = file as Blob
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.onloadedmetadata = async () => {
          window.URL.revokeObjectURL(video.src)
          const duration = video.duration

          // Delete old take from this scene if it exists
          const currentScene = scenes.find(s => s.id === sceneId)
          if (currentScene && currentScene.recordings.length > 0) {
            const oldTake = currentScene.recordings[0]
            // Delete old recording files from project folder
            if (projectManager.hasProject()) {
              try {
                // Delete all layers of the old take
                if (oldTake.hasCamera) {
                  await projectManager.deleteRecording(sceneId, `${oldTake.id}_camera`)
                }
                if (oldTake.hasMicrophone) {
                  await projectManager.deleteRecording(sceneId, `${oldTake.id}_microphone`)
                }
                if (oldTake.hasScreen) {
                  await projectManager.deleteRecording(sceneId, `${oldTake.id}_screen`)
                }
                // Also try legacy format in case it exists
                await projectManager.deleteRecording(sceneId, oldTake.id)
              } catch (error) {
                console.error('Error deleting old recording from project:', error)
              }
            }
          }

          const newTake: RecordingTake = {
            id: Date.now().toString(),
            blob,
            duration,
            timestamp: Date.now(),
            selected: true, // Only take, always selected
          }

          // Replace recordings array with just the new take (only one take per scene)
          const updatedScenes = scenes.map((scene) => {
            if (scene.id === sceneId) {
              return {
                ...scene,
                recordings: [newTake],
              }
            }
            return scene
          })

          onScenesChange(updatedScenes)
          // Save recording to project folder if project exists
          if (projectManager.hasProject()) {
            try {
              await projectManager.saveRecording(sceneId, newTake.id, blob)
            } catch (error) {
              console.error('Error saving imported recording to project:', error)
            }
          }
          // Generate thumbnail for the imported recording
          await generateTakeThumbnail(newTake, sceneId)
          onEditedChange(true)
        }
        video.src = URL.createObjectURL(blob)
      }
    }
    input.click()
  }

  const selectedScene = scenes.find((s) => s.id === selectedSceneId)

  return (
    <div className="flex h-full">
      <DevicePanel
        onStreamChange={setMediaStream}
        onCameraStreamChange={(stream) => {
          cameraStreamRef.current = stream
        }}
        onMicrophoneStreamChange={(stream) => {
          microphoneStreamRef.current = stream
        }}
        onScreenStreamChange={(stream) => {
          screenStreamRef.current = stream
        }}
      />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-4">
          {scenes.map((scene, index) => {
            const isSelected = scene.id === selectedSceneId
            const status = getSceneStatus(scene)
            const hasRecordings = scene.recordings.length > 0

            return (
              <div
                key={scene.id}
                onClick={() => setSelectedSceneId(scene.id)}
                className={`p-4 rounded-lg cursor-pointer transition-colors ${isSelected
                  ? 'bg-gray-800 border-2 border-gray-400'
                  : 'bg-gray-900 border-2 border-transparent hover:bg-gray-800'
                  }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-2 h-2 rounded-full ${status === 'green' ? 'bg-gray-300' : 'bg-gray-700'
                      }`}
                  />
                  <span className="text-gray-400 text-sm">Scene {index + 1}</span>
                </div>
                <h3 className="text-white text-lg font-medium mb-3">{scene.title}</h3>

                {isSelected && isRecording && (
                  <div className="mb-3 p-3 bg-red-900/20 border border-red-500 rounded">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="text-white font-medium">
                          Recording {formatTime(recordingTime)}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {isPaused ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              resumeRecording()
                            }}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-700 rounded text-sm"
                          >
                            Resume
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              pauseRecording()
                            }}
                            className="px-3 py-1 bg-gray-700 hover:bg-gray-700 rounded text-sm"
                          >
                            Pause
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            stopRecording()
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {countdown !== null && isSelected && (
                  <div className="mb-3 text-center">
                    <div className="text-6xl font-bold text-white">{countdown}</div>
                  </div>
                )}

                {!isRecording && (
                  <div className="flex items-center gap-3 mb-3">
                    {hasRecordings ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isSelected) {
                              setSelectedSceneId(scene.id)
                            }
                            // Start recording with the scene ID directly to avoid race conditions
                            startRecording(scene.id)
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-700 rounded text-sm"
                        >
                          Record
                        </button>
                        <span className="text-gray-500 text-sm">or</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImportFile(scene.id)
                          }}
                          className="text-gray-400 hover:text-white text-sm underline"
                        >
                          Import from file.
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (!isSelected) {
                              setSelectedSceneId(scene.id)
                            }
                            // Start recording with the scene ID directly to avoid race conditions
                            startRecording(scene.id)
                          }}
                          className="px-4 py-2 bg-gray-700 hover:bg-gray-700 rounded text-sm"
                        >
                          Record
                        </button>
                        <span className="text-gray-500 text-sm">or</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleImportFile(scene.id)
                          }}
                          className="text-gray-400 hover:text-white text-sm underline"
                        >
                          Import from file.
                        </button>
                      </>
                    )}
                  </div>
                )}

                {hasRecordings && scene.recordings.length > 0 && (
                  <div className="flex items-center gap-3 p-2 rounded bg-gray-800 border border-gray-600">
                    {(() => {
                      const take = scene.recordings[0]
                      const thumbnailKey = `${scene.id}_${take.id}`
                      const thumbnail = thumbnails.get(thumbnailKey)
                      return (
                        <>
                          {thumbnail && (
                            <img
                              src={thumbnail}
                              alt="Video thumbnail"
                              className="w-20 h-12 object-cover rounded flex-shrink-0"
                            />
                          )}
                          {!thumbnail && (
                            <div className="w-20 h-12 bg-gray-700 rounded flex-shrink-0 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1">
                            <span className="text-white text-sm">
                              {formatTime(take.duration)}
                            </span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteTake(scene.id, take.id)
                            }}
                            className="text-red-400 hover:text-red-300 text-sm"
                          >
                            Delete
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}
              </div>
            )
          })}

          <button
            onClick={() => {
              const newScene: Scene = {
                id: Date.now().toString(),
                title: `Scene ${scenes.length + 1}`,
                description: '',
                recordings: [],
              }
              onScenesChange([...scenes, newScene])
              onEditedChange(true)
            }}
            className="text-white hover:text-gray-300 transition-colors"
          >
            + Add scene
          </button>
        </div>
      </div>
    </div>
  )
}
