// Central export file for all OpenAI service functions
// This maintains backward compatibility while allowing modular structure

// Re-export everything from openai.js for now
// TODO: Gradually migrate to separate modules (copyGeneration, storyGeneration, analysis, suggestions)

export {
    generateCopy,
    analyzeCopy,
    analyzeAudienceFeedback,
    improveCopy,
    improveInputs,
    improveInstructions,
    analyzeColorBalance,
    improveBalance,
    analyzeThreeKeyIngredients,
    analyzeThreeRules,
    improveCopyThreeRules,
    analyzeConversionMetrics,
    improveConversionMetrics,
    generateHeaderSuggestions,
    generateBigIdeas,
    infuseBlockType,
    generateWeirdStoryIdeas,
    generateCopyFromStory
} from './openai';

// Re-export utilities
export { cleanContent, stripTags } from './utils';
