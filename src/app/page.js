import AppCard from './components/AppCard';
import KeepWhole from './components/KeepWhole';
import OffGridHeading from './components/OffGridHeading';
import OffGridLegend from './components/OffGridLegend';
import { getShownApps } from '@/lib/apps';
import { SHOW_US_DEBT_PROMO } from '@/lib/site';
import siteWords from '../content/site-words.json';

export default function Home() {
    // None while content/site-settings.json hides the apps. Then the whole apps
    // section (its heading, the cards and "More in the works") is left out, and
    // the hero is followed directly by "Off-grid, explained".
    const apps = getShownApps();
    const { home, moreInTheWorks, offGrid, usDebtPromo } = siteWords;
    // One-page site (2026-11-02): "Off-grid, explained" is hidden while
    // "showOffGridExplained" in content/site-words.json is false (its words stay).
    const showExplained = siteWords.showOffGridExplained === true;
    // "Meet our Off-grid apps" is true only while every card in the grid wears
    // the badge, open and showcase alike. Otherwise "Meet our apps" (17.b.i).
    const everyCardOffGrid = apps.length > 0 && apps.every((app) => app.offGrid);
    const appsTitle = everyCardOffGrid ? home.appsTitle : home.appsTitleNotAllOffGrid;

    // The Off-grid definition comes directly after the hero, with nothing in
    // between (17.a.v): here the Home legend in its own section (13.a.ii),
    // then the app grid, where every badged card shows the short Off-grid
    // line. The legend is never inside the hero: "Cloud-killers" never
    // appears in the hero (13.d.i).
    return (
        <div className="home-top mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <section className="grid justify-items-start gap-[18px] pb-16" aria-labelledby="home-title">
                {/* The popup box for "Off-grid" sits right after the heading (OffGridHeading). */}
                <OffGridHeading
                    as="h1"
                    id="home-title"
                    className="m-0 max-w-[14ch] text-[clamp(2.6rem,8vw,5rem)] leading-[1.02]"
                    text={home.heroTitle}
                    green
                />
                {/* About 45% of the heading's size, navy (17.a.ii). */}
                <p className="m-0 -mt-1.5 font-display text-[clamp(1.2rem,3.6vw,2.25rem)] leading-[1.15] font-medium text-balance">
                    {home.heroSubline}
                </p>
            </section>

            {/* The same look as the "Off-grid, explained" section on the app pages. The
                badge's popup has no link: this legend names no single app (17.c.iv). No
                connects box here: each app's page has its own. */}
            {showExplained && (
            <section className="max-w-[44em] pb-6" aria-labelledby="home-off-grid-title">
                <h2 id="home-off-grid-title" className="m-0 mb-4 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]">
                    <KeepWhole text={offGrid.explainedHeading} />
                </h2>
                <OffGridLegend text={offGrid.legendOnHome} />
            </section>
            )}

            {/* Stands in for the apps section while the apps are hidden. */}
            {apps.length === 0 && (
                <section className="pb-10" aria-labelledby="home-coming-soon-title">
                    <h2 id="home-coming-soon-title" className="m-0 text-[clamp(1.8rem,4.6vw,2.5rem)] leading-[1.1]">{home.appsComingSoon}</h2>
                    {/* BUWEB-128: a tool to try while the apps are not out. A green button (the logo green) that opens in a new tab
                        (the words are in content/site-words.json, "usDebtPromo"). It sits under
                        the section heading (BUWEB-133). Off with "showUsDebtPromo": false in
                        content/site-settings.json. */}
                    {SHOW_US_DEBT_PROMO && (
                        <div className="mt-5 grid max-w-[64rem] items-center gap-6 md:grid-cols-2 md:gap-10">
                            <div className="grid max-w-[40em] justify-items-start gap-3">
                                <p className="m-0 text-[clamp(1.05rem,2.4vw,1.25rem)] text-ink-soft">{usDebtPromo.leadIn}</p>
                                <h3 className="m-0 text-[clamp(1.4rem,3.4vw,1.75rem)] leading-[1.1]">{usDebtPromo.title}</h3>
                                <p className="m-0">{usDebtPromo.text}</p>
                                <a href={usDebtPromo.url} target="_blank" rel="noopener" className="inline-block rounded-lg bg-brand-green px-5 py-3 font-medium text-white no-underline transition-colors hover:bg-brand-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">
                                    {usDebtPromo.linkText}
                                    <span className="sr-only">{usDebtPromo.newTabHint}</span>
                                </a>
                            </div>
                            {/* BUWEB-134: a picture of the tool, linked to it. A plain <img>, not next/image
                                (next/image adds an inline style, which the security policy forbids). */}
                            <a href={usDebtPromo.url} target="_blank" rel="noopener" className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-navy">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={usDebtPromo.image.src}
                                    alt={usDebtPromo.image.alt}
                                    width={usDebtPromo.image.width}
                                    height={usDebtPromo.image.height}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-auto w-full rounded-xl border border-line shadow-sm"
                                />
                            </a>
                        </div>
                    )}
                </section>
            )}

            {apps.length > 0 && (
                <section id="apps" className="py-10" aria-labelledby="apps-title">
                    <OffGridHeading
                        as="h2"
                        id="apps-title"
                        className="m-0 mb-[22px] text-[clamp(1.8rem,4.6vw,2.5rem)] leading-[1.1]"
                        text={appsTitle}
                    />
                    <ul className="m-0 grid list-none grid-cols-1 gap-5 p-0 md:grid-cols-2 lg:grid-cols-3">
                        {apps.map((app) => (
                            <li key={app.id} className="flex">
                                <AppCard app={app} />
                            </li>
                        ))}
                        <li className="flex">
                            {/* Placeholder: its link to the signup's news box comes with the signup form. */}
                            <div className="flex w-full flex-col gap-3 rounded-xl border-[1.5px] border-dashed border-ink-soft px-[22px] pt-[22px] pb-5">
                                <h3 className="m-0 text-[1.7rem] leading-[1.1]">{moreInTheWorks.heading}</h3>
                                <p className="m-0 text-ink-soft">{moreInTheWorks.text}</p>
                            </div>
                        </li>
                    </ul>
                </section>
            )}
        </div>
    );
}
