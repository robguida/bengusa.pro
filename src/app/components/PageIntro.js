
// The top of an inner page: headline, optional line under it.
export default function PageIntro({ title, children }) {
    return (
        <div className="grid justify-items-start gap-[18px] pb-10">
            <h1 className="m-0 max-w-[18ch] text-[clamp(2.4rem,7vw,4rem)] leading-[1.04]">{title}</h1>
            {children && (
                <p className="m-0 max-w-[34em] text-[clamp(1.05rem,2.4vw,1.25rem)] text-ink-soft">{children}</p>
            )}
        </div>
    );
}
