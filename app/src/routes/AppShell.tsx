import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { activeEnv } from '../lib/supabase';
import type { ReactNode } from 'react';
import { Avatar } from '../components/ui';
import { todayStr, diffDays } from '../lib/dates';
import { effectiveDate } from '../lib/scheduling';
import { litterProgress } from '../lib/stages';
import type { Dog } from '../lib/types';
import {
  HomeIcon, PawIcon, FileIcon, UsersIcon, CoinsIcon, DogIcon, CalendarIcon, BuildingIcon,
  SettingsIcon, SearchIcon, BellIcon, PlusIcon, ChevronsUpDownIcon,
} from '../components/icons';
import LitterSwitcherSheet from '../components/LitterSwitcherSheet';
import TaskFormSheet from '../components/task/TaskFormSheet';
import { registerOverlay, closeOverlayThenNavigate } from '../lib/backClose';
import Home from './Home';
import Plan from './Plan';
import Litters from './Litters';
import NewLitterWizard from '../components/NewLitterWizard';
import { AllDocuments, AllBuyers, AllExpenses } from './Aggregates';
import Dogs from './Dogs';
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

type NavItem = { to: string; label: string; icon: ReactNode; end?: boolean };

// Desktop sidebar: 8 items in two groups (spec §2.2).
const THIS_LITTER_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <HomeIcon />, end: true },
  { to: '/plan', label: 'Plan & timeline', icon: <CalendarIcon /> },
  { to: '/puppies', label: 'Puppies & care', icon: <PawIcon /> },
  { to: '/buyers', label: 'Buyers', icon: <UsersIcon /> },
  { to: '/expenses', label: 'Money', icon: <CoinsIcon /> },
  { to: '/docs', label: 'Documents', icon: <FileIcon /> },
];

const MY_KENNEL_NAV: NavItem[] = [
  { to: '/litters', label: 'Dogs & litters', icon: <DogIcon /> },
  { to: '/settings', label: 'Settings & team', icon: <SettingsIcon /> },
];

// Mobile bottom bar: 4 tabs, each labelled by what it opens (spec §2.1).
const MOBILE_NAV: NavItem[] = [
  { to: '/', label: 'Home', icon: <HomeIcon />, end: true },
  { to: '/plan', label: 'Plan', icon: <CalendarIcon />, end: false },
  { to: '/puppies', label: 'Puppies', icon: <PawIcon />, end: false },
  { to: '/kennel', label: 'Kennel', icon: <BuildingIcon />, end: false },
];

