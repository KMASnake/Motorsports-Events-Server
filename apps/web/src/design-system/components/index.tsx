import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'muted';

export function Button({
  variant = 'default',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'danger' | 'ghost';
}) {
  const variantClass =
    variant === 'primary' || variant === 'danger'
      ? 'danger'
      : variant === 'ghost'
        ? 'ds-button-ghost'
        : '';
  return <button className={`${variantClass} ${className}`.trim()} {...props} />;
}

export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button className="ds-icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`ds-card ${className}`.trim()}>{children}</section>;
}

export function Panel({
  title,
  children,
  action,
  className = '',
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`.trim()}>
      <header>
        <h2>{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <Card className="ds-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </Card>
  );
}

export function Badge({
  children,
  tone = 'muted',
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return <span className={`ds-badge ${tone}`}>{children}</span>;
}

export function StatusChip({
  text,
  tone = 'green',
}: {
  text: string;
  tone?: Tone;
}) {
  return <span className={`pill ${tone}`}>{text}</span>;
}

export function ProgressBar({
  value,
  tone = 'green',
  label,
}: {
  value: number;
  tone?: Tone;
  label?: string;
}) {
  const safeValue = Math.max(0, Math.min(100, value));
  return (
    <div
      className={`ds-progress ${tone}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={safeValue}
      aria-label={label}
    >
      <i style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function QualityBar({ value }: { value: number }) {
  if (!value) {
    return (
      <span>
        —
        <small>Aucune donnée</small>
      </span>
    );
  }

  const tone: Tone = value < 92 ? 'amber' : 'green';
  return (
    <div className="quality">
      <b className={tone === 'amber' ? 'amber' : ''}>{value}%</b>
      <ProgressBar value={value} tone={tone} label={`Qualité ${value}%`} />
      <small>{value >= 94 ? 'Excellent' : value >= 92 ? 'Bon' : 'À surveiller'}</small>
    </div>
  );
}

export function EmptyState({
  text = 'Sélectionnez un élément pour afficher son détail.',
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <span aria-hidden="true">◇</span>
      <p>{text}</p>
    </div>
  );
}
