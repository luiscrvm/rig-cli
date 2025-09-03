# Monitoring Module

# Log sink for centralized logging
resource "google_logging_project_sink" "main" {
  name        = "${var.project_id}-${var.environment}-sink"
  destination = "storage.googleapis.com/${google_storage_bucket.logs.name}"
  
  filter = var.environment == "prod" ? "" : "severity >= WARNING"

  unique_writer_identity = true
}

resource "google_storage_bucket" "logs" {
  name          = "${var.project_id}-${var.environment}-logs"
  location      = "US"
  storage_class = "NEARLINE"

  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
}

# Monitoring alerts for production
resource "google_monitoring_alert_policy" "high_cpu" {
  count = var.enable_alerting ? 1 : 0

  display_name = "${var.project_id}-${var.environment}-high-cpu"
  combiner     = "OR"

  conditions {
    display_name = "CPU usage above 80%"

    condition_threshold {
      filter          = "metric.type=\"compute.googleapis.com/instance/cpu/utilization\" resource.type=\"gce_instance\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 0.8

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels
}

resource "google_monitoring_alert_policy" "high_memory" {
  count = var.enable_alerting ? 1 : 0

  display_name = "${var.project_id}-${var.environment}-high-memory"
  combiner     = "OR"

  conditions {
    display_name = "Memory usage above 90%"

    condition_threshold {
      filter          = "metric.type=\"agent.googleapis.com/memory/percent_used\" resource.type=\"gce_instance\""
      duration        = "60s"
      comparison      = "COMPARISON_GT"
      threshold_value = 90

      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_MEAN"
      }
    }
  }

  notification_channels = var.notification_channels
}

# Dashboard
resource "google_monitoring_dashboard" "main" {
  dashboard_json = jsonencode({
    displayName = "${var.project_id}-${var.environment}-dashboard"
    
    gridLayout = {
      widgets = [
        {
          title = "CPU Utilization"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"compute.googleapis.com/instance/cpu/utilization\" resource.type=\"gce_instance\""
                }
              }
            }]
          }
        },
        {
          title = "Memory Usage"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"agent.googleapis.com/memory/percent_used\" resource.type=\"gce_instance\""
                }
              }
            }]
          }
        }
      ]
    }
  })
}
