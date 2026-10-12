import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'react-hot-toast';

const ERROR_MESSAGES = {
  'not-allowed': 'Microphone blocked. Allow microphone access in your browser’s address bar.',
  'no-speech': 'No speech detected. Try speaking closer to the microphone.',
  aborted: 'Dictation cancelled.',
};

/** Browser dictation. `onText(transcript)` receives the recognised phrase. */
export default function useSpeechInput(onText) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => () => recognitionRef.current?.abort?.(), []);

  const toggle = useCallback(() => {
    if (listening) {
      recognitionRef.current?.stop?.();
      return;
    }
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error('Dictation is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setListening(true);
    recognition.onresult = (event) => onText(event.results[0][0].transcript);
    recognition.onerror = (event) => {
      setListening(false);
      toast.error(ERROR_MESSAGES[event.error] || 'Dictation failed. Check your audio settings.');
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
  }, [listening, onText]);

  return { listening, toggle };
}
