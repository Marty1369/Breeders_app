import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import type { ReactNode } from 'react';
import { Avatar, Card, PageHeader } from '../components/ui';
import LitterSwitcherSheet from '../components/LitterSwitcherSheet';
import {
  CoinsIcon, UsersIcon, FileIcon, DogIcon, BellIcon, SettingsIcon,
} from '../components/icons';

// Kennel = cross-litter destinations only. Care actions for the current
// litter (whelping, weigh-in, health log, routines) live on the Puppies
// screen and the Plan tabs, not here (audit D5/D6).
const ITEMS: { to: string; label: string; icon: ReactNode }[] = [
  { to: '/litters', label: 'Dogs & litters', icon: <DogIcon /> },
  { to: '/buyers', label: 'Buyers', icon: <UsersIcon /> },
  { to: '/expenses', label: 'Money', icon: <CoinsIcon /> },
  { to: '/docs', label: 'Documents', icon: <FileIcon /> },
  { to: '/team', label: 'Team & invites', icon: <UsersIcon /> },
  { to: '/notifications', label: 'Notifications', icon: <BellIcon /> },
  { to: '/settings', label: 'Settings', icon: <SettingsIcon /> },
];

export default function Menu() {
  const { space, litters, activeLitterId, me } = useSpace();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const activeLitter = litters.find((l) => l.id === activeLitterId);

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <div className="p-4 sm:p-6 max-w-lg mx-auto">
      <PageHeader title="Kennel" subtitle={space?.kennel_name || space?.name} />

      <Link to="/profile">
        <Card className="p-3.5 flex items-center gap-3 cursor-pointer mb-4">
          {me && <Avatar name={me.name} color={me.avatar_color} size={40} />}
          <div>
            <div className="text-[15px] font-extrabold">{me?.name}</div>
            <div className="text-[12px] text-faint font-semibold">My profile</div>
          </div>
        </Card>
      </Link>

      <button onClick={() => setSwitcherOpen(true)} className="w-full text-left cursor-pointer">
        <Card className="p-3.5 mb-4">
          <div className="text-[12px] font-extrabold text-faint">You're looking at</div>
          <div className="text-[15px] font-extrabold mt-0.5">{activeLitter?.name || 'None selected'}</div>
          <div className="text-[12px] text-accent font-extrabold mt-1">Switch litter →</div>
        </Card>
      </button>

      <div className="flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="p-3.5 flex items-center gap-3 cursor-pointer">
              <span className="w-6 h-6 grid place-items-center text-accent flex-none">{item.icon}</span>
              <span className="text-[15px] font-bold">{item.label}</span>
            </Card>
          </Link>
        ))}
      </div>

      <button onClick={signOut} className="w-full text-center mt-6 text-[12.5px] font-extrabold text-danger cursor-pointer">
        Sign out
      </button>

      <LitterSwitcherSheet open={switcherOpen} onClose={() => setSwitcherOpen(false)} />
    </div>
  );
}
