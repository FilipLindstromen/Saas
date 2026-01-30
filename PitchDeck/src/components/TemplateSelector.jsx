import './TemplateSelector.css'

const templates = {
  pas: {
    name: 'PAS',
    description: 'Problem, Agitate, Solution',
    slides: [
      {
        id: 1,
        content: 'Problem',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 2,
        content: 'Explain the problem',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 3,
        content: 'Agitate',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 4,
        content: 'Make the problem bigger',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 5,
        content: 'Solution',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 6,
        content: 'Explain your solution',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      }
    ]
  },
  aida: {
    name: 'AIDA',
    description: 'Attention, Interest, Desire, Action',
    slides: [
      {
        id: 1,
        content: 'Attention',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 2,
        content: 'Capture attention',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 3,
        content: 'Interest',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 4,
        content: 'Build interest',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 5,
        content: 'Desire',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 6,
        content: 'Create desire',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 7,
        content: 'Action',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 8,
        content: 'Call to action',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      }
    ]
  },
  story: {
    name: 'Story',
    description: 'Classic story structure with hero\'s journey',
    slides: [
      {
        id: 1,
        content: 'The Scene',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 2,
        content: 'Set the scene and introduce the main character',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 3,
        content: 'The Problem',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 4,
        content: 'Describe their problem',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 5,
        content: 'Failed Attempts',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 6,
        content: 'Show how they try to fix it, but it doesn\'t work',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 7,
        content: 'The Crisis',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 8,
        content: 'Escalate the problem until it\'s as bad as it can possibly get',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 9,
        content: 'The Insight',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 10,
        content: 'Reveal the "aha!" moment that leads to one final attempt',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 11,
        content: 'The Solution',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 12,
        content: 'Show the hero taking action on the solution, and it works',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 13,
        content: 'The New Life',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 14,
        content: 'Describe the hero\'s new life, now that the problem has been fixed',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 15,
        content: 'The Lesson',
        subtitle: '',
        imageUrl: '',
        layout: 'section',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      },
      {
        id: 16,
        content: 'Call out your specific audience and clearly state the moral or lesson they should take from the story',
        subtitle: '',
        imageUrl: '',
        layout: 'default',
        gradientStrength: 0.7,
        flipHorizontal: false,
        backgroundOpacity: 1.0,
        gradientFlipped: false,
        imageScale: 1.0,
        imagePositionX: 50,
        imagePositionY: 50,
        textHeadingLevel: null,
        subtitleHeadingLevel: null
      }
    ]
  }
}

function TemplateSelector({ onLoadTemplate }) {
  const handleLoadTemplate = (templateKey) => {
    const template = templates[templateKey]
    if (template && window.confirm(`Load ${template.name} template? This will replace all current slides.`)) {
      onLoadTemplate(template.slides)
    }
  }

  return (
    <div className="template-selector">
      <h3 className="template-selector-title">TEMPLATES</h3>
      <div className="template-list">
        {Object.entries(templates).map(([key, template]) => (
          <button
            key={key}
            className="template-item"
            onClick={() => handleLoadTemplate(key)}
            title={template.description}
          >
            <div className="template-name">{template.name}</div>
            <div className="template-description">{template.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default TemplateSelector
