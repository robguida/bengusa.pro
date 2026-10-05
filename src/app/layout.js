import {Lexend, Oswald} from "next/font/google";
import SiteHeader from "./components/header/SiteHeader";
import {getPublicApps, toMenuItems} from "@/lib/apps";
import "./globals.css";

// next/font downloads these at build time and serves them from this site,
// so visitors never call Google. Both are variable fonts: leaving out
// `weight` ships one file per font that covers every weight.
// The variables go on <html>, so globals.css can map them in @theme.
const lexend = Lexend({
    variable: "--next-font-lexend",
    subsets: ["latin"],
});

const oswald = Oswald({
    variable: "--next-font-oswald",
    subsets: ["latin"],
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
            </body>
        </html>
    );
}
