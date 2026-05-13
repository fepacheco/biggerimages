import InterviewChat from "@/components/InterviewChat";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <InterviewChat sessionId={id} />;
}
