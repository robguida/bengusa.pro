import { Fragment } from 'react';
import { OffGridTipRoot, OffGridTrigger } from './OffGridTip';
import siteWords from '../../content/site-words.json';

const TOKEN = '{offGrid}';

// A heading from content/site-words.json with "{offGrid}" in it, for example
// "Makers of {offGrid} apps.". The token becomes the word "Off-grid": it never
// splits across lines, carries the dotted green underline and opens the
// Off-grid popup (spec 17.c). These popups name no single app, so they have
// no link (17.c.iv). green: the word itself is green (the hero, 17.a.i).
//
// The popup's box goes right AFTER the heading, never inside it, so the
// heading's text is only its own words (for crawlers, and for a screen
// reader's heading name while the box is open). The word stays in the
// heading, and still opens the box by tap before the script loads: the
// browser's popover switch finds the box by its ID.
//
// as: 'h1' or 'h2'. Every other prop (id, className) goes on the heading.
export default function OffGridHeading({ as: Heading = 'h2', text, green = false, ...props }) {
    const { badge, popup } = siteWords.offGrid;
    const parts = text.split(TOKEN);
    let node = (
        <Heading {...props}>
            {parts.map((part, i) => (
                <Fragment key={i}>
                    {i > 0 && <OffGridTrigger tipKey={i} kind="word" green={green} word={badge} />}
                    {part}
                </Fragment>
            ))}
        </Heading>
    );
    // One box per "Off-grid" word, in the order of the words, all right after
    // the heading.
    for (let i = 1; i < parts.length; i += 1) {
        node = (
            <OffGridTipRoot tipKey={i} lead={`${badge}:`} text={popup}>
                {node}
            </OffGridTipRoot>
        );
    }
    return node;
}
