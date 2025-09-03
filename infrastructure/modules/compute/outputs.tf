output "instance_ips" {
  value = google_compute_global_address.app.address
}

output "load_balancer_ip" {
  value = google_compute_global_address.app.address
}

output "instance_group" {
  value = google_compute_instance_group_manager.app.instance_group
}
