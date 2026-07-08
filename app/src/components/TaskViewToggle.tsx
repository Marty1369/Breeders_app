import { useNavigate } from 'react-router-dom';
import { SegmentedControl } from './ui';

/** List ↔ Gantt switcher shared by the Tasks and Gantt screens. */
export default function TaskViewToggle({ current }: { current: 'list' | 'gantt' }) {
  const navigate = useNavigate();
  return (
    <div className="max-w-[220px]">
      <SegmentedControl
        value={current}
        onChange={(v) => navigate(v === 'gantt' ? '/gantt' : '/tasks')}
        options={[
          { value: 'list', label: 'List' },
          { value: 'gantt', label: 'Gantt' },
        ]}
      />
    </div>
  );
}
