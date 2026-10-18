import localFont from "next/font/local";
import SiteHeader from "./components/header/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import {getShownApps, toMenuItems} from "@/lib/apps";
import {footerLinks, headerLinks} from "@/lib/site";
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

export const metadata = {
    title: {
        default: "bengUSA.pro · Apps that mind their own business",
        template: "%s · bengUSA.pro",
    },
    icons: {
        icon: '/images/svg/bengusaicon.svg'
    }
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
