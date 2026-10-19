import PageIntro from './components/PageIntro';

export const metadata = {
    title: '404: This page could not be found.',
};

// The site's 404 page (out/404.html), inside the site's own header and footer.
// Next's stock 404 sets its look with inline styles, which the pages' security
// policy blocks, so it would show unstyled. The words are Next's stock words,
// which the legal reviewer passed (Release 1 rulings, "Pre-cleared").
// The web server must serve this page with status 404 (Otto's nginx).
export default function NotFound() {
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title="404">This page could not be found.</PageIntro>
        </div>
    );
}
