export const projectColors = ["blue", "teal", "amber", "violet", "rose", "slate"] as const;

export type ProjectColor = (typeof projectColors)[number];

export type StudyProject = {
  id: number;
  user_id: string;
  name: string;
  description: string;
  color: ProjectColor;
  created_at: string;
  updated_at: string;
};

export type StudyProjectInput = {
  name: string;
  description: string;
  color: ProjectColor;
};
