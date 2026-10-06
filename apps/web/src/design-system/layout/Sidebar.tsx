import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MedsIcon } from './icons';
import { NAVIGATION_SECTIONS } from './navigation';
import { MotorsportsEventsLogo } from '../branding/MotorsportsEventsLogo';
import { adminAuthorization } from '../../lib/adminAuth';

const API = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  const [correctionCount, setCorrectionCount] = useState<number | null>(null);
  const [version, setVersion] = useState('Version indisponible');
  useEffect(() => {
    void fetch(`${API}/api/v1/admin/corrections`, { credentials: 'include', headers: adminAuthorization() })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((rows: unknown[]) => setCorrectionCount(rows.length))
      .catch(() => setCorrectionCount(null));
    void fetch(`${API}/health`).then((response) => response.ok ? response.json() : Promise.reject())
      .then((health: { version?: string }) => setVersion(health.version && health.version !== 'unknown' ? health.version : 'Version indisponible'))
      .catch(() => setVersion('Version indisponible'));
  }, []);
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Navigation principale">
      <div className="logo">
        <MotorsportsEventsLogo />
      </div>

      <nav>
        {NAVIGATION_SECTIONS.map((section, index) => (
          <div className="nav-group" key={section.label || `root-${index}`}>
            {section.label && <div className="nav-section">{section.label}</div>}
            {section.items.map((item) => (
              <NavLink
                key={item.path}
                end={item.path === '/'}
                to={item.path}
                onClick={onNavigate}
                className={({ isActive }) => (isActive ? 'active' : '')}
              >
                <i><MedsIcon name={item.icon} size={17} /></i>
                <span>{item.label}</span>
                {item.path === '/corrections' && correctionCount !== null && correctionCount > 0 && <b>{correctionCount}</b>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <footer>
        <div className="exit"><MedsIcon name="logout" size={18} /></div>
        <span>{version}<br/><small>© 2026 Motorsports Events</small></span>
      </footer>
    </aside>
  );
}
