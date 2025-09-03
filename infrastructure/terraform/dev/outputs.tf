# Outputs for dev environment


output "instance_ips" {
  description = "IP addresses of compute instances"
  value       = module.compute.instance_ips
}


output "database_connection_name" {
  description = "Database connection name"
  value       = module.database.connection_name
  sensitive   = true
}


output "storage_bucket_url" {
  description = "Storage bucket URL"
  value       = module.storage.bucket_url
}

output "environment" {
  description = "Environment name"
  value       = var.environment
}
