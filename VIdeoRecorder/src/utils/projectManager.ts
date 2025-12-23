import { Scene } from '../App'

export interface ProjectData {
  id: string
  title: string
  scenes: Scene[]
  createdAt: number
  updatedAt: number
}

export interface ProjectHandle {
  directoryHandle: FileSystemDirectoryHandle
  data: ProjectData
}

class ProjectManager {
  private currentProject: ProjectHandle | null = null
  private readonly LAST_PROJECT_KEY = 'lastProjectHandle'

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('ProjectManagerDB', 1)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('handles')) {
          db.createObjectStore('handles')
        }
      }
    })
  }

  private async saveLastProject(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction(['handles'], 'readwrite')
      const store = transaction.objectStore('handles')
      await new Promise<void>((resolve, reject) => {
        const request = store.put(directoryHandle, this.LAST_PROJECT_KEY)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error saving last project:', error)
    }
  }

  private async getLastProject(): Promise<FileSystemDirectoryHandle | null> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction(['handles'], 'readonly')
      const store = transaction.objectStore('handles')
      return await new Promise<FileSystemDirectoryHandle | null>((resolve, reject) => {
        const request = store.get(this.LAST_PROJECT_KEY)
        request.onsuccess = () => {
          const handle = request.result
          // Verify the handle is still valid by checking if we can access it
          if (handle) {
            // Test if handle is still valid
            handle.getFileHandle('project.json', { create: false })
              .then(() => resolve(handle))
              .catch(() => resolve(null)) // Handle is invalid
          } else {
            resolve(null)
          }
        }
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error loading last project:', error)
      return null
    }
  }

  private async clearLastProject(): Promise<void> {
    try {
      const db = await this.initDB()
      const transaction = db.transaction(['handles'], 'readwrite')
      const store = transaction.objectStore('handles')
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(this.LAST_PROJECT_KEY)
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    } catch (error) {
      console.error('Error clearing last project:', error)
    }
  }

  async restoreLastProject(): Promise<ProjectHandle | null> {
    try {
      const directoryHandle = await this.getLastProject()
      if (!directoryHandle) {
        return null
      }

      // Try to load project.json
      let projectData: ProjectData
      try {
        const fileHandle = await directoryHandle.getFileHandle('project.json')
        const file = await fileHandle.getFile()
        const text = await file.text()
        projectData = JSON.parse(text)
      } catch (error) {
        // Project.json not found or invalid, clear the stored handle
        await this.clearLastProject()
        return null
      }

      this.currentProject = {
        directoryHandle,
        data: projectData,
      }

      return this.currentProject
    } catch (error) {
      console.error('Error restoring last project:', error)
      await this.clearLastProject()
      return null
    }
  }

  async createNewProject(title: string = 'Untitled'): Promise<ProjectHandle> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error(
        'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.'
      )
    }

    try {
      // Request a directory handle for the new project
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      })

      const projectData: ProjectData = {
        id: Date.now().toString(),
        title,
        scenes: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }

      // Create recordings subfolder
      const recordingsHandle = await directoryHandle.getDirectoryHandle(
        'recordings',
        { create: true }
      )

      // Save project data
      await this.saveProjectData(directoryHandle, projectData)

      this.currentProject = {
        directoryHandle,
        data: projectData,
      }

      // Save as last project
      await this.saveLastProject(directoryHandle)

      return this.currentProject
    } catch (error) {
      // User cancelled or API not available
      console.error('Error creating project:', error)
      throw error
    }
  }

  async loadProject(): Promise<ProjectHandle> {
    if (!('showDirectoryPicker' in window)) {
      throw new Error(
        'File System Access API is not supported in this browser. Please use Chrome, Edge, or Opera.'
      )
    }

    try {
      const directoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      })

      // Try to load project.json
      let projectData: ProjectData
      try {
        const fileHandle = await directoryHandle.getFileHandle('project.json')
        const file = await fileHandle.getFile()
        const text = await file.text()
        projectData = JSON.parse(text)
      } catch (error) {
        throw new Error('No project.json found in selected folder')
      }

      this.currentProject = {
        directoryHandle,
        data: projectData,
      }

      // Save as last project
      await this.saveLastProject(directoryHandle)

      return this.currentProject
    } catch (error) {
      console.error('Error loading project:', error)
      throw error
    }
  }

  async saveProject(projectData: ProjectData): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project loaded')
    }

    projectData.updatedAt = Date.now()
    await this.saveProjectData(
      this.currentProject.directoryHandle,
      projectData
    )
    this.currentProject.data = projectData
  }

  private async saveProjectData(
    directoryHandle: FileSystemDirectoryHandle,
    projectData: ProjectData
  ): Promise<void> {
    const fileHandle = await directoryHandle.getFileHandle('project.json', {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(JSON.stringify(projectData, null, 2))
    await writable.close()
  }

  async saveRecording(
    sceneId: string,
    takeId: string,
    blob: Blob
  ): Promise<void> {
    if (!this.currentProject) {
      throw new Error('No project loaded')
    }

    const recordingsHandle = await this.currentProject.directoryHandle.getDirectoryHandle(
      'recordings',
      { create: true }
    )

    const fileName = `${sceneId}_${takeId}.webm`
    const fileHandle = await recordingsHandle.getFileHandle(fileName, {
      create: true,
    })
    const writable = await fileHandle.createWritable()
    await writable.write(blob)
    await writable.close()
  }

  async loadRecording(
    sceneId: string,
    takeId: string
  ): Promise<Blob | null> {
    if (!this.currentProject) {
      return null
    }

    try {
      const recordingsHandle = await this.currentProject.directoryHandle.getDirectoryHandle(
        'recordings',
        { create: false }
      )
      const fileName = `${sceneId}_${takeId}.webm`
      const fileHandle = await recordingsHandle.getFileHandle(fileName)
      const file = await fileHandle.getFile()
      return file
    } catch (error) {
      console.error('Error loading recording:', error)
      return null
    }
  }

  async deleteRecording(sceneId: string, takeId: string): Promise<void> {
    if (!this.currentProject) {
      return
    }

    try {
      const recordingsHandle = await this.currentProject.directoryHandle.getDirectoryHandle(
        'recordings',
        { create: false }
      )
      const fileName = `${sceneId}_${takeId}.webm`
      await recordingsHandle.removeEntry(fileName)
    } catch (error) {
      console.error('Error deleting recording:', error)
    }
  }

  async deleteProject(): Promise<void> {
    if (!this.currentProject) {
      return
    }

    // Note: File System Access API doesn't allow deleting directories directly
    // We can only remove files. The user would need to delete the folder manually.
    // For now, we'll just clear the current project reference.
    this.currentProject = null
    
    // Clear last project from storage
    await this.clearLastProject()
  }

  getCurrentProject(): ProjectHandle | null {
    return this.currentProject
  }

  hasProject(): boolean {
    return this.currentProject !== null
  }

  // Fallback method for browsers without File System Access API
  async exportProject(projectData: ProjectData, recordings: Map<string, Blob>): Promise<void> {
    // Create a zip-like structure using JSZip or similar
    // For now, we'll use a simple download approach
    const dataStr = JSON.stringify(projectData, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    
    // Download project.json
    const url = URL.createObjectURL(dataBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectData.title || 'project'}.json`
    a.click()
    URL.revokeObjectURL(url)

    // Note: For full implementation, we'd need JSZip to bundle recordings
    // This is a simplified version
  }

  async importProject(file: File): Promise<ProjectData> {
    const text = await file.text()
    return JSON.parse(text)
  }
}

export const projectManager = new ProjectManager()

