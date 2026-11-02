// The box run's last line (box.config.mjs). It reads version.txt again and
// names the build: "BOX TEST PASS for build=<id>" only when every test passed
// AND the box still serves the build read before the first test. Anything else
// is "BOX TEST FAIL", and the run's exit code is a failure.
import { readBoxBuild } from './box-build.mjs';

export default class BoxReporter {
    onBegin(config, suite) {
        this.base = config.projects[0].use.baseURL;
        this.tests = suite.allTests().length;
    }

    printsToStdio() {
        return true;
    }

    async onEnd(result) {
        const ran = `${this.tests} tests: Chromium and WebKit at 390 and 1280 px`;
        if (!process.env.E2E_BASE_URL) {
            console.log(`\nBox walk, LOCAL run: ${result.status.toUpperCase()} at ${this.base}/ (${ran}). Not the box: no build ID, no header check.`);
            return undefined;
        }
        const first = process.env.E2E_BOX_BUILD || '';
        let last = '';
        let why = '';
        try {
            ({ build: last } = await readBoxBuild(this.base));
        } catch (err) {
            why = err.message;
        }
        if (!why && !first) why = 'the build was not read before the tests';
        if (!why && last !== first) why = `the box changed build during the run (build=${first} before, build=${last} after)`;
        if (!why && result.status !== 'passed') why = `the run ${result.status}; see the failures above`;
        if (!why) {
            console.log(`\nBOX TEST PASS for build=${last} at ${this.base}/ (${ran}).`);
            return undefined;
        }
        console.log(`\nBOX TEST FAIL for build=${first || last || '(unknown)'} at ${this.base}/: ${why}.`);
        return { status: 'failed' };
    }
}
