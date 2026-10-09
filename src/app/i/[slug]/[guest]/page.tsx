import { InvitationPage, invitationMetadata } from "../../render";

type Props = { params: Promise<{ slug: string; guest: string }> };

export async function generateMetadata({ params }: Props) {
  return invitationMetadata((await params).slug);
}

/** A personal link: greets one guest or family by name and applies their guest limit. */
export default async function Page({ params }: Props) {
  const { slug, guest } = await params;
  return <InvitationPage slug={slug} guestSlug={guest} />;
}
