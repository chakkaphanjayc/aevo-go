import { useEffect, type ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { hydrateCart } from "@/lib/cart-store";
import { createQueryClient } from "@/lib/query-client";
import { hydrateUiState } from "@/lib/ui-store";

const queryClient = createQueryClient();

export function AppProviders({ children }: { children: ReactNode }) {
  useEffect(() => {
    void hydrateCart();
    void hydrateUiState();
  }, []);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
