import Link from 'next/link';

// Site footer. The app links come from the app list. Brand name only:
// no company type and no email address.
export default function SiteFooter({ apps }) {
    const links = [
        ...apps.map((app) => ({ key: app.id, href: app.href, label: app.name })),
        { key: 'about', href: '/about/', label: 'About' },
        { key: 'contact', href: '/contact/', label: 'Contact' },
        { key: 'privacy', href: '/privacy/', label: 'Privacy' },
    ];

    return (
        <footer className="mx-auto max-w-[1088px] px-4 md:px-6">
            <div className="flex flex-col gap-3 border-t border-line py-[22px] text-sm text-ink-soft">
                <nav aria-label="Footer">
                    <ul className="m-0 flex list-none flex-wrap gap-x-[22px] gap-y-2 p-0">
                        {links.map((link) => (
                            <li key={link.key}>
                                <Link href={link.href} className="text-brand-navy underline underline-offset-4 hover:no-underline">
                                    {link.label}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </nav>
                <p className="m-0">&copy; 2026 bengUSA.pro. All rights reserved.</p>
            </div>
        </footer>
    );
}
