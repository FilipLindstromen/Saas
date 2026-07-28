/** Format all story section copy for clipboard — title + body, blank line between sections. */
export function formatStoryForClipboard(sectionOrder, sectionDefs, sectionsData) {
  const parts = [];

  for (const sectionId of sectionOrder) {
    const content = (sectionsData[sectionId]?.content ?? '').trim();
    if (!content) continue;

    const title = sectionDefs[sectionId]?.title?.trim();
    parts.push(title ? `${title}\n\n${content}` : content);
  }

  return parts.join('\n\n');
}
