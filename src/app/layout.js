import {Oswald, Roboto, Playwrite_AU_SA, Lexend} from "next/font/google";
import "./globals.css";

// next/font downloads these at build time and serves them from this site,
// so visitors never call Google. All four are variable fonts: leaving out
// `weight` ships one file per font that covers every weight.
const oswaldSans = Oswald({
    variable: "--font-oswald",
    subsets: ["latin"],
});

const robotoSans = Roboto({
    variable: "--font-roboto",
    subsets: ["latin"],
});

const lexendSans = Lexend({
    variable: "--font-lexend",
    subsets: ["latin"],
});

const playwriteSans = Playwrite_AU_SA({
    variable: "--font-playwrite",
    subsets: ["latin"],
});

export const metadata = {
    title: "bengUSA.pro",
    icons: {
        icon: '/images/svg/bengusaicon.svg'
    }
};

export default function RootLayout({children}) {
    return (
        <html lang="en">
            <body className={`${oswaldSans.variable} ${robotoSans.variable} ${playwriteSans.variable} ${lexendSans.variable} antialiased`}>
                <main>{children}</main>
            </body>
        </html>
    );
}