export default function AppShell() {
  const [width, setWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const isDesktop = width >= 900;
  const { space, litters, dogs, activeLitterId, notifications, me } = useSpace();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // The FAB chooser is a custom overlay (not a Sheet) — register it with the
  // back-gesture manager so Android back closes it instead of navigating.
  useEffect(() => {
    if (!fabOpen) return;
    return registerOverlay(() => setFabOpen(false));
  }, [fabOpen]);

  const activeLitter = litters.find((l) => l.id === activeLitterId) || null;
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const whelping = activeLitter ? effectiveDate(activeLitter.dates, 'whelping') : null;
  const handover = activeLitter ? effectiveDate(activeLitter.dates, 'handover') : null;
  const heat = activeLitter ? effectiveDate(activeLitter.dates, 'heat') : null;

  // Explained progress (spec §1.5): a plain-words headline instead of "Day N of 63".
  const progress = activeLitter ? litterProgress(activeLitter) : null;
  let pct = 0;
  if (activeLitter && whelping && heat && handover) {
    const total = diffDays(heat, handover) || 1;
    pct = Math.max(0, Math.min(100, (diffDays(heat, todayStr()) / total) * 100));
  }

  return (
    <div className="h-full flex flex-col bg-app-bg text-ink overflow-hidden">
      <div className="flex-1 flex min-h-0">
        {isDesktop && (
          <div data-dark-surface className="w-[248px] flex-none text-white flex flex-col p-3.5 pt-4 overflow-y-auto" style={{ background: '#123f2d' }}>
            <Link to="/" className="flex items-center gap-2.5 px-0.5">
              <Logo size={34} />
              <div>
                <div className="text-[14px] font-extrabold text-white">Litter Planner</div>
                <div className="text-[10px] text-white/60 font-bold truncate max-w-[160px]">{space?.kennel_name || space?.name}</div>
              </div>
            </Link>

            {/* The one switcher: "You're looking at" litter card */}
            <button
              onClick={() => setSwitcherOpen(true)}
              className="mt-4 w-full rounded-[14px] px-3 py-3 text-left cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.08)' }}
            >
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-extrabold tracking-wide text-[#7fd4ae]">You're looking at</div>
                  <div className="text-[14px] font-extrabold truncate">{activeLitter ? activeLitter.name : 'No litter selected'}</div>
                </div>
                <span className="text-white/60 flex-none"><ChevronsUpDownIcon size={16} /></span>
              </div>
              {activeLitter && (
                <>
                  <div className="text-[11px] text-white/70 font-semibold mt-0.5 truncate">
                    {dogName(dogs, activeLitter.dam_id)} × {dogName(dogs, activeLitter.sire_id)}
                  </div>
                  <div className="text-[11.5px] font-bold mt-1">{progress?.headline}</div>
                  <div className="mt-1.5 h-[5px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.15)' }}>
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#7fd4ae' }} />
                  </div>
                </>
              )}
            </button>

            <SideGroup label="THIS LITTER" items={THIS_LITTER_NAV} disabled={!activeLitter} />
            <SideGroup label="MY KENNEL" items={MY_KENNEL_NAV} />

            <div className="flex-1" />

            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2.5 px-1 py-2 rounded-[10px] hover:bg-white/[0.07] cursor-pointer text-left"
            >
              {me && <Avatar name={me.name} color={me.avatar_color} size={30} />}
              <div className="min-w-0">
                <div className="text-[12px] font-extrabold truncate text-white">{me?.name}</div>
                <div className="text-[10px] text-white/55 font-semibold">My profile</div>
              </div>
            </button>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="flex-none bg-card border-b border-border flex items-center gap-2.5 px-4 py-2.5 min-h-[52px]">
            {!isDesktop && (
              <Link to="/" className="flex-none">
                <Logo size={32} />
              </Link>
            )}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="text-[15px] font-extrabold truncate">{space?.kennel_name || space?.name}</div>
              {activeEnv !== 'production' && (
                <span className="flex-none px-2 py-0.5 rounded-full text-[9.5px] font-extrabold tracking-wide bg-amber text-white">
                  STAGING
                </span>
              )}
            </div>
            <button aria-label="Search" onClick={() => navigate('/search')} className="w-9 h-9 rounded-full grid place-items-center text-muted hover:bg-muted-bg hover:text-ink cursor-pointer">
              <SearchIcon size={19} />
            </button>
            <button aria-label="Notifications" onClick={() => navigate('/notifications')} className="relative w-9 h-9 rounded-full grid place-items-center text-muted hover:bg-muted-bg hover:text-ink cursor-pointer">
              <BellIcon size={19} />
              {unreadCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-danger" />}
            </button>
            {!isDesktop && me && (
              <button onClick={() => navigate('/profile')}>
                <Avatar name={me.name} color={me.avatar_color} size={30} />
              </button>
            )}
          </header>

          <main className="flex-1 overflow-y-auto min-h-0 pb-16 sm:pb-0">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/kennel" element={<Menu />} />
              {/* Retired routes → redirects (spec §2.1) */}
              <Route path="/today" element={<Navigate to="/" replace />} />
              <Route path="/tasks" element={<Navigate to="/plan" replace />} />
              <Route path="/gantt" element={<Navigate to="/plan?tab=gantt" replace />} />
              <Route path="/ongoing" element={<Navigate to="/plan?tab=routines" replace />} />
              <Route path="/menu" element={<Navigate to="/kennel" replace />} />
              {/* The new-litter wizard lives here now (spec §7), not on /dogs. */}
              <Route path="/litters/new" element={<NewLitterRoute />} />
              {/* Cross-litter */}
              <Route path="/litters" element={<Litters />} />
              <Route path="/all-documents" element={<AllDocuments />} />
              <Route path="/all-buyers" element={<AllBuyers />} />
              <Route path="/all-expenses" element={<AllExpenses />} />
              <Route path="/dogs" element={<Dogs />} />
              {/* Litter-scoped */}
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
            </Routes>
          </main>
        </div>
      </div>

      {!isDesktop && (
        <nav aria-label="Primary" className="flex-none bg-card border-t border-border grid grid-cols-4 fixed bottom-0 left-0 right-0 z-30" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          {MOBILE_NAV.map((item) => (
            <BottomLink key={item.to} {...item} active={isMobileTabActive(item.to, location.pathname)} />
          ))}
        </nav>
      )}

      {/* Hide the FAB where a screen has its own sticky primary action bar, and
          on whelping night, where an accidental tap would be harmful. */}
      {!isDesktop && activeLitter && location.pathname !== '/weigh-in' && location.pathname !== '/whelping' && (
        <button
          aria-label="Add to this litter"
          onClick={() => setFabOpen(true)}
          className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-accent text-white grid place-items-center shadow-lg cursor-pointer"
        >
          <PlusIcon size={26} />
        </button>
      )}

      {/* FAB chooser — always "add to this litter" (spec §2.1) */}
      {fabOpen && (
        <div className="fixed inset-0 z-40 flex items-end justify-center" onClick={() => setFabOpen(false)}>
          <div className="absolute inset-0 bg-black/35" />
          <div className="relative bg-card w-full rounded-t-[18px] p-4 pb-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="text-[11px] font-extrabold tracking-wide text-faint mb-2">Add to {activeLitter?.name}</div>
            <div className="grid grid-cols-2 gap-2">
              {[
                // Sheet handoff: plain close+open — the back-gesture sentinel survives.
                { label: 'Task', run: () => { setFabOpen(false); setNewTaskOpen(true); } },
                // Route actions: consume the sentinel, then navigate (lib/backClose).
                { label: 'Weigh-in', run: () => closeOverlayThenNavigate(() => setFabOpen(false), () => navigate('/weigh-in')) },
                { label: 'Health entry', run: () => closeOverlayThenNavigate(() => setFabOpen(false), () => navigate('/health-log')) },
                { label: 'Expense', run: () => closeOverlayThenNavigate(() => setFabOpen(false), () => navigate('/expenses?new=1')) },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={o.run}
                  className="py-3 rounded-[12px] bg-muted-bg text-[14px] font-extrabold cursor-pointer hover:bg-accent-soft hover:text-accent"
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <LitterSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
      <TaskFormSheet open={newTaskOpen} litterId={activeLitterId} onClose={() => setNewTaskOpen(false)} />
    </div>
  );
}

function isMobileTabActive(to: string, path: string): boolean {
  if (to === '/') return path === '/';
  if (to === '/plan') return ['/plan', '/tasks', '/gantt', '/ongoing'].some((p) => path.startsWith(p));
  if (to === '/puppies') return ['/puppies', '/weigh-in', '/health-log', '/whelping', '/docs'].some((p) => path.startsWith(p));
  if (to === '/kennel') return ['/kennel', '/menu', '/litters', '/dogs', '/buyers', '/expenses', '/team', '/settings', '/all-'].some((p) => path.startsWith(p));
  return path === to || path.startsWith(to + '/');
}

function dogName(dogs: Dog[], id: string | null): string {
  return dogs.find((d) => d.id === id)?.name ?? '—';
}

// The new-litter wizard as a route (spec §7): the Litters list sits behind the
// sheet for context; closing returns to the list.
function NewLitterRoute() {
  const navigate = useNavigate();
  return (
    <>
      <Litters />
      <NewLitterWizard open onClose={() => navigate('/litters')} />
    </>
  );
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

function SideGroup({ label, items, disabled }: { label: string; items: NavItem[]; disabled?: boolean }) {
  return (
    <>
      <div className="text-[10px] font-extrabold tracking-wider text-white/45 mt-4 mb-1.5 px-1 truncate">{label}</div>
      <nav className={`flex flex-col gap-0.5 ${disabled ? 'opacity-40 pointer-events-none' : ''}`}>
        {items.map((item) => (
          <SideLink key={item.to} {...item} />
        ))}
      </nav>
    </>
  );
}

function SideLink({ to, label, icon, end }: NavItem) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-[13px] font-extrabold whitespace-nowrap ${
          isActive ? 'bg-white/[0.14] text-white' : 'text-white/70 hover:bg-white/[0.07]'
        }`
      }
    >
      <span className="w-[20px] h-[20px] flex-none grid place-items-center">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

function BottomLink({ to, label, icon, active }: NavItem & { active: boolean }) {
  return (
    <Link to={to} aria-current={active ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-0.5 py-1.5 ${active ? 'text-accent' : 'text-muted'}`}>
      <span className="grid place-items-center h-[22px]" aria-hidden="true">{icon}</span>
      <span className="text-[10px] font-bold">{label}</span>
    </Link>
  );
}
