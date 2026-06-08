import { z } from "zod";

export const processMeetingSchema = z.object({
  title: z.string().trim().max(140).optional(),
  transcript: z.string().trim().min(12, "Add a bit more transcript to analyze."),
  source: z.enum(["PASTE", "UPLOAD", "RECORDING", "EXTENSION"]).default("PASTE"),
  participants: z.array(z.string()).default([]),
});
export type ProcessMeetingInput = z.infer<typeof processMeetingSchema>;

export const onboardingSchema = z.object({
  useCase: z.enum(["freelance", "agency", "startup", "student", "sales", "consulting"]),
  platforms: z.array(z.enum(["zoom", "meet", "teams", "offline"])).min(1),
  priority: z.enum(["tasks", "summaries", "followups", "mom"]),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

export const updateTaskSchema = z.object({
  id: z.string(),
  title: z.string().trim().min(1).optional(),
  assignee: z.string().trim().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  status: z.enum(["OPEN", "DONE", "ARCHIVED"]).optional(),
});
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
