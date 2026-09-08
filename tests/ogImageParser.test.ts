import { describe, expect, it } from 'vitest';
import { extractOgImageUrl, looksLikeFacebookLoginWall } from '../src/lib/articles/ogImageParser';

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

  // Follow-up (comment 5584109190, point 1): real Facebook /photo/
  // permalinks were reported failing with "no og:image found" in
  // Production. og:image:url is a real, documented Open Graph variant
  // Facebook sometimes emits instead of (or alongside) the plain
  // og:image tag — this must be recognized too.
  it('extracts an og:image:url tag when that is the only variant present', () => {
    const html = `<meta property="og:image:url" content="https://scontent.xx.fbcdn.net/url-variant.jpg" />`;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/url-variant.jpg');
  });

  it('prefers og:image:secure_url over a plain og:image tag when both are present, regardless of source order', () => {
    const html = `
      <meta property="og:image" content="https://scontent.xx.fbcdn.net/plain.jpg" />
      <meta property="og:image:secure_url" content="https://scontent.xx.fbcdn.net/secure.jpg" />
    `;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/secure.jpg');
  });

  it('prefers og:image:secure_url over og:image:url when all three variants are present', () => {
    const html = `
      <meta property="og:image" content="https://scontent.xx.fbcdn.net/plain.jpg" />
      <meta property="og:image:url" content="https://scontent.xx.fbcdn.net/url-variant.jpg" />
      <meta property="og:image:secure_url" content="https://scontent.xx.fbcdn.net/secure.jpg" />
    `;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/secure.jpg');
  });

  it('falls back to og:image:url when secure_url is absent but a plain og:image also exists', () => {
    const html = `
      <meta property="og:image" content="https://scontent.xx.fbcdn.net/plain.jpg" />
      <meta property="og:image:url" content="https://scontent.xx.fbcdn.net/url-variant.jpg" />
    `;
    expect(extractOgImageUrl(html)).toBe('https://scontent.xx.fbcdn.net/url-variant.jpg');
  });
});

describe('looksLikeFacebookLoginWall', () => {
  it('detects a <title>Log into Facebook</title> page', () => {
    expect(looksLikeFacebookLoginWall('<html><head><title>Log into Facebook</title></head></html>')).toBe(true);
  });

  it('detects a "Log in to Facebook" title variant', () => {
    expect(looksLikeFacebookLoginWall('<title>Log in to Facebook | Facebook</title>')).toBe(true);
  });

  it('detects an id="login_form" marker', () => {
    expect(looksLikeFacebookLoginWall('<form id="login_form" action="/login"></form>')).toBe(true);
  });

  it('detects paired login/pass input names', () => {
    expect(
      looksLikeFacebookLoginWall('<input name="login" type="text"><input name="pass" type="password">')
    ).toBe(true);
  });

  it('returns false for a normal post page with og:image present', () => {
    const html = `<head><meta property="og:image" content="https://scontent.xx.fbcdn.net/a.jpg" /><title>Some Page</title></head>`;
    expect(looksLikeFacebookLoginWall(html)).toBe(false);
  });

  it('returns false for empty input', () => {
    expect(looksLikeFacebookLoginWall('')).toBe(false);
  });
});
