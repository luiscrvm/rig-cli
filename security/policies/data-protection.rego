package data.protection

# Deny secrets in environment variables
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  env := container.env[_]
  contains_sensitive_data(env.name)
  msg := sprintf("Container %s has sensitive data in environment variable %s", [container.name, env.name])
}

# Require secrets to be mounted as volumes
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  env := container.env[_]
  env.valueFrom.secretKeyRef
  msg := sprintf("Container %s should mount secrets as volumes instead of environment variables", [container.name])
}

# Deny ConfigMaps with sensitive data patterns
deny[msg] {
  input.kind == "ConfigMap"
  key := input.data[_]
  contains_sensitive_pattern(key)
  msg := sprintf("ConfigMap contains potentially sensitive data in key: %s", [key])
}

contains_sensitive_data(env_name) {
  sensitive_patterns := ["PASSWORD", "SECRET", "TOKEN", "KEY", "CREDENTIAL"]
  pattern := sensitive_patterns[_]
  contains(upper(env_name), pattern)
}

contains_sensitive_pattern(value) {
  # Simple pattern matching for common sensitive data patterns
  regex.match("(?i)(password|secret|token|key)\s*[:=]\s*[a-zA-Z0-9+/=]{8,}", value)
}