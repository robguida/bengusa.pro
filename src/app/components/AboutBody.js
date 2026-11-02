import Link from 'next/link';
import { getShownApps } from '@/lib/apps';
import { SHOW_CONTACT } from '@/lib/site';
import words from '../../content/about-words.json';

const HEADING_CLASS = 'm-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]';

// The level of the section headings is `level` (2 = h2; the About page uses
// the words file's headingLevel, Home passes 3 because its hero is the h1 and
// "About Us" is an h2). A person's name sits one level below.
function Heading({ level, offset = 0, children, ...props }) {
    const Tag = `h${Math.min(6, Math.max(2, level) + offset)}`;
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
export default function AboutBody({ level = words.headingLevel ?? 2 }) {
    const apps = getShownApps();
    const { story, people, sections, making, contact } = words;
    // "In ... own words" (label, personal photo, titled paragraphs) is hidden while
    // "showOwnWords" in content/about-words.json is false. The words stay there.
    const showOwnWords = words.showOwnWords === true;

    return (
        <>
            <section className="max-w-[40em] pb-10" aria-labelledby={`${story.id}-title`}>
                <Heading level={level} id={`${story.id}-title`} className={HEADING_CLASS}>{story.heading}</Heading>
                <Paragraphs list={story.paragraphs} />
            </section>

            {/* One grid, two shared rows on wide screens: row 1 holds both work
                bios, row 2 both personal blocks, so the personal blocks start at
                the same height whatever the bios' length (only while they are shown). On a phone it is one
                column, and each founder stays together (work, then personal). */}
            <section className="pb-10" aria-labelledby={`${people.id}-title`}>
                <Heading level={level} id={`${people.id}-title`} className={HEADING_CLASS}>{people.heading}</Heading>
                <div className={`grid items-start gap-x-12 gap-y-8 md:grid-cols-2${showOwnWords ? ' md:grid-flow-col md:grid-rows-[auto_auto]' : ''}`}>
                    {people.list.flatMap((person) => [
                        <div key={`${person.id}-work`} className="min-w-0">
                            <Photo src={person.photo} alt={person.alt} />
                            <Heading level={level} offset={1} className="m-0 text-xl font-semibold leading-tight">{person.name}</Heading>
                            <p className="m-0 mt-1 text-sm font-semibold text-ink-soft">{person.title}</p>
                            <div className="mt-3 max-w-[34em]"><Paragraphs list={person.bio} /></div>
                        </div>,
                        showOwnWords && <div key={`${person.id}-own`} className="min-w-0 max-w-[34em]">
                            <p className="m-0 mb-4"><strong>{person.ownWordsLabel}</strong></p>
                            <Photo src={person.personalPhoto} alt={person.personalAlt} />
                            {person.ownWords.map((item) => (
                                <div key={item.label} className="mb-4">
                                    <p className="m-0 mb-1"><strong>{item.label}</strong></p>
                                    <p className="m-0">{inline(item.text)}</p>
                                </div>
                            ))}
                        </div>,
                    ].filter(Boolean))}
                </div>
            </section>

            {sections.map((section) => (
                <section key={section.id} className="max-w-[40em] border-t border-line pb-10 pt-10" aria-labelledby={`${section.id}-title`}>
                    <Heading level={level} id={`${section.id}-title`} className={HEADING_CLASS}>{section.heading}</Heading>
                    <Paragraphs list={section.paragraphs} />
                    {section.emphasis && <p className="m-0 mt-4"><strong>{section.emphasis}</strong></p>}
                </section>
            ))}

            {apps.length > 0 && (
                <section className="pb-8" aria-labelledby={`${making.id}-title`}>
                    <Heading level={level} id={`${making.id}-title`} className={HEADING_CLASS}>{making.heading}</Heading>
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
        </>
    );
}
