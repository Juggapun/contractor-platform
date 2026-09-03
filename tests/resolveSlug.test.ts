import { describe, expect, it } from 'vitest';
import { resolveSlug } from '../src/lib/contractors/resolveSlug';

describe('resolveSlug', () => {
  it('decodes a percent-encoded Thai slug (the exact reported bug)', () => {
    // The actual slug reported in Issue #18's follow-up ("บริษัทการช่าง"),
    // percent-encoded the way ContractorCard.tsx's search-result link
    // (encodeURIComponent(contractor.slug)) and a real browser navigation
    // deliver it to the page's dynamic route segment.
    const rawSlug = encodeURIComponent('บริษัทการช่าง');
    expect(resolveSlug(rawSlug)).toBe('บริษัทการช่าง');
  });

  it('is idempotent on an already-decoded Thai slug', () => {
    // generateMetadata() and the page component were found to receive
    // the same params.slug in different states for the same request --
    // resolveSlug() must produce the correct value either way.
    expect(resolveSlug('บริษัทการช่าง')).toBe('บริษัทการช่าง');
  });

  it('leaves a plain ASCII slug unchanged', () => {
    expect(resolveSlug('chang-fai-somchai')).toBe('chang-fai-somchai');
  });

  it('falls back to the raw value on malformed percent-encoding instead of throwing', () => {
    expect(resolveSlug('%E0%')).toBe('%E0%');
  });
});
