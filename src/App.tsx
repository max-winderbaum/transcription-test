import { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey') || '');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [useBrowserTranscription, setUseBrowserTranscription] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<any | null>(null);

  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('apiKey', apiKey);
    }
  }, [apiKey]);

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setApiKey(e.target.value);
  };

  const handleTranscriptionMethodChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUseBrowserTranscription(e.target.checked);
  };

  const currentTranscript = useRef('');

  const handleStartRecording = async () => {
    console.log('Starting recording');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log('No media devices or getUserMedia');
      alert('Your browser does not support audio recording.');
      return;
    }

    if (useBrowserTranscription) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert('Your browser does not support Speech Recognition.');
        return;
      }

      const recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      recognitionRef.current = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        console.log('onresult', event);
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            currentTranscript.current += event.results[i][0].transcript;
            setTranscript(currentTranscript.current);
          } else {
            interimTranscript += event.results[i][0].transcript;
            setTranscript(currentTranscript.current + interimTranscript);
          }
        }
      };
      recognition.onerror = (event: any) => {
        console.log('onerror', event);
        if (event.error === 'not-allowed') {
            alert('Microphone access was denied. Please allow microphone access and try again.');
        } else {
            alert(`An error occurred: ${event.error}`);
        }
    };
      recognition.start();
      setIsRecording(true);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
        const mediaRecorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = mediaRecorder;

        let currentBlob: Blob | null = null;

        mediaRecorder.ondataavailable = async (event) => {
          console.log(event);
          if (event.data.size > 0) {
            const audioBlob = event.data;
            if (currentBlob === null) {
              currentBlob = audioBlob;
            } else {
              currentBlob = new Blob([currentBlob, audioBlob]);
            }

            const formData = new FormData();
            formData.append('file', currentBlob, mimeType === 'audio/webm' ? 'audio.webm' : 'audio.mp4');
            formData.append('model', 'whisper-1');

            const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              body: formData,
            });

            const result = await response.json();
            if (result.error) {
              console.error(result.error);
            } else {
              setTranscript(result.text);
            }
          }
        };

        mediaRecorder.start(1000); // Collect data in chunks of 1 second
        setIsRecording(true);
      } catch (err) {
        console.error(err);
        alert(err);
      }
    }
  };

  const handleStopRecording = () => {
    if (useBrowserTranscription && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="App">
      <h1>OpenAI Whisper Demo</h1>
      <div>
        <label>
          API Key:
          <input type="text" value={apiKey} onChange={handleApiKeyChange} />
        </label>
      </div>
      <div>
        <label>
          Use Browser Transcription:
          <input type="checkbox" checked={useBrowserTranscription} onChange={handleTranscriptionMethodChange} />
        </label>
      </div>
      <div>
        <button onClick={isRecording ? handleStopRecording : handleStartRecording}>
          {isRecording ? 'Stop Recording' : 'Start Recording'}
        </button>
      </div>
      <div>
        <h2>Transcript:</h2>
        <p>{transcript}</p>
      </div>
    </div>
  );
}

export default App;