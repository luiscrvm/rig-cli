output "log_sink_name" {
  value = google_logging_project_sink.main.name
}

output "log_bucket_name" {
  value = google_storage_bucket.logs.name
}

output "dashboard_id" {
  value = google_monitoring_dashboard.main.id
}
