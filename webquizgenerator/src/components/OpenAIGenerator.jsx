import React, { useState, useEffect } from 'react'
import './OpenAIGenerator.css'

function OpenAIGenerator({ onGenerate, currentData }) {
  const [instruction, setInstruction] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)

  useEffect(() => {
    const savedKey = localStorage.getItem('openai_api_key')
    if (savedKey) {
      setApiKey(savedKey)
    }
  }, [])

  const handleGenerate = async () => {
    if (!instruction.trim()) {
      setError('Please enter an instruction')
      return
    }

    if (!apiKey.trim()) {
      setError('Please enter your OpenAI API key')
      setShowApiKeyInput(true)
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: `You are a quiz generator assistant. Generate quiz content based on user instructions. 
              Return a JSON object with this structure:
              {
                "quizTitle": "string",
                "quizSubtitle": "string",
                "summary": "string",
                "questions": [
                  {
                    "q": "question text",
                    "answers": [
                      {"label": "answer text", "tag": "tagName"},
                      ...
                    ]
                  },
                  ...
                ],
                "tagLabels": {"tagName": "description", ...},
                "headlines": {"tagName": "headline", ...},
                "tagInsights": {"tagName": "detailed insight text", ...},
                "cta": {"tagName": "CTA text", ...}
              }
              
              Make sure tags are consistent across answers, tagLabels, headlines, tagInsights, and cta.
              Generate at least 5-8 questions with 3-4 answers each.
              Make feedback personalized and relevant to the tags.`
            },
            {
              role: 'user',
              content: instruction
            }
          ],
          temperature: 0.7,
          max_tokens: 4000
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Failed to generate quiz')
      }

      const data = await response.json()
      const content = data.choices[0].message.content
      
      // Try to extract JSON from the response
      let jsonContent = content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        jsonContent = jsonMatch[0]
      }

      const generatedData = JSON.parse(jsonContent)
      
      // Transform to match our data structure
      const transformedData = {
        quizTitle: generatedData.quizTitle || currentData.quizTitle,
        quizSubtitle: generatedData.quizSubtitle || currentData.quizSubtitle,
        summary: generatedData.summary || currentData.summary,
        questions: (generatedData.questions || []).map((q, idx) => ({
          id: Date.now() + idx,
          q: q.q,
          answers: (q.answers || []).map((a, aIdx) => ({
            id: Date.now() + idx * 100 + aIdx,
            label: a.label,
            tag: a.tag
          }))
        })),
        tagLabels: { ...currentData.tagLabels, ...generatedData.tagLabels },
        headlines: { ...currentData.headlines, ...generatedData.headlines },
        tagInsights: { ...currentData.tagInsights, ...generatedData.tagInsights },
        cta: { ...currentData.cta, ...generatedData.cta }
      }

      onGenerate(transformedData)
      setInstruction('')
    } catch (err) {
      setError(err.message || 'Failed to generate quiz. Please check your API key and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="openai-generator">
      <h2>AI Content Generator</h2>
      <p className="section-description">
        Use OpenAI to generate questions, answers, and feedback based on a short instruction.
        Your API key is stored locally and never sent to our servers.
      </p>

      {!showApiKeyInput && !apiKey && (
        <button
          onClick={() => setShowApiKeyInput(true)}
          className="btn-secondary"
        >
          Enter OpenAI API Key
        </button>
      )}

      {(showApiKeyInput || apiKey) && (
        <div className="form-group">
          <label>OpenAI API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => {
              setApiKey(e.target.value)
              localStorage.setItem('openai_api_key', e.target.value)
            }}
            placeholder="sk-..."
            className="form-input"
          />
          <small>Your API key is stored in browser localStorage</small>
        </div>
      )}

      <div className="form-group">
        <label>Instruction</label>
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="e.g., Create a quiz about stress management with questions about work-life balance, physical symptoms, and coping strategies"
          className="form-textarea"
          rows="4"
        />
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button
        onClick={handleGenerate}
        disabled={loading}
        className="btn-primary btn-generate"
      >
        {loading ? 'Generating...' : '✨ Generate Quiz Content'}
      </button>
    </div>
  )
}

export default OpenAIGenerator

