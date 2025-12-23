import { Step } from '../App'

interface BottomNavigationProps {
  currentStep: Step
  onStepChange: (step: Step) => void
}

export default function BottomNavigation({
  currentStep,
  onStepChange,
}: BottomNavigationProps) {
  const steps: { id: Step; label: string; icon: JSX.Element }[] = [
    {
      id: 'script',
      label: 'Script',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      id: 'record',
      label: 'Record',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="10" strokeWidth={2} />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
          />
        </svg>
      ),
    },
    {
      id: 'edit',
      label: 'Edit',
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243 4.243 3 3 0 004.243-4.243zm0-5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z"
          />
        </svg>
      ),
    },
  ]

  return (
    <div className="bg-gray-800 h-16 flex items-center justify-center px-6 border-t border-gray-700 relative">
      <div className="flex items-center gap-4">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center gap-2">
            <button
              onClick={() => onStepChange(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${currentStep === step.id
                  ? 'bg-white text-black'
                  : 'text-gray-400 hover:text-white'
                }`}
            >
              {step.icon}
              <span>{step.label}</span>
            </button>
            {index < steps.length - 1 && (
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>
        ))}
      </div>

      <div className="absolute right-6">
        {currentStep === 'script' && (
          <button
            onClick={() => onStepChange('record')}
            className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg transition-colors"
          >
            Continue to Recording &gt;
          </button>
        )}
        {currentStep === 'record' && (
          <button
            onClick={() => onStepChange('edit')}
            className="bg-gray-600 hover:bg-gray-500 px-6 py-2 rounded-lg transition-colors"
          >
            Continue to Editing &gt;
          </button>
        )}
      </div>
    </div>
  )
}

