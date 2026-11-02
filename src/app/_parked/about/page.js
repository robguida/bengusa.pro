import PageIntro from '@/app/components/PageIntro';
import AboutBody from '@/app/components/AboutBody';
import words from '@/content/about-words.json';

export const metadata = {
    title: 'About',
    description: words.top.description,
};

// PARKED (one-page site, 2026-11-02): the About body now stands on Home. This
// page is the About page as it was, with the same shared body. To bring it back,
// set "showAbout" to true in content/site-settings.json AND move this folder
// back to src/app/about/.
export default function AboutPage() {
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title={words.top.title}>{words.top.line}</PageIntro>
            <AboutBody />
        </div>
    );
}
