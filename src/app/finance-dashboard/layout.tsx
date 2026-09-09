import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "일일잔고현황",
  description: "실시간 일일잔고현황 대시보드",
};

export default function FinanceDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
