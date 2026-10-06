import KeepWhole from './KeepWhole';
import OffGridBadge from './OffGridBadge';
import siteWords from '../../../content/site-words.json';

// The Off-grid legend (spec 13.a.ii): the green badge, then "Off-grid:" in
// bold and the legend's words, with each brand term kept whole. It sits
// under the "Off-grid, explained" heading on Home and on each Off-grid
// app's page, so both look the same.
// text: the words after "Off-grid: ". Home's version keeps "Each app's page
// lists what it connects to."; an app's page drops it, because its connects
// box sits right below.
// link: for the badge's popup. The app's connects box ({ href, label }) on
// its page; null on Home, where the legend names no single app (17.c.iv).
export default function OffGridLegend({ text, link = null }) {
    const { badge } = siteWords.offGrid;
    return (
        <p className="m-0 flex flex-wrap items-start gap-3">
            <OffGridBadge link={link} />
            <span className="min-w-0 flex-1 basis-64">
                <b className="font-semibold"><KeepWhole text={`${badge}:`} /></b> <KeepWhole text={text} />
            </span>
        </p>
    );
}
