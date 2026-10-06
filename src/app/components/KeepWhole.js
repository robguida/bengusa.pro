import { Fragment } from 'react';

// Running text in which "Off-grid" and "Cloud-killers" never split across two
// lines at their hyphen (spec 17.a.iv, for both brand terms). Each term is
// wrapped in a no-wrap span, the same way the hero word is kept whole.
//
// The words are not changed: never swap in the no-break hyphen character.
// The approved words must stay byte for byte as written, and a search of the
// page for "Off-grid" must still find them.
const TERMS = /(off-grid|cloud-killers)/i;

export default function KeepWhole({ text }) {
    // split() with a capture group puts each term at an odd index.
    return text.split(TERMS).map((part, i) => (i % 2 === 1
        ? <span key={i} className="whitespace-nowrap">{part}</span>
        : <Fragment key={i}>{part}</Fragment>));
}
