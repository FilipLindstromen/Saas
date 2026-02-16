# Quiz Generator

A powerful web application for creating interactive quizzes with personalized feedback. Generate beautiful, engaging quizzes that adapt based on user answers.

## Features

- ✨ **Dynamic Quiz Editor** - Add unlimited questions and answers
- 🎯 **Smart Feedback System** - Configure personalized feedback based on answer tags
- 🤖 **AI Content Generation** - Use OpenAI to generate quiz content from simple instructions
- 👁️ **Live Preview** - See exactly how your quiz will look before exporting
- 📋 **One-Click Export** - Generate complete HTML/JavaScript code and copy to clipboard
- 🌙 **Beautiful Dark Mode UI** - Clean, modern interface

## Getting Started

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

### Creating a Quiz

1. **Basic Information**: Enter your quiz title, subtitle, and summary text
2. **Questions & Answers**: 
   - Add questions using the "Add Question" button
   - For each question, add multiple answer options
   - Assign a "tag" to each answer (e.g., "random", "pressure", "social")
3. **Feedback Configuration**:
   - Configure tag labels, headlines, insights, and CTAs for each tag
   - Set default feedback for tags that don't have specific configurations
4. **Preview**: Click "Preview Quiz" to see how it will look
5. **Export**: Click "Export Quiz Code" to generate and copy the complete code

### Using AI Generation

1. Enter your OpenAI API key (stored locally in your browser)
2. Write a short instruction describing the quiz you want
3. Click "Generate Quiz Content"
4. The AI will generate questions, answers, and feedback based on your instruction

### Answer Tags

Tags are used to categorize answers and provide personalized feedback. Make sure:
- Each answer has a unique tag
- Tags are consistent across your quiz
- You configure feedback for each tag in the Feedback Editor

## Project Structure

```
src/
  components/
    QuizEditor.jsx       # Main editor component
    QuizBasicInfo.jsx    # Basic info form
    QuestionsEditor.jsx  # Questions and answers editor
    FeedbackEditor.jsx   # Feedback configuration
    OpenAIGenerator.jsx  # AI content generation
    QuizPreview.jsx      # Preview component
    ExportButton.jsx     # Export functionality
```

## Technologies

- React 18
- Vite
- OpenAI API (for content generation)

## License

MIT

