import { useEffect, useState } from 'react';
import { IconButton } from '../components';
import { MedsIcon } from './icons';

function formatClock(date: Date) {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Europe/Paris',
  }).format(date);
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const [clock, setClock] = useState(() => formatClock(new Date()));

  useEffect(() => {
    const timer = window.setInterval(() => setClock(formatClock(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <IconButton label="Ouvrir ou fermer la navigation" className="hamburger" onClick={onMenu}>
        <MedsIcon name="menu" size={23} />
      </IconButton>

      <div className="context">
        <strong>MOTORSPORTS EVENTS SERVER</strong>
        <span>Phase 1.1 — Shell global MEDS</span>
      </div>

      <div className="clock">
        <MedsIcon name="clock" size={17} />
        <b>{clock}</b>
        <span>Europe/Paris</span>
      </div>

      <div className="system">
        <i />
        SYSTÈME
        <b>OPÉRATIONNEL</b>
      </div>

      <div className="bell">
        <MedsIcon name="bell" size={20} />
        <b>3</b>
      </div>

      <div className="avatar" aria-hidden="true">●</div>
      <div className="user">
        <b>admin@example.com</b>
        <span>Super Administrateur</span>
      </div>
      <MedsIcon name="chevron" size={14} />
    </header>
  );
}
