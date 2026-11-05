"use client";

import { useEffect, useState } from "react";
import { apiJson } from "@/lib/client-api";

function formatBalance(value: number) {
  return `Rs.${Number.isFinite(value) ? value : 0}`;
}

export function LiveWalletBalance({ initialBalance }: { initialBalance: number }) {
  const [balance, setBalance] = useState(initialBalance);

  useEffect(() => {
    let active = true;

    async function refreshBalance() {
      try {
        const result = await apiJson("/api/wallet?summary=1", { cache: "no-store" });
        const nextBalance = Number(result.data?.balance ?? result.balance ?? NaN);
        if (active && Number.isFinite(nextBalance)) {
          setBalance(nextBalance);
        }
      } catch {
        // Keep the server-rendered balance if the live refresh fails.
      }
    }

    refreshBalance();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshBalance();
    }, 60000);
    window.addEventListener("focus", refreshBalance);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshBalance);
    };
  }, []);

  return <>{formatBalance(balance)}</>;
}
