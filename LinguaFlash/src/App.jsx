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

export default function App() {
  const [screen, setScreen] = useState('input');
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
          rawText={rawText}
          colorMode={colorMode}
          sessionMinutes={sessionMinutes}
          onBack={goBack}
        />
      ) : (
        <ReaderScreen
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
