output "connection_name" {
  value     = google_sql_database_instance.main.connection_name
  sensitive = true
}

output "database_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.database.name
}

output "database_user" {
  value = google_sql_user.users.name
}

output "password_secret_id" {
  value = google_secret_manager_secret.db_password.secret_id
}
