import AppCard from './components/AppCard';
import DraftLabel from './components/DraftLabel';
import OffGridText from './components/OffGridText';
import { getPublicApps } from '@/lib/apps';
import siteWords from '../../content/site-words.json';

export default function Home() {
    const apps = getPublicApps();
    const { home, moreInTheWorks } = siteWords;
    // "Meet our Off-grid apps" is true only while every card in the grid wears
    // the badge, open and showcase alike. Otherwise "Meet our apps" (17.b.i).
    const everyCardOffGrid = apps.length > 0 && apps.every((app) => app.offGrid);
    const appsTitle = everyCardOffGrid ? home.appsTitle : home.appsTitleNotAllOffGrid;

    // The app grid, where every badged card shows the short Off-grid line,
    // comes directly after the hero, with nothing in between (17.a.v).
    return (
        <div className="home-top mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <section className="grid justify-items-start gap-[18px] pb-16" aria-labelledby="home-title">
                <DraftLabel />
                <h1 id="home-title" className="m-0 max-w-[14ch] text-[clamp(2.6rem,8vw,5rem)] leading-[1.02]">
                    <OffGridText text={home.heroTitle} green />
                </h1>
                {/* About 45% of the heading's size, navy (17.a.ii). */}
                <p className="m-0 -mt-1.5 font-display text-[clamp(1.2rem,3.6vw,2.25rem)] leading-[1.15] font-medium text-balance">
                    {home.heroSubline}
                </p>
            </section>

            <section id="apps" className="py-10" aria-labelledby="apps-title">
                <h2 id="apps-title" className="m-0 mb-[22px] text-[clamp(1.8rem,4.6vw,2.5rem)] leading-[1.1]">
                    <OffGridText text={appsTitle} />
                </h2>
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
        </div>
    );
}
