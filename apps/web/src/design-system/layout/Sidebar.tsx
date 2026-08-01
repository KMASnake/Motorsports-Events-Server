import { NavLink } from 'react-router-dom';
import { MedsIcon } from './icons';
import { NAVIGATION_SECTIONS } from './navigation';

export function Sidebar({
  open,
  onNavigate,
}: {
  open: boolean;
  onNavigate: () => void;
}) {
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`} aria-label="Navigation principale">
      <div className="logo">
        <div className="gauge"><MedsIcon name="gauge" size={31} /></div>
        <strong>MOTORSPORTS<br/><em>EVENTS</em> <small>SERVER</small></strong>
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
                {item.badge !== undefined && <b>{item.badge}</b>}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      <footer>
        <div className="exit"><MedsIcon name="logout" size={18} /></div>
        <span>8.1.0-alpha.2-lot.4<br/><small>© 2026 Motorsports Events</small></span>
      </footer>
    </aside>
  );
}
