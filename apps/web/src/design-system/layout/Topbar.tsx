import { useEffect, useState } from 'react';
import { IconButton } from '../components';
import { MedsIcon } from './icons';
import { useAdminAuth } from '../../lib/adminAuth';

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
  const auth = useAdminAuth();
  const [logoutFailed, setLogoutFailed] = useState(false);
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
        <b>{auth.session?.administrator.username}</b>
        <span>Administrateur</span>
      </div>
      <button className="logout-button" title={logoutFailed ? 'La déconnexion a échoué. Réessayez.' : undefined} onClick={() => { setLogoutFailed(false); void auth.logout().catch(() => setLogoutFailed(true)); }} aria-label="Se déconnecter">{logoutFailed ? 'Réessayer' : 'Déconnexion'}</button>
    </header>
  );
}
