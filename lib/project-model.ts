export const projectColors = ["blue", "teal", "amber", "violet", "rose", "slate"] as const;

export type ProjectColor = (typeof projectColors)[number];
export const projectStatuses = ["active", "paused", "completed"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];
export const projectExperimentStatuses = ["todo", "done"] as const;
export type ProjectExperimentStatus = (typeof projectExperimentStatuses)[number];

export type ProjectExperiment = {
  id: number;
  user_id: string;
  project_id: number;
  name: string;
  intensity_score: number;
  status: ProjectExperimentStatus;
  sort_order: number;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

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
  importance: number;
  is_foundation: boolean;
  sort_order: number;
  record_count: number;
  average_intensity: number | null;
  total_intensity: number;
  total_points: number;
  experiment_count: number;
  experiment_todo_count: number;
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
  importance: number;
};
