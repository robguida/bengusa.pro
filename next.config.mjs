/** @type {import('next').NextConfig} */
const nextConfig = {
    // Static export: `next build` writes plain files to out/. Features that
    // need a Next server fail the build instead of shipping.
    output: 'export',
    // Static export has no image server, so images are served as they are.
    images: {
        unoptimized: true,
    },
    // /about -> /about/, written as out/about/index.html, so a plain static
    // server finds every page.
    trailingSlash: true,
    // Stop `next dev` from appending its own block to the project's
    // CLAUDE.md / AGENTS.md. Those files are maintained by hand.
    agentRules: false,
};

export default nextConfig;
