import React, { useState } from 'react'
import QuizEditor from './components/QuizEditor'
import './App.css'

function App() {
  return (
    <div className="app">
      <div className="app-container">
        <header className="app-header">
          <h1>Quiz Generator</h1>
          <p>Create interactive quizzes with personalized feedback</p>
        </header>
        <QuizEditor />
      </div>
    </div>
  )
}

export default App

