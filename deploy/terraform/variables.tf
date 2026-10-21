# The rokstones.io API backend: one small EC2 box that serves login,
# publishing and /me, and commits to a checkout of the index repo. The
# static pages go on Cloudflare Pages (deploy/cloudflare); this box is
# only the dynamic API, so it can be small.

variable "region" {
  description = "AWS region. us-east-1 by default; the API is used rarely (publishing), so latency matters little."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  type    = string
  default = "rokstones-api"
}

variable "instance_type" {
  description = "Small is plenty; the server is a static binary that occasionally runs git."
  type        = string
  default     = "t4g.small"
}

variable "domain" {
  description = "The host Caddy gets a certificate for, e.g. api.rokstones.io (or rokstones.io if this box also fronts the site)."
  type        = string
}

variable "admin_cidr" {
  description = "Where SSH (22) is allowed from. Never 0.0.0.0/0."
  type        = string
}

variable "key_name" {
  type = string
}

variable "root_gb" {
  type    = number
  default = 20
}
