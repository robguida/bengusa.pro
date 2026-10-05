import { PencilIcon } from '@heroicons/react/16/solid';

// Marks words that are still drafts. Comes off page by page as the words are approved.
export default function DraftLabel() {
    return (
        <p className="m-0 inline-flex items-center gap-2 rounded-full border-[1.5px] border-dashed border-ink-soft bg-white px-3 py-1 text-[13px] font-medium tracking-[0.04em] text-ink-soft">
            <PencilIcon className="size-3.5" />
            Draft words. Not final.
        </p>
    );
}
