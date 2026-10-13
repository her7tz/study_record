ALTER TABLE `study_records` ADD `experiment_id` integer REFERENCES project_experiments(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_study_records_user_experiment` ON `study_records` (`user_id`,`experiment_id`);
--> statement-breakpoint
INSERT INTO study_records (user_id, study_date, subject, record_type, project_id, intensity_score, note, experiment_id)
SELECT e.user_id, date(COALESCE(e.completed_at, e.created_at), '+8 hours'), e.name, 'experiment',
       e.project_id, e.intensity_score, e.description, e.id
FROM project_experiments e
JOIN projects p ON p.id = e.project_id AND p.user_id = e.user_id AND p.deleted_at IS NULL
WHERE e.status = 'done' AND e.deleted_at IS NULL
  AND NOT EXISTS (SELECT 1 FROM study_records r WHERE r.user_id = e.user_id AND r.experiment_id = e.id);
