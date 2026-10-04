variable "project_id" {
  description = "Google Cloud project ID"
  type        = string
}

variable "region" {
  description = "Google Cloud region"
  type        = string
}

variable "environment" {
  description = "Environment name (dev or prod). GitHub environment name と一致させる"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be 'dev' or 'prod'."
  }
}

variable "github_repo" {
  description = "GitHub repository in owner/repo format (e.g. kenyamaneko/unitoccata-editor)"
  type        = string
}

variable "billing_account_id" {
  description = "Google Cloud billing account ID (e.g. 012345-567890-ABCDEF)"
  type        = string
}

variable "monthly_budget_jpy" {
  description = "Monthly budget in JPY. Alerts fire at 50/100% of this amount."
  type        = number
}

variable "alert_email" {
  description = "Email address for budget alerts"
  type        = string
}

variable "pitr_enabled" {
  description = "Whether to enable Point-in-Time Recovery on the Firestore database"
  type        = bool
}
