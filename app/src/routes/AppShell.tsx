import { useEffect, useState } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { Avatar, Button } from '../components/ui';
import { niceDate, todayStr, diffDays } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import LitterSwitcherSheet from '../components/LitterSwitcherSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import RuleFormSheet from '../components/RuleFormSheet';
import Dashboard from './Dashboard';
import Ongoing from './Ongoing';
import Today from './Today';
import Gantt from './Gantt';
import Litters from './Litters';
import { AllDocuments, AllBuyers, AllExpenses } from './Aggregates';
import Dogs from './Dogs';
import Timeline from './Timeline';
import LitterInfo from './LitterInfo';
import BirthLog from './BirthLog';
import WeighIn from './WeighIn';
import HealthLog from './HealthLog';
import Puppies from './Puppies';
import PuppyProfile from './PuppyProfile';
import PuppyEdit from './PuppyEdit';
import Docs from './Docs';
import PdfViewer from './PdfViewer';
import Expenses from './Expenses';
import People from './People';
import OwnerRecord from './OwnerRecord';
import CloseOut from './CloseOut';
import Notifications from './Notifications';
import Settings from './Settings';
import MyProfile from './MyProfile';
import Search from './Search';
import Menu from './Menu';

const KENNEL_NAV = [
  { to: '/', label: 'Dashboard', icon: '◈', end: true },
  { to: '/litters', label: 'Litters', icon: '▣' },
  { to: '/all-documents', label: 'All documents', icon: '▤' },
  { to: '/all-buyers', label: 'All buyers', icon: '⌂' },
  { to: '/all-expenses', label: 'All expenses', icon: '€' },
  { to: '/dogs', label: 'My dogs', icon: '↺' },
];

const LITTER_NAV = [
  { to: '/gantt', label: 'Gantt', icon: '▦' },
  { to: '/tasks', label: 'Tasks', icon: '☰' },
  { to: '/ongoing', label: 'Ongoing', icon: '⟳' },
  { to: '/weigh-in', label: 'Weigh-ins', icon: '∿' },
  { to: '/puppies', label: 'Puppies', icon: '❋' },
  { to: '/docs', label: 'Documents', icon: '▤' },
  { to: '/buyers', label: 'Buyers', icon: '⌂' },
  { to: '/expenses', label: 'Expenses', icon: '€' },
];

const MOBILE_NAV = [
  { to: '/today', label: 'Today', icon: '☀', end: false },
  { to: '/tasks', label: 'Plan', icon: '▤', end: false },
  { to: '/puppies', label: 'Litter', icon: '❋', end: false },
  { to: '/menu', label: 'More', icon: '⋯', end: false },
];

