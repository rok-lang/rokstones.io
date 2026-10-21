output "public_ip" {
  value       = aws_eip.api.public_ip
  description = "Point the API host's A record here, then run deploy/deploy.sh."
}

output "ssh" {
  value = "ssh ubuntu@${aws_eip.api.public_ip}"
}
