import Image from 'next/image';
import Link from 'next/link';
import PageIntro from '../components/PageIntro';
import { getPublicApps } from '@/lib/apps';
import words from '../../../content/about-words.json';

export const metadata = {
    title: 'About',
};

const HEADING_CLASS = 'm-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]';

// The level of the page's section headings is a setting in the words file
// (2 = h2). A person's name sits one level below.
function Heading({ offset = 0, children, ...props }) {
    const Tag = `h${Math.min(6, Math.max(2, words.headingLevel ?? 2) + offset)}`;
    return <Tag {...props}>{children}</Tag>;
}

export default function AboutPage() {
    const apps = getPublicApps();
    const { top, story, people, making, contact } = words;

    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title={top.title}>{top.line}</PageIntro>

            <section className="max-w-[40em] pb-10" aria-labelledby={`${story.id}-title`}>
                <Heading id={`${story.id}-title`} className={HEADING_CLASS}>{story.heading}</Heading>
                <p className="m-0 text-ink-soft">{story.text}</p>
            </section>

            <section className="pb-10" aria-labelledby={`${people.id}-title`}>
                <Heading id={`${people.id}-title`} className={HEADING_CLASS}>{people.heading}</Heading>
                <ul className="m-0 grid list-none gap-10 p-0 md:grid-cols-2 md:gap-12">
                    {people.list.map((person) => (
                        <li key={person.id} className="min-w-0">
                            <Image
                                src={person.photo}
                                alt={person.alt}
                                width={240}
                                height={300}
                                className="mb-5 h-auto w-[200px] rounded-xl border border-line md:w-[240px]"
                            />
                            <Heading offset={1} className="m-0 text-xl font-semibold leading-tight">{person.name}</Heading>
                            <p className="m-0 mt-1 text-sm font-medium text-ink-soft">{person.title}</p>
                            <p className="m-0 mt-3 max-w-[34em]">{person.bio}</p>
                        </li>
                    ))}
                </ul>
            </section>

            <section className="pb-8" aria-labelledby={`${making.id}-title`}>
                <Heading id={`${making.id}-title`} className={HEADING_CLASS}>{making.heading}</Heading>
                <ul className="m-0 grid list-none gap-2 p-0">
                    {apps.map((app) => (
                        <li key={app.id}>
                            <Link href={app.href} className="font-medium text-brand-navy underline underline-offset-4 hover:no-underline">
                                {app.name}
                            </Link>
                            {' '}{making.lines[app.id]}
                        </li>
                    ))}
                </ul>
            </section>

            <p className="m-0">
                {contact.before}
                <Link href="/contact/" className="font-medium text-brand-navy underline underline-offset-4 hover:no-underline">
                    {contact.linkText}
                </Link>
                {contact.after}
            </p>
        </div>
    );
}
