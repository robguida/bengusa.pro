import AppCard from './components/AppCard';
import DraftLabel from './components/DraftLabel';
import { getPublicApps } from '@/lib/apps';
import siteWords from '../../content/site-words.json';

// "A", "A and B", "A, B and C" ...
function listOf(names) {
    if (names.length < 2) return names.join('');
    return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}

export default function Home() {
    const apps = getPublicApps();
    const { heading, text } = siteWords.moreInTheWorks;

    return (
        <div className="home-top mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <section className="grid justify-items-start gap-[18px] pb-16" aria-labelledby="home-title">
                <DraftLabel />
                <h1 id="home-title" className="m-0 max-w-[14ch] text-[clamp(2.6rem,8vw,5rem)] leading-[1.02]">
                    Apps that mind their own business.
                </h1>
                <p className="m-0 max-w-[34em] text-[clamp(1.05rem,2.4vw,1.25rem)] text-ink-soft">
                    {listOf(apps.map((app) => app.name))} {apps.length === 1 ? 'is' : 'are'} in the works.
                </p>
            </section>

            <section id="apps" className="py-10" aria-labelledby="apps-title">
                <h2 id="apps-title" className="m-0 mb-[22px] text-[clamp(1.8rem,4.6vw,2.5rem)] leading-[1.1]">
                    Meet the apps
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
                            <h3 className="m-0 text-[1.7rem] leading-[1.1]">{heading}</h3>
                            <p className="m-0 text-ink-soft">{text}</p>
                        </div>
                    </li>
                </ul>
            </section>
        </div>
    );
}
