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

variable "instance_type" {
  description = "Instance type"
  type        = string
  default     = "e2-standard-2"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 2
  validation {
    condition     = var.instance_count >= 1 && var.instance_count <= 20
    error_message = "Instance count must be between 1 and 20."
  }
}

variable "vpc_id" {
  description = "VPC ID"
  type        = string
  default     = "default"
}

variable "subnet_id" {
  description = "Subnet ID"
  type        = string
  default     = "default"
}

variable "enable_autoscaling" {
  description = "Enable auto-scaling"
  type        = bool
  default     = false
}

variable "min_instances" {
  description = "Minimum number of instances"
  type        = number
  default     = 1
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 1
}
