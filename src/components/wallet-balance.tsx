"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";

function formatBalance(value: number) {
  return `Rs.${Number.isFinite(value) ? value : 0}`;
}

export function LiveWalletBalance({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    let active = true;

    apiFetch("/api/wallet")
      .then((response) => response.json())
      .then((result) => {
        const nextBalance = Number(result.data?.balance);
        if (active && Number.isFinite(nextBalance)) setBalance(nextBalance);
      })
      .catch(() => {
        // Keep the server-rendered balance if the live refresh fails.
      });

    return () => {
      active = false;
    };
  }, []);

  return <>{formatBalance(balance)}</>;
}
