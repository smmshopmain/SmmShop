export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "Completed" || status === "Approved"
      ? "bg-teal-50 text-teal-800 ring-teal-200"
      : status === "Pending" || status === "Processing" || status === "In Progress"
        ? "bg-amber-50 text-amber-800 ring-amber-200"
        : "bg-rose-50 text-rose-800 ring-rose-200";

  return (
    <span className={`inline-flex rounded-md px-2 py-1 text-xs font-medium ring-1 ${tone}`}>
      {status}
    </span>
  );
}
