terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.43.0"
    }
  }
}

provider "aws" {
  region = "sa-east-1"
}

resource "aws_s3_bucket" "down_ytb" {
  bucket = var.projectName
}


data "aws_iam_policy_document" "allow_all_s3" {
  statement {
    effect = "Allow"
    principals {
      type        = "*"
      identifiers = ["*"]
    }

    actions   = ["s3:*"]
    resources = ["arn:aws:s3:::*"]
  }
}

resource "aws_s3_bucket_public_access_block" "remove_restrictions" {
  bucket                  = aws_s3_bucket.down_ytb.id
  block_public_policy     = false
  restrict_public_buckets = false
  block_public_acls       = true
  ignore_public_acls      = true
}

resource "aws_s3_bucket_policy" "allow_all" {
  bucket = aws_s3_bucket.down_ytb.id
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = "*",
        Action = [
          "s3:*",
        ],
        Resource = [
          "${aws_s3_bucket.down_ytb.arn}",
          "${aws_s3_bucket.down_ytb.arn}/*"
        ]
      }
    ]
  })
  depends_on = [
    aws_s3_bucket_public_access_block.remove_restrictions
  ]
}

data "aws_iam_policy_document" "lambda_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "lambda_role" {
  name               = "iam_for_lambda_${var.projectName}"
  assume_role_policy = data.aws_iam_policy_document.lambda_role.json
}

resource "aws_ecr_repository" "down_ytb" {
  name = var.projectName
  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_lambda_function" "down_ytb" {
  function_name = var.projectName
  role          = aws_iam_role.lambda_role.arn
  image_uri     = aws_ecr_repository.down_ytb.repository_url
  package_type  = "Image"
  runtime       = "nodejs16.x"
}

resource "aws_apigatewayv2_api" "down_ytb" {
  name          = "http-api"
  protocol_type = "HTTP"
  target        = aws_lambda_function.down_ytb.arn
}