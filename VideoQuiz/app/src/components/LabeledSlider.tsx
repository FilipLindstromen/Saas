import React from 'react'

interface LabeledSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

export function LabeledSlider({ label, value, min, max, step = 1, onChange }: LabeledSliderProps) {
  return (
    <label className="block text-sm">
      <div className="text-iossub mb-1">
        {label}: <span className="text-iostext">
          {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value}
        </span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={e => onChange(Number(e.target.value))} 
        className="w-full slider-blue" 
        style={{
          background: `linear-gradient(to right, #2563eb 0%, #2563eb ${((value - min) / (max - min)) * 100}%, #e5e7eb ${((value - min) / (max - min)) * 100}%, #e5e7eb 100%)`
        }}
      />
    </label>
  )
}
