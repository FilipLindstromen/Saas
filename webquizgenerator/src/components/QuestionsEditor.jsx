import React from 'react'
import './QuestionsEditor.css'

function QuestionsEditor({ questions, onUpdate }) {
  const moveItem = (list, from, to) => {
    const updated = [...list]
    const [removed] = updated.splice(from, 1)
    updated.splice(to, 0, removed)
    return updated
  }

  const handleQuestionDragStart = (e, fromIndex) => {
    e.dataTransfer.setData('question-index', String(fromIndex))
  }

  const handleQuestionDrop = (e, toIndex) => {
    e.preventDefault()
    const fromIndex = Number(e.dataTransfer.getData('question-index'))
    if (Number.isNaN(fromIndex) || fromIndex === toIndex) return
    onUpdate(moveItem(questions, fromIndex, toIndex))
  }

  const handleQuestionDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleQuestionDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over')
  }

  const handleAnswerDragStart = (e, questionId, fromIndex) => {
    e.dataTransfer.setData('answer-qid', String(questionId))
    e.dataTransfer.setData('answer-index', String(fromIndex))
  }

  const handleAnswerDrop = (e, questionId, toIndex) => {
    e.preventDefault()
    const qid = Number(e.dataTransfer.getData('answer-qid'))
    const fromIndex = Number(e.dataTransfer.getData('answer-index'))
    if (qid !== questionId || Number.isNaN(fromIndex) || fromIndex === toIndex) return
    onUpdate(
      questions.map(q =>
        q.id === questionId
          ? { ...q, answers: moveItem(q.answers, fromIndex, toIndex) }
          : q
      )
    )
  }

  const handleAnswerDragOver = (e) => {
    e.preventDefault()
    e.currentTarget.classList.add('drag-over')
  }

  const handleAnswerDragLeave = (e) => {
    e.currentTarget.classList.remove('drag-over')
  }
  const addQuestion = () => {
    const newQuestion = {
      id: Date.now(),
      q: '',
      answers: [
        { id: Date.now() + 1, label: '', tag: '' },
        { id: Date.now() + 2, label: '', tag: '' }
      ]
    }
    onUpdate([...questions, newQuestion])
  }

  const updateQuestion = (questionId, field, value) => {
    onUpdate(
      questions.map(q =>
        q.id === questionId ? { ...q, [field]: value } : q
      )
    )
  }

  const deleteQuestion = (questionId) => {
    onUpdate(questions.filter(q => q.id !== questionId))
  }

  const addAnswer = (questionId) => {
    onUpdate(
      questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: [...q.answers, { id: Date.now(), label: '', tag: '' }]
            }
          : q
      )
    )
  }

  const updateAnswer = (questionId, answerId, field, value) => {
    onUpdate(
      questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: q.answers.map(a =>
                a.id === answerId ? { ...a, [field]: value } : a
              )
            }
          : q
      )
    )
  }

  const deleteAnswer = (questionId, answerId) => {
    onUpdate(
      questions.map(q =>
        q.id === questionId
          ? {
              ...q,
              answers: q.answers.filter(a => a.id !== answerId)
            }
          : q
      )
    )
  }

  return (
    <div className="questions-editor">
      <div className="section-header">
        <h2>Questions & Answers</h2>
        <button onClick={addQuestion} className="btn-primary">
          + Add Question
        </button>
      </div>

      {questions.map((question, qIndex) => (
        <div
          key={question.id}
          className="question-card"
          draggable
          onDragStart={(e) => handleQuestionDragStart(e, qIndex)}
          onDragOver={handleQuestionDragOver}
          onDragLeave={handleQuestionDragLeave}
          onDrop={(e) => {
            e.currentTarget.classList.remove('drag-over')
            handleQuestionDrop(e, qIndex)
          }}
        >
          <div className="question-header">
            <span className="question-number">Question {qIndex + 1}</span>
            <button
              onClick={() => deleteQuestion(question.id)}
              className="btn-delete"
            >
              Delete
            </button>
          </div>

          <div className="form-group">
            <label>Question Text</label>
            <input
              type="text"
              value={question.q}
              onChange={(e) =>
                updateQuestion(question.id, 'q', e.target.value)
              }
              placeholder="Enter question"
              className="form-input"
            />
          </div>

          <div className="answers-section">
            <div className="answers-header">
              <label>Answers</label>
              <button
                onClick={() => addAnswer(question.id)}
                className="btn-secondary"
              >
                + Add Answer
              </button>
            </div>

            {question.answers.map((answer, aIndex) => (
              <div
                key={answer.id}
                className="answer-row"
                draggable
                onDragStart={(e) => handleAnswerDragStart(e, question.id, aIndex)}
                onDragOver={handleAnswerDragOver}
                onDragLeave={handleAnswerDragLeave}
                onDrop={(e) => {
                  e.currentTarget.classList.remove('drag-over')
                  handleAnswerDrop(e, question.id, aIndex)
                }}
              >
                <div className="answer-input-group">
                  <input
                    type="text"
                    value={answer.label}
                    onChange={(e) =>
                      updateAnswer(question.id, answer.id, 'label', e.target.value)
                    }
                    placeholder={`Answer ${aIndex + 1}`}
                    className="form-input"
                  />
                  <input
                    type="text"
                    value={answer.tag}
                    onChange={(e) =>
                      updateAnswer(question.id, answer.id, 'tag', e.target.value)
                    }
                    placeholder="Tag (e.g., 'random', 'pressure')"
                    className="form-input tag-input"
                  />
                </div>
                {question.answers.length > 2 && (
                  <button
                    onClick={() => deleteAnswer(question.id, answer.id)}
                    className="btn-icon"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default QuestionsEditor

