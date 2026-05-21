import { redirect } from "next/navigation";

interface Props {
  params: Promise<{ interviewId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function buildQueryString(searchParams: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      query.set(key, value);
      continue;
    }

    if (Array.isArray(value)) {
      for (const entry of value) {
        query.append(key, entry);
      }
    }
  }

  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
}

export default async function LegacyInterviewRoute({ params, searchParams }: Props) {
  const { interviewId } = await params;
  const resolvedSearchParams = await searchParams;

  redirect(`/jobs/${interviewId}${buildQueryString(resolvedSearchParams)}`);
}
