import OffGridTip from './OffGridTip';
import siteWords from '../../content/site-words.json';

// The green Off-grid badge. The small hexagon ties it to the logo's shape.
// It is a button that opens the Off-grid popup (OffGridTip, spec 17.c); the
// visible short line or legend beside it stays on the page as well.
// link: the app's "What <App> connects to" box ({ href, label }), or null
// when the app's page has no box to point at.
export default function OffGridBadge({ link = null }) {
    const { badge, popup } = siteWords.offGrid;
    return <OffGridTip kind="badge" word={badge} lead={`${badge}:`} text={popup} link={link} />;
}
