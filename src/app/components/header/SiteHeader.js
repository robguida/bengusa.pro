'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import { ChevronDownIcon } from '@heroicons/react/20/solid';
import LogoMark from './LogoMark';
import Wordmark from './Wordmark';
import styles from './SiteHeader.module.css';

// The tab outline at radius 100: the bottom half of a hexagon centred on the
// bar's bottom edge, with corners rounded like the logo's (0.30 convex, 0.18
// where it meets the bar). y = 0 is the bar's bottom edge. The edge path ends
// off-screen to the left; the fill closes over the bar so no seam shows.
const TAB_EDGE =
    'M210.3923,0 Q200,0 194.8038,9 L158.6603,71.6025 Q150,86.6025 132.6795,86.6025 ' +
    'L67.3205,86.6025 Q50,86.6025 41.3397,71.6025 L-12,-20.7846';
const TAB_FILL = `${TAB_EDGE} L-12,-24 L210.3923,-24 Z`;

function px(value) {
    return parseFloat(value) || 0;
}

// Reads the header's sizes from the CSS tokens in globals.css, so the numbers
// live in one place. The landing height is a clamp() of the screen width, so it
// is measured from a hidden probe instead of parsed.
function readGeometry(probe) {
    const css = getComputedStyle(document.documentElement);
    return {
        hLand: probe.getBoundingClientRect().height,
        hEnd: px(css.getPropertyValue('--hdr-h-end')),
        minBar: px(css.getPropertyValue('--hdr-min-bar')),
        barPad: px(css.getPropertyValue('--hdr-bar-pad')),
        kT: px(css.getPropertyValue('--hdr-k-t')),
    };
}

// Distance from the top of the screen to the bottom of the tab, for a logo of height h.
function tabBottom(h, g) {
    return Math.max(g.minBar, h / 2 + g.barPad) + g.kT * h;
}

// The tab's bottom edge rises exactly as fast as the page scrolls, so the
// content under it never jumps. The logo height is solved back from that edge.
function heightAtScroll(y, g) {
    const bottom = Math.max(tabBottom(g.hEnd, g), tabBottom(g.hLand, g) - y);
    const hKnee = 2 * (g.minBar - g.barPad); // below this the bar stays at its minimum height
    const h = bottom <= tabBottom(hKnee, g)
        ? (bottom - g.minBar) / g.kT
        : (bottom - g.barPad) / (0.5 + g.kT);
    return Math.min(g.hLand, Math.max(g.hEnd, h));
}

// Home only: shrink the logo on scroll down, grow it back on scroll up.
// With reduce-motion on, CSS makes the landing size equal the docked size, so
// this never changes anything.
function useShrinkOnScroll(headerRef, probeRef, enabled) {
    useEffect(() => {
        const header = headerRef.current;
        const probe = probeRef.current;
        if (!enabled || !header || !probe) return undefined;

        let geometry = readGeometry(probe);
        let applied = '';
        let frame = 0;

        const apply = () => {
            frame = 0;
            const y = Math.max(0, window.scrollY);
            const value = y > 0 && geometry.hLand > geometry.hEnd
                ? `${heightAtScroll(y, geometry).toFixed(2)}px`
                : '';
            if (value === applied) return;
            applied = value;
            if (value) header.style.setProperty('--h', value);
            else header.style.removeProperty('--h');
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(apply);
        };

        // Fires once at start, then whenever the screen size, the phone/computer
        // switch or the reduce-motion setting changes the landing height.
        const observer = new ResizeObserver(() => {
            geometry = readGeometry(probe);
            applied = null;
            schedule();
        });
        observer.observe(probe);
        window.addEventListener('scroll', schedule, { passive: true });
        apply();

        return () => {
            observer.disconnect();
            window.removeEventListener('scroll', schedule);
            window.cancelAnimationFrame(frame);
            header.style.removeProperty('--h');
        };
    }, [headerRef, probeRef, enabled]);
}

// Closes an open menu on Escape (focus goes back to its button), on a click
// outside it, and when focus moves out of it.
function useDismiss(open, close, containerRef, buttonRef) {
    useEffect(() => {
        if (!open) return undefined;
        const onKey = (event) => {
            if (event.key === 'Escape') {
                close();
                buttonRef.current?.focus();
            }
        };
        const onOutside = (event) => {
            if (!containerRef.current?.contains(event.target)) close();
        };
        document.addEventListener('keydown', onKey);
        document.addEventListener('pointerdown', onOutside);
        document.addEventListener('focusin', onOutside);
        return () => {
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('pointerdown', onOutside);
            document.removeEventListener('focusin', onOutside);
        };
    }, [open, close, containerRef, buttonRef]);
}

function current(pathname, href) {
    return pathname === href || `${pathname}/` === href ? 'page' : undefined;
}

