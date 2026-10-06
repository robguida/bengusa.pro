'use client';

import Link from 'next/link';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import styles from './OffGridTip.module.css';

// The Off-grid popup ("toggletip", spec 17.c). The trigger is a real button:
// the green badge, or the word "Off-grid" in a heading. The box repeats the
// approved words. It is an extra: the visible short line or legend always
// stays on the page as well.
//
// Three parts, so the box never has to sit inside a heading:
//   - OffGridTipRoot owns the state and renders the box right after its
//     children (a heading on Home, or just the badge's button);
//   - OffGridTrigger is the button, anywhere inside its root;
//   - OffGridTip (the default export) is a badge's trigger with its box.
// A heading's text is then only its own words (OffGridHeading.js).
//
// Before this script runs, the browser's own popover switch (popovertarget)
// opens and closes the box on tap or click, and Esc or a click outside closes
// it. It finds the box by its ID, so the box can sit after the heading. Once
// the script runs it takes over:
//   - opens on mouse hover (after 150 ms), on keyboard focus, and on tap/click;
//   - closes on Esc (focus stays on, or goes back to, the trigger), a tap or
//     click outside, focus moving away, a second tap, and the mouse leaving
//     both the trigger and the box (300 ms grace to move into the box);
//   - one box open at a time, page-wide.
// The box sits in the top layer, so the page never moves. Its place is set
// through CSSOM (--tip-x, --tip-y), never an inline style attribute.
//
// Test hooks: data-offgrid="trigger" / "tip". data-state="open" | "closed"
// appears on both once the script has taken over (it is absent before that,
// and with scripts off).

const OPEN_DELAY_MS = 150;
const CLOSE_GRACE_MS = 300;
const EDGE_PX = 16; // kept clear of the screen edge
const GAP_PX = 8; // between the trigger and the box
const OPEN_EVENT = 'offgrid-tip-open'; // tells any other open box to close

// Each root adds its trigger's state under its own key, on top of any root
// around it, so a heading with more than one "Off-grid" word still works.
const TipContext = createContext({});

// 'server' = the first frame (server HTML, and hydration); then 'popover', or
// 'fallback' in a browser without popovers (plain show/hide).
const noSubscribe = () => () => {};
const clientMode = () => (typeof HTMLElement.prototype.showPopover === 'function' ? 'popover' : 'fallback');
const serverMode = () => 'server';

function isShowing(el) {
    try {
        return el.matches(':popover-open');
    } catch {
        return false;
    }
}

function byKeyboard(el) {
    try {
        return el.matches(':focus-visible');
    } catch {
        return true;
    }
}

// Below the trigger, flipped above when there is no room, and kept 16 px
// inside the screen. Returns false when the trigger is off the screen.
function place(button, tip) {
    const r = button.getBoundingClientRect();
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return false;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.max(EDGE_PX, Math.min(r.left, vw - EDGE_PX - w));
    let top = r.bottom + GAP_PX;
    if (top + h > vh - EDGE_PX && r.top - GAP_PX - h >= EDGE_PX) top = r.top - GAP_PX - h;
    tip.style.setProperty('--tip-x', `${left.toFixed(1)}px`);
    tip.style.setProperty('--tip-y', `${top.toFixed(1)}px`);
    return true;
}

function HexIcon() {
    return (
        <svg viewBox="0 0 16 16" className={styles.icon} aria-hidden="true" focusable="false">
            <path d="M4.5 1.8h7L15 8l-3.5 6.2h-7L1 8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
    );
}

