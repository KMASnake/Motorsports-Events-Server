import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { MotorsportsEventsLogo } from '../design-system/branding/MotorsportsEventsLogo';
import { useAdminAuth } from '../lib/adminAuth';

export function safeLoginDestination(value: unknown): string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export function LoginPage() {
  const auth = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  if (auth.status === 'loading') return <AuthenticationLoading />;
  if (auth.status === 'authenticated') return <Navigate to={safeLoginDestination(location.state?.from)} replace />;

  async function submit(event: FormEvent) {
    event.preventDefault(); setError(''); setSubmitting(true);
    try { await auth.login(username, password); navigate(safeLoginDestination(location.state?.from), { replace: true }); }
    catch (failure) { setError((failure as Error).message || 'Identifiant ou mot de passe incorrect.'); }
    finally { setSubmitting(false); }
  }

  return <main className="auth-page"><section className="auth-card" aria-labelledby="login-title">
    <MotorsportsEventsLogo />
    <div className="auth-heading"><small>CONSOLE D’ADMINISTRATION</small><h1 id="login-title">Connexion</h1><p>Identifiez-vous pour accéder à Motorsports Events Server.</p></div>
    {error && <div className="auth-error" role="alert">{error}</div>}
    <form onSubmit={submit}>
      <label>Identifiant<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required autoFocus /></label>
      <label>Mot de passe<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
      <button className="danger" type="submit" disabled={submitting}>{submitting ? 'Connexion…' : 'Se connecter'}</button>
    </form>
    <footer>Session sécurisée · expiration après 1 heure d’inactivité</footer>
  </section></main>;
}

export function AuthenticationLoading() {
  return <main className="auth-page"><div className="auth-loading" role="status">Vérification de la session…</div></main>;
}
