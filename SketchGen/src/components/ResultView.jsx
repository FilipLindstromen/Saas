import CompareSlider from './CompareSlider'
import ExportMenu from './ExportMenu'
import './ResultView.css'

export default function ResultView({
  view,
  sketchDataUrl,
  generatedDataUrl,
  onUseAsSketch,
  onImageContextMenu,
  onExport,
}) {
  if (view === 'compare') {
    return (
      <div className="result-view-wrap">
        <CompareSlider beforeSrc={sketchDataUrl} afterSrc={generatedDataUrl} onAfterContextMenu={onImageContextMenu} />
        <div className="result-view-actions">
          <ExportMenu onExport={onExport} />
          <button type="button" className="result-use-as-sketch" onClick={onUseAsSketch}>
            Use as new sketch
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="result-view-wrap">
      <div className="result-single">
        <img
          src={generatedDataUrl}
          alt="Generated illustration"
          onContextMenu={(e) => onImageContextMenu(e, generatedDataUrl)}
        />
      </div>
      <div className="result-view-actions">
        <ExportMenu onExport={onExport} />
        <button type="button" className="result-use-as-sketch" onClick={onUseAsSketch}>
          Use as new sketch
        </button>
      </div>
    </div>
  )
}