// Owns one popup: its state, and its box, which comes right after children.
// tipKey: names this popup for its OffGridTrigger. lead + text: the box's
// words ("Off-grid:" in bold, then the rest). link: { href, label } or null.
export function OffGridTipRoot({ tipKey, lead, text, link = null, children }) {
    const parent = useContext(TipContext);
    const buttonId = useId();
    const tipId = useId();
    const buttonRef = useRef(null);
    const tipRef = useRef(null);
    const mode = useSyncExternalStore(noSubscribe, clientMode, serverMode);
    const live = mode !== 'server';
    const [open, setOpen] = useState(false);

    // Mutable state the handlers share. Never read during render.
    const openRef = useRef(false);
    const pinnedRef = useRef(false); // opened by a tap/click: hover-out doesn't close it
    const quietFocusRef = useRef(false); // focus moved back by Esc: don't reopen
    const timersRef = useRef({ hover: 0, leave: 0 });
    const wasOpenRef = useRef(false);

    const clearTimers = useCallback(() => {
        clearTimeout(timersRef.current.hover);
        clearTimeout(timersRef.current.leave);
    }, []);

    const hide = useCallback(() => {
        clearTimers();
        if (!openRef.current) return;
        openRef.current = false;
        pinnedRef.current = false;
        const tip = tipRef.current;
        if (tip && isShowing(tip)) {
            try {
                tip.hidePopover();
            } catch {
                // already hidden
            }
        }
        setOpen(false);
    }, [clearTimers]);

    const show = useCallback((pin) => {
        clearTimers();
        if (openRef.current) {
            if (pin) pinnedRef.current = true;
            return;
        }
        const button = buttonRef.current;
        const tip = tipRef.current;
        if (!button || !tip) return;
        document.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: tip }));
        openRef.current = true;
        pinnedRef.current = Boolean(pin);
        if (typeof tip.showPopover === 'function') {
            try {
                tip.showPopover();
            } catch {
                // already showing
            }
            place(button, tip);
        }
        setOpen(true);
    }, [clearTimers]);

    // A tap before the script took over may have opened the box. Switching
    // the popover to script control hides it, so open it again (pinned).
    useLayoutEffect(() => {
        if (!live && tipRef.current) wasOpenRef.current = isShowing(tipRef.current);
    }, [live]);
    useEffect(() => {
        if (!live || !wasOpenRef.current) return undefined;
        wasOpenRef.current = false;
        const frame = requestAnimationFrame(() => show(true));
        return () => cancelAnimationFrame(frame);
    }, [live, show]);

    // The browser can close a popover on its own (for example a modal opening).
    useEffect(() => {
        const tip = tipRef.current;
        if (!live || !tip) return undefined;
        const onToggle = (event) => {
            if (event.newState === 'closed' && openRef.current) {
                openRef.current = false;
                pinnedRef.current = false;
                setOpen(false);
            }
        };
        tip.addEventListener('toggle', onToggle);
        return () => tip.removeEventListener('toggle', onToggle);
    }, [live]);

    useEffect(() => clearTimers, [clearTimers]);

    // Place it once the page shows it (browsers without popovers show it here).
    useLayoutEffect(() => {
        if (open && buttonRef.current && tipRef.current) place(buttonRef.current, tipRef.current);
    }, [open]);

    // While open: close on a click outside, Esc, or another box opening; follow
    // the trigger on scroll and resize, and close if it leaves the screen.
    useEffect(() => {
        if (!open) return undefined;
        const button = buttonRef.current;
        const tip = tipRef.current;
        let frame = 0;
        const onDown = (event) => {
            if (button?.contains(event.target) || tip?.contains(event.target)) return;
            hide();
        };
        const onKey = (event) => {
            if (event.key !== 'Escape') return;
            const focusInTip = tip?.contains(document.activeElement);
            hide();
            if (focusInTip) {
                quietFocusRef.current = true;
                button?.focus();
                quietFocusRef.current = false;
            }
        };
        const onOther = (event) => {
            if (event.detail !== tip) hide();
        };
        const onMove = () => {
            if (frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                if (button && tip && !place(button, tip)) hide();
            });
        };
        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('keydown', onKey);
        document.addEventListener(OPEN_EVENT, onOther);
        window.addEventListener('scroll', onMove, { passive: true, capture: true });
        window.addEventListener('resize', onMove);
        return () => {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener(OPEN_EVENT, onOther);
            window.removeEventListener('scroll', onMove, { capture: true });
            window.removeEventListener('resize', onMove);
            cancelAnimationFrame(frame);
        };
    }, [open, hide]);

    const onPointerEnter = (event) => {
        if (!live || event.pointerType !== 'mouse') return;
        clearTimeout(timersRef.current.leave);
        if (openRef.current) return;
        clearTimeout(timersRef.current.hover);
        timersRef.current.hover = setTimeout(() => show(false), OPEN_DELAY_MS);
    };

    const onPointerLeave = (event) => {
        if (!live || event.pointerType !== 'mouse') return;
        clearTimeout(timersRef.current.hover);
        if (!openRef.current || pinnedRef.current) return;
        const button = buttonRef.current;
        if (document.activeElement === button && byKeyboard(button)) return;
        clearTimeout(timersRef.current.leave);
        timersRef.current.leave = setTimeout(hide, CLOSE_GRACE_MS);
    };

    const onTipPointerEnter = (event) => {
        if (event.pointerType === 'mouse') clearTimeout(timersRef.current.leave);
    };

    const onFocus = () => {
        if (live && !quietFocusRef.current && byKeyboard(buttonRef.current)) show(false);
    };

    const onBlur = (event) => {
        if (!live) return;
        const to = event.relatedTarget;
        if (to && (to === buttonRef.current || tipRef.current?.contains(to))) return;
        hide();
    };

    const onClick = (event) => {
        if (!live) return; // the browser's own popover switch handles it
        event.preventDefault();
        clearTimeout(timersRef.current.hover);
        if (!openRef.current) {
            show(true);
        } else if (pinnedRef.current || event.detail === 0) {
            hide(); // a second tap, or Enter / Space
        } else {
            pinnedRef.current = true; // a click on a box opened by hover keeps it open
        }
    };

    const state = live ? (open ? 'open' : 'closed') : undefined;
    // The trigger gets a callback that stores its button, not the ref itself.
    const attachButton = useCallback((el) => {
        buttonRef.current = el;
    }, []);
    const trigger = {
        attachButton, buttonId, tipId, live, open, state, onClick, onPointerEnter, onPointerLeave, onFocus, onBlur,
    };

    return (
        <TipContext.Provider value={{ ...parent, [tipKey]: trigger }}>
            {children}
            <span
                ref={tipRef}
                id={tipId}
                popover={live ? 'manual' : 'auto'}
                role="note"
                aria-labelledby={buttonId}
                tabIndex={-1}
                className={styles.tip}
                data-offgrid="tip"
                data-state={state}
                data-fallback={mode === 'fallback' ? '' : undefined}
                onPointerEnter={onTipPointerEnter}
                onPointerLeave={onPointerLeave}
                onBlur={onBlur}
            >
                <b>{lead}</b> {text}
                {link && (
                    <Link href={link.href} className={styles.more} onClick={hide}>
                        {link.label}
                    </Link>
                )}
            </span>
        </TipContext.Provider>
    );
}

