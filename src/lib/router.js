import { useEffect, useRef, useState } from 'react';

// A deliberately tiny router — no react-router.
//
// Every screen used to live in a plain `useState` string, which meant the
// browser/phone Back button had no in-app history to walk: it left the site
// entirely (and took any half-written thread with it). This keeps the same
// "one string per screen" model the components already use, but mirrors it
// into the history stack and the URL. Back now moves between screens, a
// thread link can be shared, and a refresh keeps you where you were.
//
// Only two components read it: App (which screens it renders) and MainBoard
// (landing/board/thread/create). Both just read `useRoute()` and call
// `navigate()` — exactly where they used to call a setter.

// view -> URL path. 'thread' and 'messages' get an id appended.
const PATHS = {
  landing: '/',
  board: '/board',
  create: '/new',
  thread: '/thread',
  signup: '/signup',
  login: '/login',
  'reset-password': '/reset-password',
  admin: '/admin',
  messages: '/messages',
  welcome: '/welcome',
};

function routeToPath({ view, id }) {
  const base = PATHS[view] || '/';
  return id ? `${base}/${encodeURIComponent(id)}` : base;
}

function pathToRoute(pathname) {
  const parts = pathname.split('/').filter(Boolean);
  if (!parts.length) return { view: 'landing', id: null };
  const view = Object.keys(PATHS).find((v) => PATHS[v] === `/${parts[0]}`);
  if (!view) return { view: 'landing', id: null };
  return { view, id: parts[1] ? decodeURIComponent(parts[1]) : null };
}

let current = pathToRoute(window.location.pathname);
const listeners = new Set();

// How many entries this app has pushed on top of whatever the resident was
// looking at before. It rides along in history state so it survives a reload,
// and it lets the in-app Back buttons pop the stack (keeping them in step with
// the browser's own Back) while still having somewhere to go for someone who
// arrived straight on this screen from a shared link.
let depth = window.history.state?.depth || 0;

// Set while a modal/lightbox is open, so a Back press closes that instead of
// navigating away from the screen underneath it (see useBackToClose).
let overlayCloser = null;

function emit() {
  listeners.forEach((notify) => notify(current));
}

function entry() {
  return { route: current, depth };
}

export function navigate(view, id = null) {
  current = { view, id: id || null };
  depth += 1;
  window.history.pushState(entry(), '', routeToPath(current));
  emit();
}

// Same as navigate but without adding a history entry — for redirects the
// resident never chose, e.g. a signed-in member being sent past the landing
// screen. Back shouldn't return them to a screen they never saw.
export function replaceRoute(view, id = null) {
  current = { view, id: id || null };
  window.history.replaceState(entry(), '', routeToPath(current));
  emit();
}

// Set the route without touching the URL at all. Used for the email-link
// landings: the URL hash still holds the session that supabase-js reads
// asynchronously on startup, so it must be left alone.
export function seedRoute(view, id = null) {
  current = { view, id: id || null };
  window.history.replaceState(entry(), '', window.location.href);
}

// For the app's own "Back" links. Popping is what the resident means by back,
// so Back-to-board and the browser's Back button agree instead of each leaving
// a trail the other has to walk through.
export function goBack(fallbackView = 'board') {
  if (depth > 0) window.history.back();
  else navigate(fallbackView);
}

window.addEventListener('popstate', (event) => {
  if (overlayCloser) {
    // Spend this Back press on closing the overlay, then put the entry the
    // browser just popped back on the stack so the resident's position in the
    // app is unchanged.
    const close = overlayCloser;
    overlayCloser = null;
    close();
    window.history.pushState(entry(), '', routeToPath(current));
    return;
  }
  // Fall back to the URL: supabase-js rewrites history state of its own when
  // it strips an auth hash, which drops our route object.
  current = event.state?.route || pathToRoute(window.location.pathname);
  depth = event.state?.depth || 0;
  emit();
});

// Record the route we started on, so Back onto the first entry restores it.
window.history.replaceState(entry(), '', window.location.href);

export function useRoute() {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    listeners.add(setRoute);
    setRoute(current); // in case it moved between render and this effect
    return () => listeners.delete(setRoute);
  }, []);
  return route;
}

// Pass the function that closes the topmost open overlay, or null when none is
// open. While one is open, Back closes it rather than leaving the screen.
export function useBackToClose(onClose) {
  const isOpen = !!onClose;
  const latest = useRef(onClose);
  latest.current = onClose;

  useEffect(() => {
    if (!isOpen) return;
    overlayCloser = () => latest.current?.();
    return () => { overlayCloser = null; };
  }, [isOpen]);
}
