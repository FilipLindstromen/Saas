import { useEffect, useState } from 'react';
import TextInputScreen from './components/TextInputScreen';
import ReaderScreen from './components/ReaderScreen';
import MultipleChoiceScreen from './components/MultipleChoiceScreen';

const STORAGE_KEY = 'linguaflash:text';
const WPM_KEY = 'linguaflash:wpm';
const COLOR_KEY = 'linguaflash:colorMode';
const PLAY_MODE_KEY = 'linguaflash:playMode';
const SESSION_MINUTES_KEY = 'linguaflash:sessionMinutes';
const SV_HINT_KEY = 'linguaflash:svHint';
const TRAINING_KEY = 'linguaflash:training';
const SEPARATOR_KEY = 'linguaflash:separator';
const LANGUAGE_KEY = 'linguaflash:language';
const DEFAULT_TRAINING = { recallGap: false, phraseChunks: false, repeatPairs: false, accelerate: false, swedishFirst: true, pairFlash: true };

export default function App() {
  const [screen, setScreen] = useState('input');
  const [language, setLanguage] = useState(() => localStorage.getItem(LANGUAGE_KEY) === 'es' ? 'es' : 'en');
  useEffect(() => { localStorage.setItem(LANGUAGE_KEY, language); }, [language]);
  const [separator, setSeparator] = useState(() => localStorage.getItem(SEPARATOR_KEY) ?? ' - ');
  useEffect(() => { localStorage.setItem(SEPARATOR_KEY, separator); }, [separator]);
  const [training, setTraining] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TRAINING_KEY) || '{}');
      return Object.fromEntries(Object.entries(DEFAULT_TRAINING).map(([key, value]) => [key, typeof saved?.[key] === 'boolean' ? saved[key] : value]));
    } catch { return DEFAULT_TRAINING; }
  });
  useEffect(() => { localStorage.setItem(TRAINING_KEY, JSON.stringify(training)); }, [training]);
  const [rawText, setRawText] = useState(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [wpm, setWpm] = useState(() => Number(localStorage.getItem(WPM_KEY)) || 300);
  const [colorMode, setColorMode] = useState(() => localStorage.getItem(COLOR_KEY) || 'colorBg');
  const [playMode, setPlayMode] = useState(() => localStorage.getItem(PLAY_MODE_KEY) || 'flash');
  const [sessionMinutes, setSessionMinutes] = useState(() => {
    const stored = localStorage.getItem(SESSION_MINUTES_KEY);
    return stored ? Number(stored) : null;
  });

  const [svHint, setSvHint] = useState(() => localStorage.getItem(SV_HINT_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(SV_HINT_KEY, svHint ? '1' : '0');
  }, [svHint]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, rawText);
  }, [rawText]);

  useEffect(() => {
    localStorage.setItem(WPM_KEY, String(wpm));
  }, [wpm]);

  useEffect(() => {
    localStorage.setItem(COLOR_KEY, colorMode);
  }, [colorMode]);

  useEffect(() => {
    localStorage.setItem(PLAY_MODE_KEY, playMode);
  }, [playMode]);

  useEffect(() => {
    localStorage.setItem(SESSION_MINUTES_KEY, sessionMinutes ? String(sessionMinutes) : '');
  }, [sessionMinutes]);

  const goBack = () => setScreen('input');

  return (
    <div className="app">
      {screen === 'input' ? (
        <TextInputScreen
          language={language}
          setLanguage={setLanguage}
          separator={separator}
          setSeparator={setSeparator}
          training={training}
          setTraining={setTraining}
          rawText={rawText}
          setRawText={setRawText}
          playMode={playMode}
          setPlayMode={setPlayMode}
          sessionMinutes={sessionMinutes}
          setSessionMinutes={setSessionMinutes}
          onStart={() => setScreen('reader')}
        />
      ) : playMode === 'multipleChoice' ? (
        <MultipleChoiceScreen
          language={language}
          separator={separator}
          rawText={rawText}
          colorMode={colorMode}
          sessionMinutes={sessionMinutes}
          onBack={goBack}
        />
      ) : (
        <ReaderScreen
          language={language}
          separator={separator}
          training={training}
          mixed={playMode === 'mixed'}
          rawText={rawText}
          colorMode={colorMode}
          setColorMode={setColorMode}
          wpm={wpm}
          setWpm={setWpm}
          sessionMinutes={sessionMinutes}
          svHint={svHint}
          setSvHint={setSvHint}
          onBack={goBack}
        />
      )}
    </div>
  );
}
