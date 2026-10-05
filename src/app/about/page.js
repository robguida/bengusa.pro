import Link from 'next/link';
import PageIntro from '../components/PageIntro';
import { getPublicApps } from '@/lib/apps';

export const metadata = {
    title: 'About',
};

export default function AboutPage() {
    const apps = getPublicApps();

    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title="Hi. We're bengUSA.pro.">
                We build apps that mind their own business.
            </PageIntro>

            <section className="max-w-[40em] pb-10" aria-labelledby="story-title">
                <h2 id="story-title" className="m-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]">Our story</h2>
                <p className="m-0 text-ink-soft">Coming in a later draft.</p>
            </section>

            <section className="pb-6" aria-labelledby="making-title">
                <h2 id="making-title" className="m-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]">What we&apos;re making</h2>
                <ul className="m-0 grid list-none gap-2 p-0">
                    {apps.map((app) => (
                        <li key={app.id}>
                            <Link href={app.href} className="font-medium text-brand-navy underline underline-offset-4 hover:no-underline">
                                {app.name}
                            </Link>
                        </li>
                    ))}
                </ul>
            </section>
        </div>
    );
}
