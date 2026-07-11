import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSpace } from '../state/SpaceProvider';
import { supabase } from '../lib/supabase';
import { Avatar, Card, PageHeader } from '../components/ui';
import LitterSwitcherSheet from '../components/LitterSwitcherSheet';

const ITEMS = [
  { to: '/whelping', label: 'Whelping birth log', icon: '🐣' },
  { to: '/weigh-in', label: 'Weigh-ins', icon: '∿' },
  { to: '/health-log', label: 'Health log', icon: '✚' },
  { to: '/expenses', label: 'Expenses', icon: '€' },
  { to: '/buyers', label: 'Buyers', icon: '⌂' },
  { to: '/docs', label: 'Documents', icon: '▤' },
  { to: '/ongoing', label: 'Agenda', icon: '⟳' },
  { to: '/litters', label: 'Litters', icon: '▣' },
  { to: '/dogs', label: 'My dogs', icon: '↺' },
  { to: '/team', label: 'Team & invites', icon: '👥' },
  { to: '/notifications', label: 'Notifications', icon: '🔔' },
  { to: '/settings', label: 'Settings', icon: '⚙' },
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
      <PageHeader title="Menu" subtitle={space?.kennel_name || space?.name} />

      <Link to="/profile">
        <Card className="p-3.5 flex items-center gap-3 cursor-pointer mb-4">
          {me && <Avatar name={me.name} color={me.avatar_color} size={40} />}
          <div>
            <div className="text-[13.5px] font-extrabold">{me?.name}</div>
            <div className="text-[10.5px] text-faint font-semibold">My profile</div>
          </div>
        </Card>
      </Link>

      <button onClick={() => setSwitcherOpen(true)} className="w-full text-left cursor-pointer">
        <Card className="p-3.5 mb-4">
          <div className="text-[10px] font-extrabold text-faint tracking-wide">ACTIVE LITTER</div>
          <div className="text-[13.5px] font-extrabold mt-0.5">{activeLitter?.name || 'None selected'}</div>
          <div className="text-[11px] text-accent font-extrabold mt-1">Switch litter →</div>
        </Card>
      </button>

      <div className="flex flex-col gap-1.5">
        {ITEMS.map((item) => (
          <Link key={item.to} to={item.to}>
            <Card className="p-3.5 flex items-center gap-3 cursor-pointer">
              <span className="text-[16px] w-5 text-center">{item.icon}</span>
              <span className="text-[13px] font-bold">{item.label}</span>
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
