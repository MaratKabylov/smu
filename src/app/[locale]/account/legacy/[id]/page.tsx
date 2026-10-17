import { AccountLegacy } from "@/components/legacy/AccountLegacy";
export default function Page(props: { params: Promise<{ locale: string; id: string }> }) { return <AccountLegacy {...props} mode="detail" />; }
