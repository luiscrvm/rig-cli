output "instance_name" {
  description = "Name of the compute instance"
  value       = google_compute_instance.dev_instance.name
}

output "instance_external_ip" {
  description = "External IP address of the compute instance"
  value       = google_compute_instance.dev_instance.network_interface[0].access_config[0].nat_ip
}

output "instance_internal_ip" {
  description = "Internal IP address of the compute instance"
  value       = google_compute_instance.dev_instance.network_interface[0].network_ip
}

output "ssh_command" {
  description = "Command to SSH into the instance"
  value       = "gcloud compute ssh ${google_compute_instance.dev_instance.name} --zone=${google_compute_instance.dev_instance.zone}"
}