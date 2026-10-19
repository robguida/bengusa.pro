// Before any box test: print the build the box is serving (box.config.mjs).
// A box run with no readable build= line stops here, before any browser.
import { readBoxBuild } from './box-build.mjs';

export default async function boxSetup(config) {
    const base = config.projects[0].use.baseURL;
    if (!process.env.E2E_BASE_URL) {
        console.log(`\nBox walk, LOCAL run against ${base}/ (E2E_BASE_URL is not set): no build ID and no header check.\n`);
        return;
    }
    const { build, commit } = await readBoxBuild(base);
    console.log(`\nBox run against ${base}/ : ${base}/version.txt says build=${build}${commit ? ` (commit=${commit})` : ''}\n`);
    // The reporter compares this with a second read at the end.
    process.env.E2E_BOX_BUILD = build;
}
