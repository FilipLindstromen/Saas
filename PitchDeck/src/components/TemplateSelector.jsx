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
