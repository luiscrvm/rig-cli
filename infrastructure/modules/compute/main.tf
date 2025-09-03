# Compute Module

terraform {
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

resource "google_compute_instance_template" "app" {
  name_prefix  = "${var.project_id}-${var.environment}-"
  machine_type = var.instance_type
  region       = var.region

  disk {
    source_image = "debian-cloud/debian-11"
    auto_delete  = true
    boot         = true
  }

  network_interface {
    network    = var.vpc_id
    subnetwork = var.subnet_id
    
    access_config {
      // Ephemeral public IP
    }
  }

  metadata_startup_script = <<-EOF
    #!/bin/bash
    apt-get update
    apt-get install -y docker.io
    
    # Pull and run application container
    docker pull gcr.io/${var.project_id}/app:${var.environment}
    docker run -d -p 80:8080 gcr.io/${var.project_id}/app:${var.environment}
  EOF

  tags = ["http-server", "https-server", var.environment]

  lifecycle {
    create_before_destroy = true
  }
}

resource "google_compute_instance_group_manager" "app" {
  name               = "${var.project_id}-${var.environment}-igm"
  base_instance_name = "${var.project_id}-${var.environment}-app"
  zone               = "${var.region}-a"

  version {
    instance_template = google_compute_instance_template.app.id
  }

  target_size = var.instance_count

  named_port {
    name = "http"
    port = 8080
  }
}

# Auto-scaling for production-like environments
resource "google_compute_autoscaler" "app" {
  count = var.enable_autoscaling ? 1 : 0
  
  name   = "${var.project_id}-${var.environment}-autoscaler"
  zone   = "${var.region}-a"
  target = google_compute_instance_group_manager.app.id

  autoscaling_policy {
    max_replicas    = var.max_instances
    min_replicas    = var.min_instances
    cooldown_period = 60

    cpu_utilization {
      target = 0.7
    }
  }
}

# Load Balancer
resource "google_compute_global_address" "app" {
  name = "${var.project_id}-${var.environment}-ip"
}

resource "google_compute_health_check" "app" {
  name               = "${var.project_id}-${var.environment}-health-check"
  check_interval_sec = 5
  timeout_sec        = 5

  tcp_health_check {
    port = 8080
  }
}

resource "google_compute_backend_service" "app" {
  name          = "${var.project_id}-${var.environment}-backend"
  health_checks = [google_compute_health_check.app.id]

  backend {
    group = google_compute_instance_group_manager.app.instance_group
  }
}

resource "google_compute_url_map" "app" {
  name            = "${var.project_id}-${var.environment}-urlmap"
  default_service = google_compute_backend_service.app.id
}

resource "google_compute_target_http_proxy" "app" {
  name    = "${var.project_id}-${var.environment}-proxy"
  url_map = google_compute_url_map.app.id
}

resource "google_compute_global_forwarding_rule" "app" {
  name       = "${var.project_id}-${var.environment}-forwarding-rule"
  target     = google_compute_target_http_proxy.app.id
  port_range = "80"
  ip_address = google_compute_global_address.app.address
}
