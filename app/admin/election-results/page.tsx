import { CountingPage } from "@/components/counting/counting-page";

export const dynamic = "force-dynamic";

export default function ElectionResultsPage() {
  return <CountingPage base="/admin" />;
}
