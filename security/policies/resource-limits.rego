package resource.limits

import future.keywords.contains
import future.keywords.if
import future.keywords.in

# Deny containers without CPU limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits.cpu
  msg := sprintf("Container %s must have CPU limits", [container.name])
}

# Deny containers without memory limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits.memory
  msg := sprintf("Container %s must have memory limits", [container.name])
}

# Deny excessive CPU limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  cpu_limit := container.resources.limits.cpu
  to_number(trim_suffix(cpu_limit, "m")) > 4000
  msg := sprintf("Container %s CPU limit %s exceeds maximum allowed (4)", [container.name, cpu_limit])
}

# Deny excessive memory limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  memory_limit := container.resources.limits.memory
  memory_bytes := convert_memory_to_bytes(memory_limit)
  memory_bytes > 4294967296
  msg := sprintf("Container %s memory limit %s exceeds maximum allowed (4Gi)", [container.name, memory_limit])
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Gi")
  result := to_number(trim_suffix(memory_str, "Gi")) * 1024 * 1024 * 1024
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Mi")
  result := to_number(trim_suffix(memory_str, "Mi")) * 1024 * 1024
}

convert_memory_to_bytes(memory_str) = result {
  endswith(memory_str, "Ki")
  result := to_number(trim_suffix(memory_str, "Ki")) * 1024
}