# Variables for staging environment

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "xometrydevops-training"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "staging"
}


variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.1.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for public subnet"
  type        = string
  default     = "10.1.1.0/24"
}

variable "private_subnet_cidr" {
  description = "CIDR block for private subnet"
  type        = string
  default     = "10.1.2.0/24"
}


variable "instance_type" {
  description = "Instance type for compute resources"
  type        = string
  default     = "e2-small"
}

variable "instance_count" {
  description = "Number of instances"
  type        = number
  default     = 2
}


variable "database_type" {
  description = "Type of database (postgres, mysql, etc.)"
  type        = string
  default     = "postgres"
}

variable "database_version" {
  description = "Database version"
  type        = string
  default     = "13"
}


