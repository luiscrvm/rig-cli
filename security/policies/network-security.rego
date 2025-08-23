package network.security

# Deny pods without network policies
deny[msg] {
  input.kind == "Pod"
  not has_network_policy
  msg := "Pod must be covered by a NetworkPolicy"
}

# Require specific labels for network policy selection
deny[msg] {
  input.kind == "NetworkPolicy"
  not input.spec.podSelector.matchLabels.app
  msg := "NetworkPolicy must select pods using 'app' label"
}

# Deny allowing all ingress traffic
deny[msg] {
  input.kind == "NetworkPolicy"
  count(input.spec.ingress) > 0
  ingress := input.spec.ingress[_]
  not ingress.from
  msg := "NetworkPolicy must not allow all ingress traffic"
}

# Deny allowing all egress traffic
deny[msg] {
  input.kind == "NetworkPolicy"
  count(input.spec.egress) > 0
  egress := input.spec.egress[_]
  not egress.to
  msg := "NetworkPolicy must not allow all egress traffic"
}

has_network_policy {
  input.kind == "Pod"
  # This would typically check against existing NetworkPolicies
  # In practice, this would be implemented with OPA's data documents
  true
}