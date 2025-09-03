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

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "bucket_name" {
  description = "Storage bucket name"
  type        = string
  # Default will be generated based on project_id and environment
}

variable "storage_class" {
  description = "Storage class"
  type        = string
  default     = "REGIONAL"
}

variable "lifecycle_age" {
  description = "Days before deletion"
  type        = number
  default     = 30
}

variable "versioning_enabled" {
  description = "Enable versioning"
  type        = bool
  default     = false
}
