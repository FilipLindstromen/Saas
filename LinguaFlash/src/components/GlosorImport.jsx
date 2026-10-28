import { useEffect, useRef, useState } from 'react';
import { validateGlosorUrl, parseGlosorDocument, formatGlosorPairs } from '../lib/glosor';

export default function GlosorImport({ onImport }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [exercise, setExercise] = useState(null);
  const [swedishColumn, setSwedishColumn] = useState('second');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);

  const fetchWords = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setExercise(null);
    let source;
    try { source = validateGlosorUrl(url); }
    catch (failure) { setError(failure.message); return; }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort('timeout'), 20000);
    setLoading(true);
    try {
      const response = await fetch(`/api/glosor?url=${encodeURIComponent(source)}`, { signal: controller.signal });
      const type = response.headers.get('content-type') || '';
      if (!type.includes('application/json')) throw new Error('URL import needs the LinguaFlash server. Use the Vercel app or paste the words manually.');
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load this exercise.');
      const doc = new DOMParser().parseFromString(data.html, 'text/html');
      setExercise({ ...parseGlosorDocument(doc), url: source });
    } catch (failure) {
      if (controller.signal.reason === 'timeout') setError('The import timed out. Try again shortly.');
      else if (!controller.signal.aborted) setError(failure.message || 'Could not import this exercise.');
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) setLoading(false);
    }
  };

  const useWords = () => {
    const formatted = formatGlosorPairs(exercise.pairs, swedishColumn);
    onImport(formatted);
    setMessage(`Imported ${exercise.pairs.length} pairs from ${exercise.title}. Your word list has been replaced.${formatted.separator === '\t' ? ' Separator set to a tab to preserve the words.' : ''}`);
    setExercise(null);
  };

  return (
    <section className="setup-row glosor-import" aria-labelledby="glosor-heading">
      <h2 className="setup-label" id="glosor-heading">Import from Glosor.eu</h2>
      <form onSubmit={fetchWords}>
        <label className="setup-label" htmlFor="glosor-url">Public exercise URL</label>
        <div className="glosor-url-row">
          <input id="glosor-url" className="separator-input" type="url" required
            placeholder="https://glosor.eu/ovning/…html" value={url} disabled={loading}
            onChange={event => { setUrl(event.target.value); setExercise(null); setError(''); setMessage(''); }} />
          <button type="submit" className="btn btn-secondary" disabled={loading || !url.trim()}>
            {loading ? 'Fetching…' : 'Fetch words'}
          </button>
        </div>
      </form>
      <p className="setup-hint">Glosor.eu exercise links only. Preview the words before replacing your list.</p>
      {error && <p className="setup-hint" role="alert">{error}</p>}
      <p className="setup-hint" role="status">{loading ? 'Loading word pairs from Glosor.eu…' : message}</p>
      {exercise && (
        <div className="glosor-preview">
          <p><a href={exercise.url} target="_blank" rel="noreferrer">{exercise.title}</a> · {exercise.pairs.length} pairs</p>
          <table>
            <thead><tr><th>First column on Glosor.eu</th><th>Second column on Glosor.eu</th></tr></thead>
            <tbody>{exercise.pairs.slice(0, 3).map((pair, i) => <tr key={i}><td>{pair[0]}</td><td>{pair[1]}</td></tr>)}</tbody>
          </table>
          <label className="setup-label" htmlFor="glosor-swedish-column">Which column is Swedish?</label>
          <select id="glosor-swedish-column" className="separator-input" value={swedishColumn} onChange={event => setSwedishColumn(event.target.value)}>
            <option value="first">First column</option><option value="second">Second column</option>
          </select>
          <p className="setup-hint">Imported text will put Swedish on the left. Select English or Spanish in the language dropdown above to match this list.</p>
          <button type="button" className="btn btn-play" onClick={useWords}>Use {exercise.pairs.length} pairs (replace text)</button>
        </div>
      )}
    </section>
  );
}
