terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "4.62.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

resource "aws_iam_user" "down-ytb" {
  name = "down-ytb"
}

resource "aws_iam_access_key" "down-ytb" {
  user = aws_iam_user.down-ytb.name
}

resource "aws_s3_bucket" "down-ytb" {
  bucket = "down-ytb"
}

resource "aws_s3_bucket_policy" "down-ytb" {
  bucket = aws_s3_bucket.down-ytb.id
  policy = data.aws_iam_policy_document.down-ytb-policy.json
}

data "aws_iam_policy_document" "down-ytb-policy" {
  statement {
    principals {
      type        = "*"
      identifiers = ["*"]
    }

    effect = "Allow"

    actions = [
      "s3:GetObject",
    ]

    resources = [
      aws_s3_bucket.down-ytb.arn,
      "${aws_s3_bucket.down-ytb.arn}/*",
    ]
  }
}

data "aws_iam_policy_document" "assume_role" {
  statement {
    effect = "Allow"

    principals {
      type        = "Service"
      identifiers = ["lambda.amazonaws.com"]
    }

    actions = ["sts:AssumeRole"]
  }
}

resource "aws_iam_role" "iam_for_lambda" {
  name               = "iam_for_lambda"
  assume_role_policy = data.aws_iam_policy_document.assume_role.json
}

resource "aws_lambda_function" "down-ytb" {
  function_name = "down-ytb"
  runtime       = "nodejs16.x"
  handler       = "app.handler"
  package_type  = "Image"
  image_uri     = "${aws_ecr_repository.down-ytb.repository_url}:latest"
  role          = aws_iam_role.iam_for_lambda.arn
  timeout       = 150
  environment {
    variables = {
      "accessKeyId"     = "${aws_iam_access_key.down-ytb.id}"
      "secretAccessKey" = "${aws_iam_access_key.down-ytb.secret}"
    }
  }
}

resource "aws_api_gateway_rest_api" "down-ytb" {
  name        = "down-ytb"
  description = "down-ytb lambda handler"
}

resource "aws_api_gateway_resource" "proxy" {
  rest_api_id = aws_api_gateway_rest_api.down-ytb.id
  parent_id   = aws_api_gateway_rest_api.down-ytb.root_resource_id
  path_part   = "{proxy+}"
}

resource "aws_api_gateway_method" "proxy" {
  rest_api_id   = aws_api_gateway_rest_api.down-ytb.id
  resource_id   = aws_api_gateway_resource.proxy.id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda" {
  rest_api_id = aws_api_gateway_rest_api.down-ytb.id
  resource_id = aws_api_gateway_method.proxy.resource_id
  http_method = aws_api_gateway_method.proxy.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.down-ytb.invoke_arn
}

resource "aws_api_gateway_method" "proxy_root" {
  rest_api_id   = aws_api_gateway_rest_api.down-ytb.id
  resource_id   = aws_api_gateway_rest_api.down-ytb.root_resource_id
  http_method   = "ANY"
  authorization = "NONE"
}

resource "aws_api_gateway_integration" "lambda_root" {
  rest_api_id = aws_api_gateway_rest_api.down-ytb.id
  resource_id = aws_api_gateway_method.proxy_root.resource_id
  http_method = aws_api_gateway_method.proxy_root.http_method

  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.down-ytb.invoke_arn
}

resource "aws_ecr_repository" "down-ytb" {
  name = "down-ytb"
}