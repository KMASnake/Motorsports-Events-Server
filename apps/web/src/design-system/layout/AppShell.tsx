import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell({ children }: { children: ReactNode }) {
  const [navigationOpen, setNavigationOpen] = useState(false);

  return (
    <div className={`app-shell ${navigationOpen ? 'navigation-open' : ''}`}>
      <Sidebar open={navigationOpen} onNavigate={() => setNavigationOpen(false)} />
      {navigationOpen && (
        <button
          className="navigation-backdrop"
          aria-label="Fermer la navigation"
          onClick={() => setNavigationOpen(false)}
        />
      )}
      <section className="app-main">
        <Topbar onMenu={() => setNavigationOpen((current) => !current)} />
        <main className="page">{children}</main>
      </section>
    </div>
  );
}
