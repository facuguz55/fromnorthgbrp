import { useState, useEffect } from 'react';
import { Save, TerminalSquare, Plus, Trash2, Lock } from 'lucide-react';
import './Workflows.css';

const WORKFLOWS_PASSWORD = 'facujaja';

function PasswordGate({ onUnlock }: { onUnlock: () => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === WORKFLOWS_PASSWORD) {
      onUnlock();
    } else {
      setError(true);
      setInput('');
      setTimeout(() => setError(false), 1500);
    }
  };

  return (
    <div className="wf-gate fade-in">
      <div className="wf-gate-box glass-panel">
        <Lock size={32} className="wf-gate-icon" />
        <h2>Notas privadas</h2>
        <p className="text-muted">Ingresá la contraseña para acceder.</p>
        <form onSubmit={handleSubmit} className="wf-gate-form">
          <input
            type="password"
            className={`wf-gate-input ${error ? 'wf-gate-input--error' : ''}`}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Contraseña"
            autoFocus
          />
          <button type="submit" className="btn-primary">Entrar</button>
        </form>
        {error && <p className="wf-gate-error">Contraseña incorrecta</p>}
      </div>
    </div>
  );
}

interface Workflow {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export default function Workflows() {
  const [unlocked, setUnlocked] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    // Load saved workflows
    const saved = localStorage.getItem('nova_dashboard_workflows_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setWorkflows(parsed);
        if (parsed.length > 0) setActiveId(parsed[0].id);
      } catch {
        console.error("Failed to parse workflows");
      }
    }
  }, []);

  if (!unlocked) return <PasswordGate onUnlock={() => setUnlocked(true)} />;

  const saveToLocal = (data: Workflow[]) => {
    localStorage.setItem('nova_dashboard_workflows_list', JSON.stringify(data));
  };

  const activeWorkflow = workflows.find(w => w.id === activeId);

  const handleCreate = () => {
    const newWf: Workflow = {
      id: Date.now().toString(),
      title: 'Nuevo Workflow',
      content: '',
      createdAt: new Date().toLocaleDateString()
    };
    const updated = [newWf, ...workflows];
    setWorkflows(updated);
    setActiveId(newWf.id);
    saveToLocal(updated);
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = workflows.filter(w => w.id !== id);
    setWorkflows(updated);
    if (activeId === id) {
      setActiveId(updated.length > 0 ? updated[0].id : null);
    }
    saveToLocal(updated);
  };

  const handleUpdate = (updates: Partial<Workflow>) => {
    if (!activeId) return;
    const updated = workflows.map(w => 
      w.id === activeId ? { ...w, ...updates } : w
    );
    setWorkflows(updated);
    setIsSaved(false);
  };

  const handleSaveBtn = () => {
    saveToLocal(workflows);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="workflows-page fade-in">
      <header className="page-header">
        <h1>Mis Workflows</h1>
        <p className="text-muted">Guarda textos, scripts o detalles importantes de tus flujos de n8n o Make.</p>
      </header>

      <div className="workflows-container">
        {/* Sidebar for list of workflows */}
        <aside className="workflows-sidebar glass-panel">
          <button className="btn-primary w-full" onClick={handleCreate} style={{ marginBottom: '1rem', justifyContent: 'center' }}>
            <Plus size={16} /> Nuevo
          </button>
          <div className="workflows-list">
            {workflows.map(wf => (
              <div 
                key={wf.id} 
                className={`wf-list-item ${wf.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(wf.id)}
              >
                <div className="wf-item-info">
                  <span className="wf-title">{wf.title || 'Sin Título'}</span>
                  <span className="wf-date">{wf.createdAt}</span>
                </div>
                <button className="btn-icon" onClick={(e) => handleDelete(e, wf.id)} title="Eliminar">
                  <Trash2 size={14} className="text-muted" />
                </button>
              </div>
            ))}
            {workflows.length === 0 && (
              <p className="text-muted text-center mt-4 text-sm">No hay workflows guardados.</p>
            )}
          </div>
        </aside>

        {/* Editor Area */}
        <main className="workflows-content glass-panel">
          {activeWorkflow ? (
            <>
              <div className="editor-header">
                <TerminalSquare size={20} className="icon-accent" />
                <input 
                  type="text" 
                  className="wf-title-input" 
                  value={activeWorkflow.title}
                  onChange={(e) => handleUpdate({ title: e.target.value })}
                  placeholder="Título del workflow..."
                />
                <button className="btn-save" onClick={handleSaveBtn}>
                  <Save size={16} />
                  {isSaved ? 'Guardado' : 'Guardar'}
                </button>
              </div>
              <textarea
                className="workflows-textarea"
                value={activeWorkflow.content}
                onChange={(e) => handleUpdate({ content: e.target.value })}
                placeholder="Pega aquí tus payloads, apuntes de webhooks, o notas en general..."
              />
            </>
          ) : (
            <div className="wf-empty-state">
              <TerminalSquare size={48} strokeWidth={1} />
              <h3>Ningún Workflow Seleccionado</h3>
              <p>Selecciona uno de la lista o crea uno nuevo para empezar a escribir.</p>
              <button className="btn-primary" onClick={handleCreate} style={{ marginTop: '1rem' }}>
                Crear Nuevo
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
