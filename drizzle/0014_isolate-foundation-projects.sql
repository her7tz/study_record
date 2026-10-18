DELETE FROM project_dependencies
WHERE EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_dependencies.from_project_id
    AND p.user_id = project_dependencies.user_id AND p.is_foundation = 1
) OR EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_dependencies.to_project_id
    AND p.user_id = project_dependencies.user_id AND p.is_foundation = 1
);
