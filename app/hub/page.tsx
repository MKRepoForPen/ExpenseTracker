"use client";

import { Suspense } from "react";
import { Hub } from "@/components/cloud/Hub";
import { useExpenses } from "@/components/ExpensesProvider";
import { useCloud } from "@/components/cloud/CloudProvider";
import { ListSkeleton } from "@/components/PageStates";

export default function HubPage() {
  const { isLoading } = useExpenses();
  const { ready } = useCloud();
  if (isLoading || !ready) return <ListSkeleton />;
  return (
    <Suspense fallback={<ListSkeleton />}>
      <Hub />
    </Suspense>
  );
}
