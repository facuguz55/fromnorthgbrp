import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Mic, MicOff } from 'lucide-react';
import './AiChat.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

function inlineFormat(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="ai-inline-code">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderMarkdown(text: string) {
  const lines = text.split('\n');
  const elements = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^#{1,3}\s/.test(line)) {
      elements.push(<p key={key++} className="ai-md-heading">{inlineFormat(line.replace(/^#+\s/, ''))}</p>);
      i++; continue;
    }
    if (/^[-*•]\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*•]\s/.test(lines[i])) { items.push(lines[i].replace(/^[-*•]\s/, '')); i++; }
      elements.push(<ul key={key++} className="ai-md-list">{items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}</ul>);
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) { items.push(lines[i].replace(/^\d+\.\s/, '')); i++; }
      elements.push(<ol key={key++} className="ai-md-list">{items.map((item, j) => <li key={j}>{inlineFormat(item)}</li>)}</ol>);
      continue;
    }
    if (line.trim() === '') { i++; continue; }
    elements.push(<p key={key++}>{inlineFormat(line)}</p>);
    i++;
  }
  return elements;
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  '¿Cuánto vendimos hoy?',
  '¿Qué productos tienen poco stock?',
  'Creá un cupón PROMO10 de 10% de descuento',
  '¿Hay emails urgentes sin responder?',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function AiChat() {
  const [open, setOpen]           = useState(false);
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError]   = useState<string | null>(null);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);
  const recognitionRef  = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Detener reconocimiento al cerrar el chat
  useEffect(() => {
    if (!open && isListening) stopListening();
  }, [open]);

  const resizeTextarea = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    resizeTextarea(e.target);
  };

  // ── Voice input ─────────────────────────────────────────────────────────────

  const startListening = () => {
    setVoiceError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceError('Tu navegador no soporta voz. Usá Chrome o Edge.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'es-AR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0][0].transcript;
      setInput(prev => {
        const next = prev ? `${prev} ${transcript}` : transcript;
        // resize después del render
        setTimeout(() => {
          if (inputRef.current) resizeTextarea(inputRef.current);
        }, 0);
        return next;
      });
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech') {
        setVoiceError('No se pudo acceder al micrófono.');
      }
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
  };

  const toggleVoice = () => {
    if (isListening) stopListening();
    else startListening();
  };

  // ── Send message ────────────────────────────────────────────────────────────

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    if (isListening) stopListening();

    const userMsg: Message = { role: 'user', content };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    if (inputRef.current) inputRef.current.style.height = 'auto';
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Error desconocido');
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      }
    } catch {
      setError('Error de conexión. Revisá tu internet.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <button
        className={`ai-fab ${open ? 'ai-fab-open' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Asistente IA"
        title="Asistente IA"
      >
        {open ? <X size={22} /> : <Bot size={22} />}
      </button>

      {open && (
        <div className="ai-panel glass-panel">

          <div className="ai-header">
            <div className="ai-header-info">
              <Sparkles size={15} className="ai-header-icon" />
              <div>
                <div className="ai-header-title">Asistente IA</div>
                <div className="ai-header-sub">FROMNORTH Dashboard</div>
              </div>
            </div>
            <button className="ai-close" onClick={() => setOpen(false)} aria-label="Cerrar">
              <X size={16} />
            </button>
          </div>

          <div className="ai-messages">
            {messages.length === 0 && !loading && (
              <div className="ai-empty">
                <Bot size={30} className="ai-empty-icon" />
                <p>Hola! Puedo consultar ventas, stock, clientes y ejecutar acciones en tu tienda.</p>
                <div className="ai-suggestions">
                  {SUGGESTIONS.map(s => (
                    <button key={s} className="ai-suggestion" onClick={() => sendMessage(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="ai-avatar"><Sparkles size={11} /></div>
                )}
                <div className="ai-bubble">
                  {msg.role === 'assistant'
                    ? renderMarkdown(msg.content)
                    : <p>{msg.content}</p>}
                </div>
              </div>
            ))}

            {loading && (
              <div className="ai-msg ai-msg-assistant">
                <div className="ai-avatar"><Sparkles size={11} /></div>
                <div className="ai-bubble ai-thinking">
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                  <span className="ai-dot" />
                </div>
              </div>
            )}

            {error && <div className="ai-error">{error}</div>}
            {voiceError && <div className="ai-error">{voiceError}</div>}

            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-area">
            {/* Mic button */}
            <button
              className={`ai-mic ${isListening ? 'ai-mic-active' : ''}`}
              onClick={toggleVoice}
              aria-label={isListening ? 'Detener grabación' : 'Mensaje de voz'}
              title={isListening ? 'Detener' : 'Mensaje de voz'}
              disabled={loading}
            >
              {isListening ? <MicOff size={15} /> : <Mic size={15} />}
              {isListening && <span className="ai-mic-ring" />}
            </button>

            <textarea
              ref={inputRef}
              className={`ai-input ${isListening ? 'ai-input-listening' : ''}`}
              placeholder={isListening ? 'Escuchando...' : 'Preguntá algo o pedí una acción...'}
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />

            <button
              className="ai-send"
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
            >
              <Send size={15} />
            </button>
          </div>

        </div>
      )}
    </>
  );
}
