export const projectColors = ["blue", "teal", "amber", "violet", "rose", "slate"] as const;

export type ProjectColor = (typeof projectColors)[number];
export const projectStatuses = ["active", "paused", "completed"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export type StudyProject = {
  id: number;
  user_id: string;
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  color: ProjectColor;
  created_at: string;
  updated_at: string;
};

export type StudyProjectInput = {
  name: string;
  description: string;
  goal: string;
  status: ProjectStatus;
  start_date: string | null;
  target_date: string | null;
  color: ProjectColor;
};
