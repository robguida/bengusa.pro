import siteWords from '../../../content/site-words.json';

// The green Off-grid badge. The small hexagon ties it to the logo's shape.
export default function OffGridBadge() {
    return (
        <span className="inline-flex items-center gap-[7px] rounded-full bg-brand-green py-1 pr-[11px] pl-[9px] text-[13px] leading-[1.2] font-semibold tracking-[0.04em] text-white">
            <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true" focusable="false">
                <path d="M4.5 1.8h7L15 8l-3.5 6.2h-7L1 8z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
            {siteWords.offGrid.badge}
        </span>
    );
}
