const STORAGE_KEY = 'storywriter_content';

let cached = null;

function loadRaw() {
  if (cached !== null) return cached;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    cached = JSON.parse(raw);
    return cached;
  } catch {
    return null;
  }
}

const DEFAULT_FRAMEWORK_ID = 'heros_arc';

/** Load saved content; validates and merges with defaults. Returns default object if none saved. */
export function loadContent(getDefaultSectionOrder, createEmptySections) {
  const raw = loadRaw();
  const frameworkId =
    raw && typeof raw.frameworkId === 'string' ? raw.frameworkId : DEFAULT_FRAMEWORK_ID;
  const validOrder = getDefaultSectionOrder(frameworkId);
  const empty = createEmptySections(frameworkId);
  const defaults = {
    storyAbout: '',
    frameworkId,
    sectionOrder: validOrder,
    sectionsData: empty,
    storyLength: 'medium',
  };
  if (!raw || typeof raw !== 'object') return defaults;
  const sectionOrder = Array.isArray(raw.sectionOrder) ? raw.sectionOrder : null;
  const sectionsData =
    raw.sectionsData && typeof raw.sectionsData === 'object' ? raw.sectionsData : null;
  const validIds = new Set(validOrder);
  let order = sectionOrder
    ? sectionOrder.filter((id) => validIds.has(id)).concat(validOrder.filter((id) => !sectionOrder.includes(id)))
    : validOrder;
  if (order.length !== validOrder.length) {
    const missing = validOrder.filter((id) => !order.includes(id));
    order = order.concat(missing);
  }
  let data = empty;
  if (sectionsData) {
    data = { ...empty };
    for (const id of validOrder) {
      if (sectionsData[id] && typeof sectionsData[id] === 'object') {
        const sentenceImages = sectionsData[id].sentenceImages;
        const arr = Array.isArray(sentenceImages)
          ? sentenceImages.map((x) => (typeof x === 'string' ? x : ''))
          : [];
        data[id] = {
          input: sectionsData[id].input ?? empty[id].input,
          content: sectionsData[id].content ?? empty[id].content,
          backgroundImageUrl: typeof sectionsData[id].backgroundImageUrl === 'string' ? sectionsData[id].backgroundImageUrl : undefined,
          backgroundImageCredit: typeof sectionsData[id].backgroundImageCredit === 'string' ? sectionsData[id].backgroundImageCredit : undefined,
          sentenceImages: arr,
        };
      }
    }
  }
  return {
    storyAbout: typeof raw.storyAbout === 'string' ? raw.storyAbout : '',
    frameworkId,
    sectionOrder: order,
    sectionsData: data,
    storyLength:
      raw.storyLength === 'micro' || raw.storyLength === 'short' || raw.storyLength === 'medium' || raw.storyLength === 'long'
        ? raw.storyLength
        : 'medium',
  };
}

export function saveContent(payload) {
  try {
    const sections = payload.sectionsData ?? {};
    const sectionsData = {};
    for (const [id, section] of Object.entries(sections)) {
      if (section && typeof section === 'object') {
        const sentenceImages = section.sentenceImages;
        const arr = Array.isArray(sentenceImages)
          ? sentenceImages.map((x) => (typeof x === 'string' ? x : ''))
          : [];
        sectionsData[id] = {
          input: section.input ?? '',
          content: section.content ?? '',
          backgroundImageUrl: typeof section.backgroundImageUrl === 'string' ? section.backgroundImageUrl : undefined,
          backgroundImageCredit: typeof section.backgroundImageCredit === 'string' ? section.backgroundImageCredit : undefined,
          sentenceImages: arr,
        };
      }
    }
    const toSave = {
      storyAbout: payload.storyAbout ?? '',
      frameworkId: payload.frameworkId ?? DEFAULT_FRAMEWORK_ID,
      sectionOrder: payload.sectionOrder ?? [],
      sectionsData,
      storyLength: payload.storyLength ?? 'medium',
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (_) {}
}
