'use client';

import type { ContactEventType } from '../lib/data/contactEvents';
import { recordContactEvent } from '../lib/data/contactEvents';

/**
 * A contact CTA that fires a best-effort contact_events insert on click
 * without blocking or delaying the actual navigation (tel:/line.me/
 * Facebook/website). `eventType` stays optional for any future contact
 * channel added without a matching event_type — a link rendered without
 * one simply isn't tracked.
 *
 * Known, accepted limitation: firing an async insert on click and then
 * letting the browser navigate away (especially to an external
 * site/app) is inherently best-effort — the request may not finish
 * before navigation. That's the same trade-off any client-side click
 * analytics beacon makes; not a bug, and not worth a synchronous
 * preventDefault-then-navigate dance for an anonymous interest counter.
 */
export function ContactLink({
  contractorId,
  eventType,
  href,
  className,
  children,
}: {
  contractorId: string;
  eventType?: ContactEventType;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={() => {
        if (eventType) {
          void recordContactEvent(contractorId, eventType);
        }
      }}
    >
      {children}
    </a>
  );
}
