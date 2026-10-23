import { ContentLoading } from "@/components/content-loading";

export default function Loading() {
  return (
    <main className="grid min-h-screen place-items-center px-4">
      <ContentLoading label="Loading page..." />
    </main>
  );
}
