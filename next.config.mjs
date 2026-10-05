/** @type {import('next').NextConfig} */
const nextConfig = {
    // Static export: `next build` writes plain files to out/. Features that
    // need a Next server fail the build instead of shipping.
    output: 'export',
    // Stop `next dev` from appending its own block to the project's
    // CLAUDE.md / AGENTS.md. Those files are maintained by hand.
    agentRules: false,
};

export default nextConfig;
