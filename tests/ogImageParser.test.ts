import { describe, expect, it } from 'vitest';
import { extractOgImageUrl } from '../src/lib/articles/ogImageParser';

describe('extractOgImageUrl', () => {
  it('extracts a property-then-content og:image tag', () => {
    const html = `<head><meta property="og:image" content="https://scontent.xx.fbcdn.net/a.jpg" /></head>`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/a.jpg');
  });

  it('extracts a content-then-property og:image tag', () => {
    const html = `<meta content="https://scontent.xx.fbcdn.net/b.jpg" property="og:image" />`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/b.jpg');
  });

  it('works with single quotes', () => {
    const html = `<meta property='og:image' content='https://scontent.xx.fbcdn.net/c.jpg'>`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/c.jpg');
  });

  it('prefers og:image:secure_url when that is the only tag present', () => {
    const html = `<meta property="og:image:secure_url" content="https://scontent.xx.fbcdn.net/secure.jpg" />`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/secure.jpg');
  });

  it('decodes &amp; in the URL', () => {
    const html = `<meta property="og:image" content="https://scontent.xx.fbcdn.net/d.jpg?a=1&amp;b=2" />`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/d.jpg?a=1&b=2');
  });

  it('finds the tag among lots of other unrelated meta tags', () => {
    const html = `
      <html><head>
        <meta charset="utf-8">
        <meta property="og:title" content="Some post title" />
        <meta property="og:type" content="article" />
        <meta property="og:image" content="https://scontent.xx.fbcdn.net/real.jpg" />
        <meta property="og:description" content="..." />
      </head></html>
    `;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/real.jpg');
  });

  it('returns null when no og:image tag is present', () => {
    const html = `<head><title>No image here</title></head>`;
    expect(extractOgImageUrl(html)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(extractOgImageUrl('')).toBeNull();
  });

  it('returns null for a malformed/incomplete meta tag (no closing >)', () => {
    const html = `<meta property="og:image" content="https://example.com/a.jpg"`; // no closing >
    expect(extractOgImageUrl(html)).toBeNull();
  });

  it('is case-insensitive on the meta/property/content markup itself', () => {
    const html = `<META PROPERTY="og:image" CONTENT="https://scontent.xx.fbcdn.net/upper.jpg" />`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/upper.jpg');
  });
});
