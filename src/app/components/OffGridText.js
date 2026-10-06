import { Fragment } from 'react';
import OffGridTip from './OffGridTip';
import siteWords from '../../../content/site-words.json';

const TOKEN = '{offGrid}';

// Words from content/site-words.json with "{offGrid}" in them, for example
// "Makers of {offGrid} apps.". The token becomes the word "Off-grid": it never
// splits across lines, carries the dotted green underline and opens the
// Off-grid popup (spec 17.c). These popups name no single app, so they have
// no link (17.c.iv). green: the word itself is green (the hero, 17.a.i).
export default function OffGridText({ text, green = false }) {
    const { badge, popup } = siteWords.offGrid;
    return text.split(TOKEN).map((part, i) => (
        <Fragment key={i}>
            {i > 0 && <OffGridTip kind="word" green={green} word={badge} lead={`${badge}:`} text={popup} />}
            {part}
        </Fragment>
    ));
}
