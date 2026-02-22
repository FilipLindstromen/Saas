import React, { useState, useEffect } from 'react'
import QuizEditor from './components/QuizEditor'
import AppTopBar from '@shared/AppTopBar/AppTopBar'
import ThemeToggle from '@shared/ThemeToggle'
import SettingsModal from '@shared/SettingsModal/SettingsModal'
import { getTheme, initThemeSync } from '@shared/theme'
import './App.css'

function App() {
  const [projects] = useState([{ id: 'default', name: 'Untitled' }])
  const [tabs, setTabs] = useState([{ id: '1', name: 'Quiz 1' }])
  const [activeTabId, setActiveTabId] = useState('1')
  const [theme, setTheme] = useState(() => getTheme())
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    const unsub = initThemeSync()
    const handler = () => setTheme(getTheme())
    window.addEventListener('saas-theme-change', handler)
    return () => {
      unsub?.()
      window.removeEventListener('saas-theme-change', handler)
    }
  }, [])

  return (
    <div className="app">
      <AppTopBar
        logo={
          <div className="app-header-title">
            <h1>Quiz Generator</h1>
            <p>Create interactive quizzes with personalized feedback</p>
          </div>
        }
        showProject={true}
        projectProps={{
          projects,
          currentProjectId: 'default',
          currentProjectName: 'Untitled',
        }}
        showTabs={true}
        tabProps={{
          tabs,
          currentTabId: activeTabId,
          onSwitchTab: setActiveTabId,
          onAddTab: () => {
            const id = 't_' + Date.now()
            setTabs((prev) => [...prev, { id, name: 'Quiz ' + (prev.length + 1) }])
            setActiveTabId(id)
          },
          onRenameTab: (tabId, name) => {
            setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, name } : t)))
          },
          onDeleteTab: (tabId) => {
            if (tabs.length <= 1) return
            const nextTabs = tabs.filter((t) => t.id !== tabId)
            const nextActive = activeTabId === tabId ? (nextTabs[0]?.id ?? '1') : activeTabId
            setTabs(nextTabs)
            setActiveTabId(nextActive)
          },
          defaultTabName: 'Quiz',
          addTitle: 'Add quiz',
        }}
        actions={
          <>
            <ThemeToggle theme={theme} onToggle={setTheme} className="app-toolbar-btn" />
            <button
              type="button"
              className="app-toolbar-btn"
              onClick={() => setIsSettingsOpen(true)}
              title="Settings"
              aria-label="Open settings"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
          </>
        }
      />
      <div className="app-main">
        <QuizEditor />
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  )
}

export default App
