import { useState } from 'react';
import { useSpace } from '../../state/SpaceProvider';
import { useAuth } from '../../state/AuthProvider';
import { supabase } from '../../lib/supabase';
import { Avatar, Button, Chip, Sheet, TextField } from '../ui';
import { longDate, todayStr } from '../../lib/dates';
import { markTaskDone } from '../../lib/actions';
import type { Task } from '../../lib/types';
import { STAGE_LABEL as PHASE_LABEL } from '../../lib/stages';

export default function TaskDetailSheet({
  task,
  onClose,
  onEdit,
  onComplete,
}: {
  task: Task | null;
  onClose: () => void;
  onEdit: () => void;
  onComplete: () => void;
}) {
  const { members, tasks } = useSpace();
  const { user } = useAuth();
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (!task) return null;

  const predecessors = (task.depends_on ?? [])
    .map((d) => ({ dep: d, pred: tasks.find((t) => t.id === d.taskId) }))
    .filter((x) => x.pred);
  const dependents = tasks.filter((t) => t.depends_on?.some((d) => d.taskId === task.id));

  const assignees = members.filter((m) => task.assignee_ids.includes(m.user_id));
  const overdue = task.status !== 'done' && task.due_date && task.due_date < todayStr();

  async function addComment() {
    if (!comment.trim() || !user || !task) return;
    setBusy(true);
    const rows = [...task.comments, { ts: new Date().toISOString(), byUserId: user.id, text: comment.trim() }];
    await supabase.from('tasks').update({ comments: rows }).eq('id', task.id);
    setComment('');
    setBusy(false);
  }

  async function toggleChecklist(i: number) {
    if (!task) return;
    const items = task.checklist.map((c, idx) => (idx === i ? { ...c, done: !c.done } : c));
    await supabase.from('tasks').update({ checklist: items }).eq('id', task.id);
  }

  return (
    <Sheet
      open={!!task}
      onClose={onClose}
      title={task.name}
      subtitle={`${PHASE_LABEL[task.phase]} · ${longDate(task.start_date)}`}
      footer={
        <>
          <Button variant="ghost" onClick={onEdit}>Edit</Button>
          {task.status === 'done' ? (
            <Button variant="secondary" onClick={() => markTaskDone(task, false)}>Reopen</Button>
          ) : (
            <Button onClick={onComplete}>Complete…</Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          <Chip tone={task.status === 'done' ? 'accent' : overdue ? 'danger' : 'default'}>
            {task.status === 'done' ? 'Done' : overdue ? 'Overdue' : task.status}
          </Chip>
          {task.is_pinned_date && <Chip tone="amber">📌 Pinned date</Chip>}
          {task.anchor_mode === 'anchor+offset' && task.anchor && (
            <Chip>{task.anchor} {(task.offset_days ?? 0) >= 0 ? '+' : ''}{task.offset_days}d</Chip>
          )}
          {task.result_log && <Chip tone="accent">{task.result_log.type}: {task.result_log.value}{task.result_log.unit ? ` ${task.result_log.unit}` : ''}</Chip>}
        </div>

        {(predecessors.length > 0 || dependents.length > 0) && (
          <div>
            <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">DEPENDENCIES</div>
            <div className="flex flex-col gap-1.5">
              {predecessors.map(({ dep, pred }) => (
                <div key={dep.taskId} className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <span className="text-faint">⇢ after</span>
                  <span className="font-bold">{pred!.name}</span>
                  <Chip>{dep.type} {dep.lag >= 0 ? '+' : ''}{dep.lag}d</Chip>
                </div>
              ))}
              {dependents.map((d) => (
                <div key={d.id} className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <span className="text-faint">↳ blocks</span>
                  <span className="font-bold">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">ASSIGNEES</div>
          {assignees.length === 0 ? (
            <div className="text-[12px] text-faint font-semibold">Unassigned</div>
          ) : (
            <div className="flex gap-2">
              {assignees.map((m) => (
                <div key={m.user_id} className="flex items-center gap-1.5">
                  <Avatar name={m.name} color={m.avatar_color} size={24} />
                  <span className="text-[12px] font-bold">{m.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {task.checklist.length > 0 && (
          <div>
            <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">CHECKLIST</div>
            <div className="flex flex-col gap-1.5">
              {task.checklist.map((c, i) => (
                <label key={i} className="flex items-center gap-2.5 cursor-pointer">
                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(i)} className="w-[18px] h-[18px] accent-[#17805a]" />
                  <span className={`text-[12.5px] font-semibold ${c.done ? 'line-through text-faint' : ''}`}>{c.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {task.notes && (
          <div>
            <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">NOTES</div>
            <div className="text-[12.5px] font-semibold text-ink whitespace-pre-wrap">{task.notes}</div>
          </div>
        )}

        <div>
          <div className="text-[11px] font-extrabold text-muted tracking-wide mb-1.5">COMMENTS</div>
          <div className="flex flex-col gap-2">
            {task.comments.map((c, i) => {
              const author = members.find((m) => m.user_id === c.byUserId);
              return (
                <div key={i} className="flex gap-2">
                  {author && <Avatar name={author.name} color={author.avatar_color} size={22} />}
                  <div className="bg-app-bg rounded-[10px] px-2.5 py-1.5 flex-1">
                    <div className="text-[10px] font-extrabold text-faint">{author?.name}</div>
                    <div className="text-[12px] font-semibold">{c.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 mt-2">
            <TextField className="flex-1" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment…" />
            <Button variant="secondary" onClick={addComment} disabled={busy || !comment.trim()}>Send</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
