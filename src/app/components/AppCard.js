import Link from 'next/link';
import AppName from './AppName';
import OffGridBadge from './OffGridBadge';
import siteWords from '../../../content/site-words.json';

// One card in the Home grid. Everything on it comes from the app list.
export default function AppCard({ app }) {
    return (
        <article className="flex w-full min-w-0 flex-col gap-3 rounded-xl border border-line bg-white px-[22px] pt-[22px] pb-5">
            <h3 className="m-0 text-[1.7rem] leading-[1.1]">
                <AppName app={app} />
            </h3>
            <div className="flex min-h-7 items-center">
                {app.offGrid && <OffGridBadge />}
            </div>
            <p className="m-0 font-medium">{app.tagline}</p>
            <p className="m-0">{app.summary}</p>
            <p className="m-0 mt-auto border-t border-line pt-3 text-sm leading-[1.55] text-ink-soft">
                {app.offGrid ? (
                    <>
                        <b className="font-semibold text-brand-navy">Off-grid:</b> {siteWords.offGrid.short}
                    </>
                ) : (
                    app.cardNote
                )}
            </p>
            <Link href={app.href} className="self-start font-medium text-brand-navy underline underline-offset-4 hover:no-underline">
                See {app.shortName}
            </Link>
        </article>
    );
}
