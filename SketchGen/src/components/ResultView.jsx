import CompareSlider from './CompareSlider'
import ExportMenu from './ExportMenu'
import { getSketchFormat } from '../utils/canvasFormat'
import './ResultView.css'

export default function ResultView({
  view,
  sketchDataUrl,
  generatedDataUrl,
  formatId,
  onUseAsSketch,
  onImageContextMenu,
  onExport,
}) {
  const format = getSketchFormat(formatId)

  if (view === 'compare') {
    return (
      <div className="result-view-wrap">
        <div className="result-view-viewport">
          <CompareSlider
            beforeSrc={sketchDataUrl}
            afterSrc={generatedDataUrl}
            formatId={formatId}
            onAfterContextMenu={onImageContextMenu}
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

  return (
    <div className="result-view-wrap">
      <div className="result-view-viewport">
        <div
          className="result-view-stage"
          style={{ aspectRatio: `${format.width} / ${format.height}` }}
        >
          <img
            src={generatedDataUrl}
            alt="Generated illustration"
            onContextMenu={(e) => onImageContextMenu(e, generatedDataUrl)}
          />
        </div>
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
