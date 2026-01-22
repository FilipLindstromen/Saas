// Utility functions for OpenAI service

/**
 * Strip HTML tags from text
 */
export const stripTags = (html) => html.replace(/<[^>]*>/g, '');

/**
 * Clean content by removing markdown fences and normalizing whitespace
 */
export const cleanContent = (text) => {
    if (!text) return '';
    return text
        .replace(/^```html\s*/i, '') // Remove start fence
        .replace(/^```\s*/i, '')      // Remove generic start fence
        .replace(/```\s*$/i, '')      // Remove end fence
        .replace(/>\s+</g, '><')      // REMOVE WHITESPACE BETWEEN TAGS (Aggressive tightness)
        .trim();
};
