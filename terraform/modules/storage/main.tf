# Storage module generated from existing resources
resource "google_storage_bucket" "bucket" {
  count    = length(var.bucket_names)
  name     = var.bucket_names[count.index]
  location = var.region
  
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }
  
  versioning {
    enabled = true
  }
}