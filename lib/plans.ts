export type PlanId = "FREE" | "PRO";

export interface PlanDef {
  id: PlanId;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "FREE",
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "For trying it on real meetings.",
    features: [
      "10 meetings / month",
      "Summaries, tasks & decisions",
      "Meeting Minutes (MoM)",
      "Markdown export",
    ],
    cta: "Start free",
  },
  {
    id: "PRO",
    name: "Pro",
    price: "$18",
    cadence: "per month",
    tagline: "For people who live in meetings.",
    highlighted: true,
    features: [
      "Unlimited meetings",
      "Chrome extension + live notes",
      "Live transcription & speaker labels",
      "PDF + email-ready exports",
      "Priority processing",
    ],
    cta: "Upgrade to Pro",
  },
];
