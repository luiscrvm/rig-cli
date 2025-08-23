package container.security

# Deny containers running as root
deny[msg] {
  input.kind == "Pod"
  input.spec.securityContext.runAsUser == 0
  msg := "Container must not run as root user"
}

# Require security context
deny[msg] {
  input.kind == "Pod"
  not input.spec.securityContext
  msg := "Pod must have securityContext defined"
}

# Deny privileged containers
deny[msg] {
  input.kind == "Pod"
  input.spec.containers[_].securityContext.privileged == true
  msg := "Privileged containers are not allowed"
}

# Require readOnlyRootFilesystem
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.securityContext.readOnlyRootFilesystem
  msg := sprintf("Container %s must have readOnlyRootFilesystem set to true", [container.name])
}

# Deny containers with allowPrivilegeEscalation
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  container.securityContext.allowPrivilegeEscalation == true
  msg := sprintf("Container %s must not allow privilege escalation", [container.name])
}

# Require resource limits
deny[msg] {
  input.kind == "Pod"
  container := input.spec.containers[_]
  not container.resources.limits
  msg := sprintf("Container %s must have resource limits defined", [container.name])
}

# Deny hostNetwork
deny[msg] {
  input.kind == "Pod"
  input.spec.hostNetwork == true
  msg := "Pod must not use hostNetwork"
}

# Deny hostPID
deny[msg] {
  input.kind == "Pod"
  input.spec.hostPID == true
  msg := "Pod must not use hostPID"
}