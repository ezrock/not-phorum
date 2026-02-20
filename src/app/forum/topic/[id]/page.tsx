import { redirect } from 'next/navigation';

export default async function LegacyForumTopicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/topic/${id}`);
}
