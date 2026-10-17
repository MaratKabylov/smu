import { AccountLegacy } from "@/components/legacy/AccountLegacy";
export default function Page(props: { params: Promise<{ locale: string }>; searchParams: Promise<{ page?: string | string[] }> }) { return <AccountLegacy {...props} mode="list" />; }
