import { AccountLegacy } from "@/components/legacy/AccountLegacy";
export default function Page(props: { params: Promise<{ locale: string }> }) { return <AccountLegacy {...props} mode="new" />; }
