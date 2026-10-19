import PageIntro from '@/app/components/PageIntro';

export const metadata = {
    title: 'Contact',
};

export default function ContactPage() {
    return (
        <div className="mx-auto max-w-[1088px] px-4 pb-16 md:px-6">
            <PageIntro title="Say hi.">
                The contact form comes in a later build.
            </PageIntro>
        </div>
    );
}
