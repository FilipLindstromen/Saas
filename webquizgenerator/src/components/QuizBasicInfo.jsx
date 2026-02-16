import React from 'react'
import './QuizBasicInfo.css'

function QuizBasicInfo({ title, subtitle, summary, onUpdate }) {
  return (
    <div className="basic-info">
      <h2>Basic Information</h2>
      
      <div className="form-group">
        <label>Quiz Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => onUpdate('quizTitle', e.target.value)}
          placeholder="Enter quiz title"
          className="form-input"
        />
      </div>

      <div className="form-group">
        <label>Quiz Subtitle</label>
        <textarea
          value={subtitle}
          onChange={(e) => onUpdate('quizSubtitle', e.target.value)}
          placeholder="Enter quiz subtitle/description"
          className="form-textarea"
          rows="6"
        />
        <small>Use \n for line breaks</small>
      </div>

      <div className="form-group">
        <label>Summary Text</label>
        <textarea
          value={summary}
          onChange={(e) => onUpdate('summary', e.target.value)}
          placeholder="Enter summary text shown in results"
          className="form-textarea"
          rows="8"
        />
        <small>This appears in the results screen</small>
      </div>
    </div>
  )
}

export default QuizBasicInfo