export default function AppShell() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newRepeatOpen, setNewRepeatOpen] = useState(false);
  const isDesktop = width >= 900;
  const { space, litters, activeLitterId, notifications, me } = useSpace();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const activeLitter = litters.find((l) => l.id === activeLitterId) || null;
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const whelping = activeLitter ? effectiveDate(activeLitter.dates, 'whelping') : null;
  const handover = activeLitter ? effectiveDate(activeLitter.dates, 'handover') : null;
  const heat = activeLitter ? effectiveDate(activeLitter.dates, 'heat') : null;

  // Progress within the 63-day whelping→handover window (post-birth) or countdown to whelping.
  let dayLabel = '';
  let pct = 0;
  if (activeLitter && whelping) {
    const d = diffDays(whelping, todayStr());
    dayLabel = d < 0 ? `T–${Math.abs(d)} to whelping` : `Day ${d} of 63`;
    if (heat && handover) {
      const total = diffDays(heat, handover) || 1;
      pct = Math.max(0, Math.min(100, (diffDays(heat, todayStr()) / total) * 100));
    }
  }

  const litterLabel = activeLitter ? activeLitter.name.toUpperCase() : 'NO LITTER';

  return (
    <div className="h-full flex flex-col bg-app-bg text-ink overflow-hidden">
      <div className="flex-1 flex min-h-0">
        {isDesktop && (
          <div className="w-[236px] flex-none bg-card border-r border-border flex flex-col p-3.5 pt-4 overflow-y-auto">
            <Link to="/" className="flex items-center gap-2.5 px-0.5">
              <Logo size={34} />
              <div>
                <div className="text-[14px] font-extrabold text-ink">Litter Planner</div>
                <div className="text-[10px] text-faint font-bold truncate max-w-[150px]">{space?.kennel_name || space?.name}</div>
              </div>
            </Link>

            <NavGroup label="KENNEL" items={KENNEL_NAV} />

            {/* Current-litter switcher header */}
            <button
              onClick={() => setSwitcherOpen(true)}
              className="mt-4 mb-1 w-full flex items-center gap-2 px-2 py-1.5 rounded-[9px] hover:bg-muted-bg cursor-pointer text-left"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-extrabold tracking-wider text-faint">CURRENT LITTER</div>
                <div className="text-[13px] font-extrabold text-accent truncate">{activeLitter ? activeLitter.name : 'None selected'}</div>
              </div>
              <span className="text-[11px] text-muted flex-none">⇅</span>
            </button>
            <nav className={`flex flex-col gap-0.5 ${!activeLitter ? 'opacity-40 pointer-events-none' : ''}`}>
              {LITTER_NAV.map((item) => (
                <SideLink key={item.to} {...item} />
              ))}
            </nav>

            {activeLitter && (
              <button
                onClick={() => setSwitcherOpen(true)}
                className="mt-3.5 bg-muted-bg border border-card-border rounded-[12px] px-3 py-2.5 text-left cursor-pointer"
              >
                <div className="text-[9.5px] font-extrabold tracking-wider text-accent">{litterLabel}</div>
                <div className="text-[12.5px] font-extrabold mt-0.5">{dayLabel || activeLitter.status.replace('_', ' ')}</div>
                <div className="mt-1.5 h-[5px] rounded-full bg-[#eef0ec] overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="text-[10px] text-muted font-semibold leading-relaxed mt-1.5">
                  {activeLitter.status === 'closed' ? 'Closed' : whelping ? `Whelping ${niceDate(whelping)}` : 'Not whelped yet'}
                  {handover ? ` · handover ${niceDate(handover)}` : ''}
                </div>
              </button>
            )}

            <div className="flex-1" />

            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2.5 px-1 py-2 rounded-[10px] hover:bg-muted-bg cursor-pointer text-left"
            >
              {me && <Avatar name={me.name} color={me.avatar_color} size={30} />}
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold truncate">{me?.name}</div>
                <div className="text-[10px] text-faint font-semibold">My profile</div>
              </div>
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-none bg-card border-b border-border flex items-center gap-2.5 px-4 py-2.5 min-h-[52px]">
            {!isDesktop && (
              <Link to="/" className="flex-none">
                <Logo size={32} />
              </Link>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-extrabold truncate">{space?.kennel_name || space?.name}</div>
            </div>
            {isDesktop && activeLitter && (
              <>
                <Button variant="secondary" size="sm" onClick={() => setNewRepeatOpen(true)} icon="⟳">New repeat</Button>
                <Button size="sm" onClick={() => setNewTaskOpen(true)} icon="＋">New task</Button>
              </>
            )}
            <button onClick={() => navigate('/search')} className="w-9 h-9 rounded-full grid place-items-center hover:bg-muted-bg cursor-pointer text-[15px]">
              🔍
            </button>
            <button onClick={() => navigate('/notifications')} className="relative w-9 h-9 rounded-full grid place-items-center hover:bg-muted-bg cursor-pointer text-[15px]">
              🔔
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />}
            </button>
            {!isDesktop && me && (
              <button onClick={() => navigate('/profile')}>
                <Avatar name={me.name} color={me.avatar_color} size={30} />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 pb-16 sm:pb-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              {/* KENNEL (cross-litter) */}
              <Route path="/litters" element={<Litters />} />
              <Route path="/all-documents" element={<AllDocuments />} />
              <Route path="/all-buyers" element={<AllBuyers />} />
              <Route path="/all-expenses" element={<AllExpenses />} />
              <Route path="/dogs" element={<Dogs />} />
              {/* LITTER (active-litter scoped) */}
              <Route path="/gantt" element={<Gantt />} />
              <Route path="/tasks" element={<Timeline mode="list" />} />
              <Route path="/ongoing" element={<Ongoing />} />
              <Route path="/today" element={<Today />} />
              <Route path="/weigh-in" element={<WeighIn />} />
              <Route path="/puppies" element={<Puppies />} />
              <Route path="/puppies/:id" element={<PuppyProfile />} />
              <Route path="/puppies/:id/edit" element={<PuppyEdit />} />
              <Route path="/docs" element={<Docs />} />
              <Route path="/docs/:id" element={<PdfViewer />} />
              <Route path="/buyers" element={<People initialTab="owners" />} />
              <Route path="/expenses" element={<Expenses />} />
              {/* details & system */}
              <Route path="/litters/:id" element={<LitterInfo />} />
              <Route path="/whelping" element={<BirthLog />} />
              <Route path="/health-log" element={<HealthLog />} />
              <Route path="/owners/:id" element={<OwnerRecord />} />
              <Route path="/close-out" element={<CloseOut />} />
              <Route path="/team" element={<People initialTab="team" />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<MyProfile />} />
              <Route path="/search" element={<Search />} />
              <Route path="/menu" element={<Menu />} />
            </Routes>
          </div>
        </div>
      </div>

      {!isDesktop && (
        <div className="flex-none bg-card border-t border-border grid grid-cols-4 fixed bottom-0 left-0 right-0 z-30">
          {MOBILE_NAV.map((item) => (
            <BottomLink key={item.to} {...item} active={isMobileTabActive(item.to, location.pathname)} />
          ))}
        </div>
      )}

      {!isDesktop && activeLitter && (
        <button
          onClick={() => setNewTaskOpen(true)}
          className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-accent text-white text-[24px] font-bold grid place-items-center shadow-lg cursor-pointer"
        >
          +
        </button>
      )}

      <LitterSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <TaskFormSheet open={newTaskOpen} litterId={activeLitterId} onClose={() => setNewTaskOpen(false)} />
      <RuleFormSheet open={newRepeatOpen} onClose={() => setNewRepeatOpen(false)} />
    </div>
  );
}

function isMobileTabActive(to: string, path: string): boolean {
  if (to === '/tasks') return ['/tasks', '/gantt', '/ongoing'].some((p) => path.startsWith(p));
  if (to === '/puppies') return ['/puppies', '/weigh-in', '/docs', '/health-log'].some((p) => path.startsWith(p));
  if (to === '/menu') return ['/menu', '/expenses', '/dogs', '/buyers', '/team', '/settings'].some((p) => path.startsWith(p));
  return path === to || path.startsWith(to + '/');
}

function Logo({ size }: { size: number }) {
  const dot = size * 0.16;
  return (
    <div className="flex-none rounded-[11px] bg-accent grid place-items-center" style={{ width: size, height: size }}>
      <div className="grid grid-cols-2" style={{ gap: dot * 0.5 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-full bg-white" style={{ width: dot, height: dot }} />
        ))}
      </div>
    </div>
  );
}

function NavGroup({ label, items, disabled }: { label: string; items: { to: string; label: string; icon: string; end?: boolean }[]; disabled?: boolean }) {
  return (
    <>
      <div className="text-[10px] font-extrabold tracking-wider text-faint mt-4 mb-1.5 px-0.5 truncate">{label}</div>
      <nav className={`flex flex-col gap-0.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {items.map((item) => (
          <SideLink key={item.to} {...item} />
        ))}
      </nav>
    </>
  );
}

function SideLink({ to, label, icon, end }: { to: string; label: string; icon: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[12.5px] font-extrabold whitespace-nowrap ${
          isActive ? 'bg-accent-soft text-accent' : 'text-[#3a413d] hover:bg-muted-bg'
        }`
      }
    >
      <span className="text-[12px] w-[15px] flex-none text-center">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function BottomLink({ to, label, icon, active }: { to: string; label: string; icon: string; active: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-center justify-center gap-0.5 py-1.5 ${active ? 'text-accent' : 'text-muted'}`}>
      <span className="text-[16px]">{icon}</span>
      <span className="text-[9.5px] font-bold">{label}</span>
    </Link>
  );
}
