import CompareSlider from './CompareSlider'
import './ResultView.css'

export default function ResultView({ view, sketchDataUrl, generatedDataUrl, onUseAsSketch }) {
  if (view === 'compare') {
    return (
      <div className="result-view-wrap">
        <CompareSlider beforeSrc={sketchDataUrl} afterSrc={generatedDataUrl} />
        <button type="button" className="result-use-as-sketch" onClick={onUseAsSketch}>
          Use as new sketch
        </button>
      </div>
    )
  }

  return (
    <div className="result-view-wrap">
      <div className="result-single">
        <img src={generatedDataUrl} alt="Generated illustration" />
      </div>
      <button type="button" className="result-use-as-sketch" onClick={onUseAsSketch}>
        Use as new sketch
      </button>
    </div>
  )
}
