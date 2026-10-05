// An app's long name, with any label after the short name in smaller type:
// "Vault (working name)" shows as "Vault" plus a small "(working name)".
// The words are unchanged, so screen readers and copy-paste get the full name.
export default function AppName({ app }) {
    const { name, shortName } = app;
    if (!name.startsWith(`${shortName} `)) return name;
    return (
        <>
            {shortName}{' '}
            <small className="font-sans text-sm font-normal tracking-normal text-ink-soft">
                {name.slice(shortName.length + 1)}
            </small>
        </>
    );
}
