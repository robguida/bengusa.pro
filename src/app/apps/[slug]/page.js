import { notFound } from 'next/navigation';
import DraftLabel from '../../components/DraftLabel';
import OffGridBadge from '../../components/OffGridBadge';
import { getPublicApp, getPublicApps } from '@/lib/apps';
import siteWords from '../../../../content/site-words.json';

// One template for every app page, built from the app list. Pages exist only
// under /apps/<slug>/, and only for the slugs in the list.
export const dynamicParams = false;

export function generateStaticParams() {
    return getPublicApps().map((app) => ({ slug: app.slug }));
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const app = getPublicApp(slug);
    return { title: app ? app.name : 'Page not found' };
}

export default async function AppPage({ params }) {
    const { slug } = await params;
    const app = getPublicApp(slug);
    if (!app) notFound();

    const { offGrid } = siteWords;

    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <div className="grid justify-items-start gap-[18px] pb-10">
                <DraftLabel />
                <p className="m-0 text-[13px] font-medium tracking-[0.12em] text-ink-soft uppercase">{app.name}</p>
                <h1 className="m-0 max-w-[18ch] text-[clamp(2.4rem,7vw,4rem)] leading-[1.04]">{app.tagline}</h1>
                <p className="m-0 max-w-[34em] text-[clamp(1.05rem,2.4vw,1.25rem)] text-ink-soft">{app.intro}</p>
                {app.offGrid && (
                    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-2">
                        <OffGridBadge />
                        <span>
                            <b className="font-semibold">{offGrid.badge}:</b> {offGrid.short}
                        </span>
                    </p>
                )}
            </div>

            {app.offGrid && app.connects && (
                <section className="max-w-[44em] pb-10" aria-labelledby="off-grid-title">
                    <h2 id="off-grid-title" className="m-0 mb-4 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]">
                        Off-grid, explained
                    </h2>
                    {/* The connects box sits directly below the legend, with nothing between them. */}
                    <p className="m-0 flex flex-wrap items-start gap-3">
                        <OffGridBadge />
                        <span className="min-w-0 flex-1 basis-64">
                            <b className="font-semibold">{offGrid.badge}:</b> {offGrid.legendOnAppPage}
                        </span>
                    </p>
                    <div className="mt-3 rounded-xl border border-line bg-white p-5">
                        <p className="m-0">
                            <b className="font-semibold">{app.connects.label}</b> {app.connects.text}
                        </p>
                    </div>
                </section>
            )}

            {app.cloud && (
                <section className="max-w-[44em] pb-10" aria-labelledby="cloud-title">
                    <h2 id="cloud-title" className="m-0 mb-4 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]">
                        {app.cloud.heading}
                    </h2>
                    <p className="m-0">{app.cloud.text}</p>
                </section>
            )}
        </div>
    );
}
