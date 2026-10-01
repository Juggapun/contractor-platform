import type { ReactNode } from 'react';

/** Shared typography role for every home section. */
export function HomeSectionHeading({ title, description, action, id }: {
  title: string; description?: string; action?: ReactNode; id?: string;
}) {
  return <div className="home-section-heading">
    <div className="home-section-heading-copy"><h2 id={id}>{title}</h2>{description && <p>{description}</p>}</div>
    {action && <div className="home-section-action">{action}</div>}
  </div>;
}
