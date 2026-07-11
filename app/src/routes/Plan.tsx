import { useSearchParams } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { PageHeader, SegmentedControl } from '../components/ui';
import Timeline from './Timeline';
import Gantt from './Gantt';
import Ongoing from './Ongoing';

// Plan & timeline (spec §4): one screen, three tabs. Replaces the separate
// /tasks, /gantt, /ongoing routes and the List/Gantt cross-navigation toggle.

type Tab = 'list' | 'gantt' | 'routines';
const TABS: { value: Tab; label: string }[] = [
  { value: 'list', label: 'List' },
  { value: 'gantt', label: 'Gantt' },
  { value: 'routines', label: 'Routines' },
];

export default function Plan() {
  const { litters, activeLitterId } = useSpace();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = raw === 'gantt' || raw === 'routines' ? raw : 'list';
  const litter = litters.find((l) => l.id === activeLitterId) || null;

  const setTab = (t: Tab) => setParams(t === 'list' ? {} : { tab: t }, { replace: true });

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto">
      <PageHeader title="Plan & timeline" subtitle={litter?.name} />
      <div className="mb-4 max-w-sm">
        <SegmentedControl value={tab} onChange={setTab} options={TABS} />
      </div>
      {tab === 'list' && <Timeline mode="list" embedded />}
      {tab === 'gantt' && <Gantt embedded />}
      {tab === 'routines' && <Ongoing embedded />}
    </div>
  );
}
