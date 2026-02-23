// Utility functions for OpenAI service

/**
 * Strip HTML tags from text
 */
export const stripTags = (html) => html.replace(/<[^>]*>/g, '');

/**
 * Normalize HTML to single-column layout - removes any flex, grid, or column CSS
 * that would cause text to display in multiple columns.
 */
export const normalizeToSingleColumn = (html) => {
    if (!html || typeof html !== 'string') return html || '';
    let result = html
        .replace(/\sstyle\s*=\s*["']([^"']*)["']/gi, (_match, styleContent) => {
            let cleaned = styleContent
                .replace(/\bdisplay\s*:\s*flex\b/gi, 'display:block')
                .replace(/\bdisplay\s*:\s*grid\b/gi, 'display:block')
                .replace(/\bdisplay\s*:\s*inline-block\b/gi, 'display:block')
                .replace(/\bflex-direction\s*:\s*row\b/gi, '')
                .replace(/\bflex-wrap\s*:\s*wrap\b/gi, '')
                .replace(/\bcolumn-count\s*:\s*\d+\b/gi, 'column-count:1')
                .replace(/\bcolumns\s*:\s*\d+\b/gi, 'columns:1')
                .replace(/\bgrid-template-columns\s*:[^;]+;?/gi, '')
                .replace(/\bgrid-template-areas\s*:[^;]+;?/gi, '')
                .replace(/\bgrid-auto-flow\s*:[^;]+;?/gi, '')
                .replace(/\bfloat\s*:\s*(left|right)\b/gi, 'float:none')
                .replace(/\bwidth\s*:\s*50%\b/gi, 'width:100%')
                .replace(/\bwidth\s*:\s*calc\s*\([^)]*\)\s*;?/gi, 'width:100%');
            cleaned = cleaned.replace(/;\s*;/g, ';').replace(/^\s*;\s*|\s*;\s*$/g, '').trim();
            if (!cleaned) return '';
            return ` style="${cleaned}"`;
        });
    return result;
};

/**
 * Clean content by removing markdown fences, normalizing whitespace, and forcing single-column layout
 */
export const cleanContent = (text) => {
    if (!text) return '';
    const cleaned = text
        .replace(/^```html\s*/i, '') // Remove start fence
        .replace(/^```\s*/i, '')      // Remove generic start fence
        .replace(/```\s*$/i, '')      // Remove end fence
        .replace(/>\s+</g, '><')      // REMOVE WHITESPACE BETWEEN TAGS (Aggressive tightness)
        .trim();
    return normalizeToSingleColumn(cleaned);
};