// The button that opens the popup named tipKey. It must sit inside that
// OffGridTipRoot. kind: 'badge' (the green pill) or 'word' (the word in a
// heading; green sets the hero's green word).
export function OffGridTrigger({ tipKey, kind = 'badge', green = false, word }) {
    const shared = useContext(TipContext)[tipKey];
    if (!shared) throw new Error(`OffGridTrigger "${tipKey}" is not inside its OffGridTipRoot.`);
    const {
        attachButton, buttonId, tipId, live, open, state, onClick, onPointerEnter, onPointerLeave, onFocus, onBlur,
    } = shared;
    const className = kind === 'badge'
        ? `${styles.trigger} ${styles.badge}`
        : `${styles.trigger} ${styles.word}${green ? ` ${styles.green}` : ''}`;
    return (
        <button
            ref={attachButton}
            id={buttonId}
            type="button"
            className={className}
            popoverTarget={live ? undefined : tipId}
            aria-controls={tipId}
            aria-expanded={live ? open : undefined}
            data-offgrid="trigger"
            data-state={state}
            onClick={onClick}
            onPointerEnter={onPointerEnter}
            onPointerLeave={onPointerLeave}
            onFocus={onFocus}
            onBlur={onBlur}
        >
            {kind === 'badge' && <HexIcon />}
            {word}
        </button>
    );
}

// A trigger with its box right after it: the badge (OffGridBadge.js).
export default function OffGridTip({ kind = 'badge', green = false, word, lead, text, link = null }) {
    return (
        <OffGridTipRoot tipKey="tip" lead={lead} text={text} link={link}>
            <OffGridTrigger tipKey="tip" kind={kind} green={green} word={word} />
        </OffGridTipRoot>
    );
}
