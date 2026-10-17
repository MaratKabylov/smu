import { PublicLegacy, legacyMetadata, type LegacyPublicProps } from "@/components/legacy/PublicLegacy";
export function generateMetadata(props: LegacyPublicProps) { return legacyMetadata(props); }
export default function Page(props: LegacyPublicProps) { return <PublicLegacy {...props} />; }
