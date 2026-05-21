import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ interviewId: string }>;
}

export default async function LegacyInterviewInvitesRoute({ params }: Props) {
  const { interviewId } = await params;

  redirect(`/jobs/${interviewId}/invites`);
}
