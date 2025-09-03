terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Compute Engine Instance (cheapest configuration)
resource "google_compute_instance" "dev_instance" {
  name         = "${var.project_id}-dev-instance"
  machine_type = "e2-micro"  # Cheapest option
  zone         = "${var.region}-a"

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-11"
      size  = 10  # Minimal disk size
      type  = "pd-standard"  # Cheapest disk type
    }
  }

  network_interface {
    network = "default"  # Use default network to avoid additional costs
    access_config {
      # Ephemeral public IP
    }
  }

  metadata = {
    environment = "dev"
    managed-by  = "rig-cli"
  }

  tags = ["dev", "compute"]

  # Allow HTTP traffic
  allow_stopping_for_update = true
}

# Firewall rule for HTTP access (if needed)
resource "google_compute_firewall" "dev_http" {
  name    = "${var.project_id}-dev-http"
  network = "default"

  allow {
    protocol = "tcp"
    ports    = ["80", "8080"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["dev", "compute"]
}