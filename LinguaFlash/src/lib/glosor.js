export function validateGlosorUrl(value) {
  let url;
  try { url = new URL(value.trim()); } catch { throw new Error('Paste a full Glosor.eu exercise URL.'); }
  if (url.protocol !== 'https:' || !['glosor.eu', 'www.glosor.eu'].includes(url.hostname) ||
      url.username || url.password || url.port || !/^\/ovning\/[\w%.-]+\.\d+\.html$/.test(url.pathname)) {
    throw new Error('Use an HTTPS exercise URL from glosor.eu/ovning/.');
  }
  return `https://glosor.eu${url.pathname}`;
}

export function parseGlosorDocument(doc) {
  const rows = [...doc.querySelectorAll('#listOfQuestions li.list-group-item')];
  const pairs = rows.map(row => {
    const columns = [...row.querySelectorAll('.exl-c2')];
    if (columns.length !== 2) throw new Error('This exercise has an unsupported word-list format.');
    const values = columns.map(column => column.textContent.replace(/\s+/g, ' ').trim());
    if (values.some(value => !value)) throw new Error('This exercise contains an empty word or translation.');
    return values;
  });
  if (!pairs.length) throw new Error('No public word pairs found. The exercise may be private or require login.');
  if (pairs.length > 2000) throw new Error('This exercise is too large to import (maximum 2,000 pairs).');
  return { title: doc.querySelector('h1')?.textContent.trim() || 'Glosor.eu exercise', pairs };
}

export function formatGlosorPairs(pairs, swedishColumn) {
  const ordered = pairs.map(pair => swedishColumn === 'second' ? [pair[1], pair[0]] : pair);
  const separator = ordered.some(pair => pair.some(value => value.includes(' - '))) ? '\t' : ' - ';
  return { separator, text: ordered.map(pair => pair.join(separator)).join('\n') };
}
