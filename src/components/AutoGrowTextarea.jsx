import { useLayoutEffect, useRef } from 'react';

// One textarea for every multi-line box on the site, so they all behave the same:
//   - opens 6 lines tall (or taller, to fit existing text, up to the max)
//   - grows as you type, up to 20 lines, then scrolls inside
//   - never shrinks below 4 lines
//   - a drag handle (resize: vertical) lets people size it by hand
//   - on a phone-width screen the max is capped to 45% of the screen height so
//     the Save / Reply buttons under it stay visible
// Pass any normal textarea props; `rows` is ignored because height is managed here.

const DEFAULT_LINES = 6;
const MIN_LINES = 4;
const MAX_LINES = 20;
const PHONE_WIDTH = 640;
// Room to keep under the box on a phone for the Save / Reply row and its spacing.
const PHONE_BUTTON_ROOM_PX = 150;

function lineHeightPx(el) {
  const style = window.getComputedStyle(el);
  const lh = parseFloat(style.lineHeight);
  return Number.isFinite(lh) ? lh : parseFloat(style.fontSize) * 1.5;
}

// Largest height the box may grow to. On a phone the box can't grow past the
// bottom of the screen minus room for its buttons, so they stay visible.
function maxHeightPx(el, lh) {
  const lines = MAX_LINES * lh;
  if (window.innerWidth < PHONE_WIDTH) {
    const top = el.getBoundingClientRect().top;
    const room = window.innerHeight - top - PHONE_BUTTON_ROOM_PX;
    return Math.max(MIN_LINES * lh, Math.min(lines, room));
  }
  return lines;
}

export default function AutoGrowTextarea({ value, className = '', rows: _rows, ...rest }) {
  const ref = useRef(null);

  // Fit the box to its content, never shorter than the 6-line default and never
  // taller than the max. Runs on every value change; a box the user has already
  // dragged taller is only ever grown further, so their size sticks until the
  // text needs more room.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const lh = lineHeightPx(el);
    const minPx = MIN_LINES * lh;
    const defaultPx = DEFAULT_LINES * lh;
    const maxPx = maxHeightPx(el, lh);

    // Read the box as it is now (including any size the user dragged to),
    // before measuring the content.
    const current = el.offsetHeight;
    // Borders are part of offsetHeight but not scrollHeight.
    const chrome = el.offsetHeight - el.clientHeight;
    el.style.height = 'auto';
    const needed = el.scrollHeight + chrome;

    let target;
    if (!el.dataset.sized) {
      // First time on screen: 6 lines, or taller to fit existing text (editing).
      target = Math.max(defaultPx, needed);
      el.dataset.sized = '1';
    } else {
      // Afterwards: grow to fit, keep any size the user dragged to.
      target = Math.max(current, needed);
    }
    el.style.height = `${Math.min(maxPx, Math.max(minPx, target))}px`;
  }, [value]);

  return (
    <textarea
      ref={ref}
      value={value}
      className={`resize-y overflow-y-auto ${className}`}
      style={{ resize: 'vertical' }}
      {...rest}
    />
  );
}
