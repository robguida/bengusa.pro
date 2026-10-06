import localFont from "next/font/local";
import SiteHeader from "./components/header/SiteHeader";
import SiteFooter from "./components/SiteFooter";
import {getPublicApps, toMenuItems} from "@/lib/apps";
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

export default function RootLayout({children}) {
    const menuItems = toMenuItems(getPublicApps());
    return (
        <html lang="en" className={`${lexend.variable} ${oswald.variable}`}>
            <body className="antialiased">
                <a href="#content" className="skip-link">Skip to content</a>
                <SiteHeader apps={menuItems} />
                <main id="content" tabIndex={-1} className="site-main">{children}</main>
                <SiteFooter apps={menuItems} />
            </body>
        </html>
    );
}
