output "ecr_repo_url" {
  description = "Lambda ECR's url"
  value       = aws_ecr_repository.down_ytb.repository_url
}