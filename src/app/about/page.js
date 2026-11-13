import PageIntro from '@/app/components/PageIntro';
import AboutBody from '@/app/components/AboutBody';
import words from '@/content/about-words.json';

export const metadata = {
    title: 'About',
    description: words.top.description,
};

// Live at /about/ since 2026-11-13 (BUWEB-133): About Us on its own page, off Home.
// The body is the shared component (src/app/components/AboutBody.js).
export default function AboutPage() {
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title={words.top.title} />
            <AboutBody />
        </div>
    );
}
