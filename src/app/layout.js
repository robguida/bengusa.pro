import localFont from "next/font/local";
import SiteHeader from "./components/header/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import {getShownApps, toMenuItems} from "@/lib/apps";
import {footerLinks, headerLinks} from "@/lib/site";
import siteWords from "../content/site-words.json";
import "./globals.css";

// The two brand fonts live in ./fonts (Latin, variable weight; licence texts
// beside them), so neither the build nor visitors ever call Google.
// The variables go on <html>, so globals.css can map them in @theme.
const lexend = localFont({
    src: "./fonts/lexend-latin.woff2",
    weight: "100 900",
    style: "normal",
    display: "swap",
    variable: "--next-font-lexend",
});

const oswald = localFont({
    src: "./fonts/oswald-latin.woff2",
    weight: "200 700",
    style: "normal",
    display: "swap",
    variable: "--next-font-oswald",
});

// The site's default description is Home's (the legal reviewer's pre-cleared
// words, in content/site-words.json); About and Privacy set their own.
// Share preview: text only. Each page's share title and description come from
// its own title and description, so no address and no image is needed.
// Icons (Adam's wave-2a calls): the tab icon on its white tile,
// src/app/icon.svg; the same at 16, 32 and 48px in public/favicon.ico, for
// browsers that don't take an SVG icon; and the 180px phone home-screen icon,
// src/app/apple-icon.png. Next serves the two src/app files at /icon.svg and
// /apple-icon.png, but adds no links of its own while this list is set, so all
// three are listed here.
export const metadata = {
    title: {
        default: "bengUSA.pro · Apps that mind their own business",
        template: "%s · bengUSA.pro",
    },
    description: siteWords.home.description,
    openGraph: {
        type: 'website',
        siteName: 'bengUSA.pro',
    },
    icons: {
        icon: [
            {url: '/icon.svg', type: 'image/svg+xml'},
            {url: '/favicon.ico', sizes: '16x16 32x32 48x48'},
        ],
        apple: [{url: '/apple-icon.png', sizes: '180x180', type: 'image/png'}],
    },
};

// The header and footer get only what the site shows (src/lib/site.js): no
// app and no Contact link while content/site-settings.json hides them. The
// header is a browser component, so whatever it is given travels in every
// page's data: hidden items must never be passed to it at all.
export default function RootLayout({children}) {
    const menuItems = toMenuItems(getShownApps());
    return (
        <html lang="en" className={`${lexend.variable} ${oswald.variable}`}>
            <body className="antialiased">
                <a href="#content" className="skip-link">Skip to content</a>
                <SiteHeader apps={menuItems} links={headerLinks()} />
                <main id="content" tabIndex={-1} className="site-main">{children}</main>
                <SiteFooter links={footerLinks(menuItems)} />
            </body>
        </html>
    );
}
