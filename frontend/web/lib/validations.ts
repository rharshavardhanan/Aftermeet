import { z } from "zod";

export const onboardingSchema = z.object({
  useCase: z.enum(["freelance", "agency", "startup", "student", "sales", "consulting"]),
  platforms: z.array(z.enum(["zoom", "meet", "teams", "offline"])).min(1),
  priority: z.enum(["tasks", "summaries", "followups", "mom"]),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;
