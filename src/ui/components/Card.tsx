import type { PropsWithChildren, ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function Card({
  title,
  subtitle,
  action,
  className,
  children,
}: PropsWithChildren<CardProps>): JSX.Element {
  return (
    <section className={`card ${className ?? ""}`.trim()}>
      {(title || subtitle || action) && (
        <header className="card-header">
          <div>
            {title && <h3>{title}</h3>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  );
}
