variable "bucket_names" {
  description = "List of bucket names"
  type        = list(string)
  default     = [
  "aibrandedbooth.appspot.com :",
  "staging.aibrandedbooth.appspot.com :"
]
}

variable "region" {
  description = "GCP region"
  type        = string
}