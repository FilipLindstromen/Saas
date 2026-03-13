import React from 'react'
import './QuizBasicInfo.css'

function QuizBasicInfo({ title, subtitle, summary, responseModel = 'percentage', onUpdate, onResponseModelChange }) {
  return (
    <div className="basic-info">
      <h2>Basic Information</h2>

      <div className="form-group">
        <label>Response model</label>
        <select
          value={responseModel || 'percentage'}
          onChange={(e) => onResponseModelChange(e.target.value)}
          className="form-input"
        >
          <option value="percentage">Percentage (performance) — correct answer + weight, tiers 0–40 / 41–75 / 76–100%</option>
          <option value="category">Category (personality) — each answer adds points to a category; highest wins</option>
          <option value="profile">Profile (insight) — answers update attributes; strongest/weakest + summary</option>
        </select>
        <small>Defines how results are calculated and what feedback the user sees.</small>
      </div>
      
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

