"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReferenceRates } from "./rates";

// Shared client cache for the reference rates — one fetch feeds every offer card
// and detail page. Failures resolve to null so the fairness badge just hides.
export function useRates() {
  const { data } = useQuery<ReferenceRates | null>({
    queryKey: ["rates"],
    queryFn: async () => {
      const res = await fetch("/api/rates");
      if (!res.ok) return null;
      return (await res.json()) as ReferenceRates;
    },
    staleTime: 30 * 60 * 1000,
    retry: false,
  });
  return data ?? null;
}
