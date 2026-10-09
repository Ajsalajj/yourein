import { InvitationPage, invitationMetadata } from "../render";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  return invitationMetadata((await params).slug);
}

export default async function Page({ params }: Props) {
  return <InvitationPage slug={(await params).slug} />;
}
