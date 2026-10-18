import PageIntro from '../components/PageIntro';
import words from '../../../content/privacy-words.json';

export const metadata = {
    title: 'Privacy',
};

const HEADING_CLASS = 'm-0 mb-3 text-[clamp(1.6rem,4vw,2.2rem)] leading-[1.1]';

// The short Privacy page for Release 1 (BUWEB-114): the legal reviewer's final
// words, byte for byte, from content/privacy-words.json. It names no contact
// route on purpose (his ruling 3): the site keeps only a 14-day server log.
// Any new form, list or longer keeping changes these words in the same release.
export default function PrivacyPage() {
    const { title, intro, sections } = words;
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title={title}>{intro}</PageIntro>
            {sections.map((section) => (
                <section key={section.id} className="max-w-[40em] pb-10" aria-labelledby={`${section.id}-title`}>
                    <h2 id={`${section.id}-title`} className={HEADING_CLASS}>{section.heading}</h2>
                    <div className="grid gap-3">
                        {section.paragraphs.map((text) => (
                            <p key={text} className="m-0">{text}</p>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );
}
