variable "project_id" {
  description = "GCP Project ID"
  type        = string
  # Default will be provided by the calling module or terraform.tfvars
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "enable_logging" {
  description = "Enable logging"
  type        = bool
  default     = true
}

variable "enable_metrics" {
  description = "Enable metrics"
  type        = bool
  default     = true
}

variable "enable_alerting" {
  description = "Enable alerting"
  type        = bool
  default     = false
}

variable "notification_channels" {
  description = "Notification channel IDs"
  type        = list(string)
  default     = []
}

variable "notification_emails" {
  description = "Email addresses for notifications"
  type        = list(string)
  default     = []
}
