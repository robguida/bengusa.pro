import Link from 'next/link';
import PageIntro from './components/PageIntro';

export const metadata = {
    title: '404: This page could not be found.',
};

// The site's 404 page (out/404.html), inside the site's own header and footer.
// Next's stock 404 sets its look with inline styles, which the pages' security
// policy blocks, so it would show unstyled. The words are Next's stock words,
// which the legal reviewer passed (Release 1 rulings, "Pre-cleared").
// The web server must serve this page with status 404 (Otto's nginx).
// One-page site (2026-11-02): every address that is not Home sends the visitor
// to Home at once. A meta refresh of 0 seconds does it: the pages' security
// policy blocks inline scripts, and it does not restrict a meta refresh. The
// short link is the fallback. React puts the <meta> in the page's <head>.
export default function NotFound() {
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <meta httpEquiv="refresh" content="0;url=/" />
            <PageIntro title="404">This page could not be found.</PageIntro>
            <p className="m-0">
                <Link href="/" className="font-medium text-brand-navy underline underline-offset-4 hover:no-underline">Go to the home page</Link>
            </p>
        </div>
    );
}
