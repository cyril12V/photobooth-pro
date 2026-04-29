import { useEffect, useState } from 'react';
import { MdAdd, MdDelete, MdKeyboardArrowUp, MdKeyboardArrowDown, MdCheck, MdEdit } from 'react-icons/md';
import { useAppStore } from '@shared/store';
import type { InterviewQuestion } from '@shared/types';
import { AdminCard, AdminPageHeader, AdminInput } from '../components/AdminUI';
import { Button } from '@shared/components/Button';

const PRESET_QUESTIONS = [
  'Comment avez-vous connu les mariés ?',
  'Quel est votre meilleur souvenir avec eux ?',
  'Un conseil pour leur vie à deux ?',
  'Un souhait pour les mariés ?',
  'Un mot doux à leur transmettre ?',
];

export function InterviewQuestions() {
  const { settings } = useAppStore();
  const defaultDuration = settings?.video_default_question_seconds ?? 15;
  const [list, setList] = useState<InterviewQuestion[]>([]);
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [duration, setDuration] = useState<number>(defaultDuration);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDuration, setEditDuration] = useState<number>(defaultDuration);

  const load = async () => {
    const r = await window.api.question.list();
    setList(r);
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    setDuration(defaultDuration);
  }, [defaultDuration]);

  const add = async () => {
    if (!label.trim()) return;
    await window.api.question.add({ label: label.trim(), duration_seconds: duration });
    setLabel('');
    setDuration(defaultDuration);
    setAdding(false);
    await load();
  };

  const addPreset = async (text: string) => {
    if (list.some((q) => q.label.trim().toLowerCase() === text.trim().toLowerCase())) return;
    await window.api.question.add({ label: text, duration_seconds: defaultDuration });
    await load();
  };

  const remove = async (id: number) => {
    if (!confirm('Supprimer cette question ?')) return;
    await window.api.question.delete(id);
    await load();
  };

  const beginEdit = (q: InterviewQuestion) => {
    setEditingId(q.id);
    setEditLabel(q.label);
    setEditDuration(q.duration_seconds);
  };

  const saveEdit = async () => {
    if (editingId === null) return;
    await window.api.question.update({
      id: editingId,
      label: editLabel.trim(),
      duration_seconds: editDuration,
    });
    setEditingId(null);
    await load();
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= list.length) return;
    const reordered = [...list];
    [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
    setList(reordered);
    await window.api.question.reorder(reordered.map((q) => q.id));
    await load();
  };

  return (
    <>
      <AdminPageHeader
        title="Questions interview"
        description="Gérez la liste de questions affichées en mode Interview guidée"
      />

      {/* Banque de questions présets */}
      <AdminCard
        title="Questions suggérées"
        description="Cliquez pour ajouter rapidement une question type"
        className="mb-4"
      >
        <div className="grid grid-cols-1 gap-2">
          {PRESET_QUESTIONS.map((q) => {
            const already = list.some(
              (it) => it.label.trim().toLowerCase() === q.trim().toLowerCase(),
            );
            return (
              <button
                key={q}
                onClick={() => addPreset(q)}
                disabled={already}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm transition-all ${
                  already
                    ? 'bg-neutral-50 border border-neutral-200 text-neutral-400 cursor-not-allowed'
                    : 'bg-neutral-50 border border-neutral-200 hover:border-[#d4a574]/60 hover:bg-amber-50 text-neutral-700'
                }`}
              >
                <MdAdd size={14} className="flex-shrink-0" />
                <span className="flex-1 truncate">{q}</span>
                {already && <MdCheck size={14} style={{ color: '#1A1A1A' }} />}
              </button>
            );
          })}
        </div>
      </AdminCard>

      {adding && (
        <AdminCard title="Ajouter une question" className="mb-4">
          <div className="space-y-4">
            <AdminInput
              label="Question"
              value={label}
              onChange={setLabel}
              placeholder="Ex : Quel est votre souhait pour les mariés ?"
            />
            <div>
              <p className="text-neutral-600 text-xs font-medium uppercase tracking-wider mb-3">
                Temps de réponse : {duration} secondes
              </p>
              <input
                type="range"
                min={5}
                max={60}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full accent-neutral-900"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="md" onClick={() => setAdding(false)}>
                Annuler
              </Button>
              <Button
                variant="secondary"
                size="md"
                onClick={add}
                disabled={!label.trim()}
                className="flex-1"
              >
                Ajouter
              </Button>
            </div>
          </div>
        </AdminCard>
      )}

      {list.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center mb-4 shadow-sm">
          <p className="text-neutral-500 mb-2">Aucune question pour le moment</p>
          <p className="text-neutral-400 text-sm">
            Ajoutez au moins une question pour activer le mode interview
          </p>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {list.map((q, idx) => (
            <div
              key={q.id}
              className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex items-center gap-3"
            >
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(idx, -1)}
                  disabled={idx === 0}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-500"
                  aria-label="Monter"
                >
                  <MdKeyboardArrowUp size={16} />
                </button>
                <button
                  onClick={() => move(idx, 1)}
                  disabled={idx === list.length - 1}
                  className="p-1 rounded hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed text-neutral-500"
                  aria-label="Descendre"
                >
                  <MdKeyboardArrowDown size={16} />
                </button>
              </div>
              <div className="flex-1 min-w-0">
                {editingId === q.id ? (
                  <div className="space-y-2">
                    <input
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-neutral-500">
                        {editDuration}s
                      </span>
                      <input
                        type="range"
                        min={5}
                        max={60}
                        value={editDuration}
                        onChange={(e) => setEditDuration(Number(e.target.value))}
                        className="flex-1 accent-neutral-900"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-neutral-800 text-sm font-medium leading-tight">
                      {q.label}
                    </p>
                    <p className="text-neutral-400 text-xs mt-1">
                      Temps de réponse : {q.duration_seconds}s
                    </p>
                  </>
                )}
              </div>
              {editingId === q.id ? (
                <button
                  onClick={saveEdit}
                  className="p-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-100"
                  aria-label="Valider"
                >
                  <MdCheck size={14} />
                </button>
              ) : (
                <button
                  onClick={() => beginEdit(q)}
                  className="p-2 rounded-lg bg-neutral-50 hover:bg-neutral-100 text-neutral-500 border border-neutral-100"
                  aria-label="Modifier"
                >
                  <MdEdit size={14} />
                </button>
              )}
              <button
                onClick={() => remove(q.id)}
                className="p-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-500 border border-red-100"
                aria-label="Supprimer"
              >
                <MdDelete size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {!adding && (
        <Button
          variant="primary"
          onClick={() => setAdding(true)}
          icon={<MdAdd size={20} />}
          fullWidth
        >
          Ajouter une question
        </Button>
      )}
    </>
  );
}
