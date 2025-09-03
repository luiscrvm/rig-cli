variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "xometrydevops-training"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "database_type" {
  description = "Database type (postgres, mysql)"
  type        = string
  default     = "postgres"
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "13"
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "app"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "appuser"
}

variable "tier" {
  description = "Database tier"
  type        = string
  default     = "db-f1-micro"
}

variable "availability_type" {
  description = "Availability type (ZONAL or REGIONAL)"
  type        = string
  default     = "ZONAL"
}

variable "backup_enabled" {
  description = "Enable backups"
  type        = bool
  default     = false
}

variable "vpc_id" {
  description = "VPC ID for private IP"
  type        = string
  default     = "default"
}
