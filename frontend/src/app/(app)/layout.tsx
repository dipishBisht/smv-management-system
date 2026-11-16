
import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { Loading } from "@/components/ui";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="main">
          <Loading />
        </div>
      }
    >
      <Shell>{children}</Shell>
    </Suspense>
  );
}
