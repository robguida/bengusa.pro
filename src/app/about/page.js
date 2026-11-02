import Link from 'next/link';
import PageIntro from '../components/PageIntro';
import { getShownApps } from '@/lib/apps';
import { SHOW_CONTACT } from '@/lib/site';
import words from '../../content/about-words.json';

export const metadata = {
    title: 'About',
    description: words.top.description,
};

const HEADING_CLASS = 'm-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]';

// The level of the page's section headings is a setting in the words file
// (2 = h2). A person's name sits one level below.
function Heading({ offset = 0, children, ...props }) {
    const Tag = `h${Math.min(6, Math.max(2, words.headingLevel ?? 2) + offset)}`;
    return <Tag {...props}>{children}</Tag>;
}

// Words wrapped in *asterisks* are italic (a title). Nothing else is marked up.
function inline(text) {
    return text.split(/\*([^*]+)\*/).map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : part));
}

function Paragraphs({ list }) {
    return list.map((text) => (
        <p key={text} className="m-0 mb-4 text-ink-soft last:mb-0">{inline(text)}</p>
    ));
}

// A plain <img>, not next/image: next/image adds style="color:transparent",
// and the page's security policy allows no inline styles. The photos are
// served as they are (unoptimized), so nothing else changes.
function Photo({ src, alt }) {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={src}
            alt={alt}
            width={480}
            height={600}
            loading="lazy"
            decoding="async"
            className="mb-5 h-auto w-[200px] rounded-xl border border-line md:w-[240px]"
        />
    );
}

// While content/site-settings.json hides the apps, "What we're making" is left
// out; while it hides Contact, so is the Contact line. Their words stay in
// content/about-words.json for when they come back.
export default function AboutPage() {
    const apps = getShownApps();
    const { top, story, people, making, contact } = words;

    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title={top.title}>{top.line}</PageIntro>

            <section className="max-w-[40em] pb-10" aria-labelledby={`${story.id}-title`}>
                <Heading id={`${story.id}-title`} className={HEADING_CLASS}>{story.heading}</Heading>
                <Paragraphs list={story.paragraphs} />
                {story.sections.map((section) => (
                    <div key={section.heading} className="mt-8">
                        <Heading offset={1} className="m-0 mb-3 text-xl font-semibold leading-tight">{section.heading}</Heading>
                        <Paragraphs list={section.paragraphs} />
                        {section.emphasis && <p className="m-0 mt-4"><strong>{section.emphasis}</strong></p>}
                    </div>
                ))}
            </section>

            <section className="pb-10" aria-labelledby={`${people.id}-title`}>
                <Heading id={`${people.id}-title`} className={HEADING_CLASS}>{people.heading}</Heading>
                <ul className="m-0 grid list-none items-start gap-12 p-0 md:grid-cols-2">
                    {people.list.map((person) => (
                        <li key={person.id} className="min-w-0">
                            <Photo src={person.photo} alt={person.alt} />
                            <Heading offset={1} className="m-0 text-xl font-semibold leading-tight">{person.name}</Heading>
                            <p className="m-0 mt-1 text-sm font-semibold text-ink-soft">{person.title}</p>
                            <div className="mt-3 max-w-[34em]"><Paragraphs list={person.bio} /></div>
                            <div className="mt-8 max-w-[34em]">
                                <p className="m-0 mb-4"><strong>{person.ownWordsLabel}</strong></p>
                                <Photo src={person.personalPhoto} alt={person.personalAlt} />
                                {person.ownWords.map((item) => (
                                    <div key={item.label} className="mb-4">
                                        <p className="m-0 mb-1"><strong>{item.label}</strong></p>
                                        <p className="m-0">{inline(item.text)}</p>
                                    </div>
                                ))}
                            </div>
                        </li>
                    ))}
                </ul>
            </section>

            {apps.length > 0 && (
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
            )}

            {SHOW_CONTACT && (
                <p className="m-0">
                    {contact.before}
                    <Link href="/contact/" className="font-medium text-brand-navy underline underline-offset-4 hover:no-underline">
                        {contact.linkText}
                    </Link>
                    {contact.after}
                </p>
            )}
        </div>
    );
}