// apps: the menu items of the shown apps ({ id, name, href }), [] while they
// are hidden. links: the plain links ({ key, href, label }), About first.
// Both come from the server (src/lib/site.js), never from this file, so a
// hidden page's link is never in the browser's code.
//
// With apps: an "Apps" menu on a computer, and a menu button on a phone.
// Without: no Apps menu and no menu button. The plain links show on a phone
// too, each with a tap area of at least 44 x 44 px. The menu button comes back
// with the apps.
export default function SiteHeader({ apps, links }) {
    const pathname = usePathname();
    const isHome = pathname === '/';
    const hasApps = apps.length > 0;
    const hasLinks = links.length > 0;

    const headerRef = useRef(null);
    const probeRef = useRef(null);
    useShrinkOnScroll(headerRef, probeRef, isHome);

    // Each menu remembers the page it was opened on, so moving to another page
    // closes it without an effect.
    const [appsOpenOn, setAppsOpenOn] = useState(null);
    const [menuOpenOn, setMenuOpenOn] = useState(null);
    const appsOpen = appsOpenOn === pathname;
    const menuOpen = menuOpenOn === pathname;
    const closeApps = useCallback(() => setAppsOpenOn(null), []);
    const closeMenu = useCallback(() => setMenuOpenOn(null), []);

    const appsItemRef = useRef(null);
    const appsButtonRef = useRef(null);
    const phoneNavRef = useRef(null);
    const menuButtonRef = useRef(null);
    useDismiss(appsOpen, closeApps, appsItemRef, appsButtonRef);
    useDismiss(menuOpen, closeMenu, phoneNavRef, menuButtonRef);

    const appsMenuId = useId();
    const phoneMenuId = useId();
    const phoneAppsId = useId();

    return (
        <header ref={headerRef} className={[styles.header, isHome && styles.big, !hasApps && styles.plain].filter(Boolean).join(' ')}>
            <div className={styles.inner}>
                <div className={styles.shape} aria-hidden="true">
                    <div className={styles.bar} />
                    <svg className={styles.tab} viewBox="0 -20 230 112" focusable="false">
                        <path className={styles.tabFill} d={TAB_FILL} />
                        <path className={styles.tabEdge} d={TAB_EDGE} vectorEffect="non-scaling-stroke" />
                    </svg>
                </div>

                <Link href="/" className={styles.brand} aria-label="bengUSA.pro home">
                    <span className={styles.mark} data-logo="mark"><LogoMark /></span>
                    <span className={styles.word} data-logo="word"><Wordmark /></span>
                </Link>

                {(hasApps || hasLinks) && <nav className={styles.desk} aria-label="Main">
                    <ul className={styles.deskList}>
                        {hasApps && (
                            <li ref={appsItemRef} className={styles.appsItem}>
                                <button
                                    ref={appsButtonRef}
                                    type="button"
                                    className={styles.deskLink}
                                    aria-expanded={appsOpen}
                                    aria-controls={appsMenuId}
                                    onClick={() => setAppsOpenOn(appsOpen ? null : pathname)}
                                >
                                    Apps
                                    <ChevronDownIcon className={styles.chevron} />
                                </button>
                                <ul id={appsMenuId} className={styles.submenu} hidden={!appsOpen}>
                                    {apps.map((app) => (
                                        <li key={app.id}>
                                            <Link
                                                href={app.href}
                                                className={styles.menuLink}
                                                aria-current={current(pathname, app.href)}
                                                onClick={closeApps}
                                            >
                                                {app.name}
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        )}
                        {links.map((link) => (
                            <li key={link.key}>
                                <Link href={link.href} className={styles.deskLink} aria-current={current(pathname, link.href)}>
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>}

                {hasApps && (
                    <nav ref={phoneNavRef} className={styles.phone} aria-label="Main">
                        <button
                            ref={menuButtonRef}
                            type="button"
                            className={styles.menuButton}
                            aria-expanded={menuOpen}
                            aria-controls={phoneMenuId}
                            onClick={() => setMenuOpenOn(menuOpen ? null : pathname)}
                        >
                            {menuOpen
                                ? <XMarkIcon className={styles.menuIcon} />
                                : <Bars3Icon className={styles.menuIcon} />}
                            <span className="sr-only">{menuOpen ? 'Close menu' : 'Menu'}</span>
                        </button>
                        <div id={phoneMenuId} className={styles.menuPanel} hidden={!menuOpen}>
                            <p id={phoneAppsId} className={styles.menuGroup}>Apps</p>
                            <ul className={styles.menuList} aria-labelledby={phoneAppsId}>
                                {apps.map((app) => (
                                    <li key={app.id}>
                                        <Link
                                            href={app.href}
                                            className={styles.menuLink}
                                            aria-current={current(pathname, app.href)}
                                            onClick={closeMenu}
                                        >
                                            {app.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                            <ul className={styles.menuList}>
                                {links.map((link) => (
                                    <li key={link.key}>
                                        <Link href={link.href} className={styles.menuLink} aria-current={current(pathname, link.href)} onClick={closeMenu}>
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </nav>
                )}

                <span ref={probeRef} className={styles.probe} aria-hidden="true" />
            </div>
        </header>
    );
}
