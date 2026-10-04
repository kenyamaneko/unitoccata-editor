terraform {
  required_version = ">= 1.5"

  # dev/prod は別 Google Cloud プロジェクトのため bucket を静的に書けない。
  # 環境ごとの値は `terraform init -backend-config=environments/<env>/backend.gcs.tfbackend` で渡す。
  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 6.0"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.0"
    }
  }
}

provider "google" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

provider "google-beta" {
  project               = var.project_id
  region                = var.region
  user_project_override = true
  billing_project       = var.project_id
}

# 認証は環境変数 GITHUB_TOKEN で渡す。
provider "github" {
  owner = split("/", var.github_repo)[0]
}

# 請求先の紐付けと予算に必要な API。請求先を紐付ける前でも有効化できる。
resource "google_project_service" "bootstrap" {
  for_each = toset([
    "cloudresourcemanager.googleapis.com",
    "serviceusage.googleapis.com",
    "cloudbilling.googleapis.com",
    "billingbudgets.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

resource "google_billing_project_info" "default" {
  project         = var.project_id
  billing_account = var.billing_account_id

  depends_on = [google_project_service.bootstrap]
}

# Terraform の state の置き場所。最初の適用だけローカルの state で行い、その後この bucket へ移す。
resource "google_storage_bucket" "tfstate" {
  project                     = var.project_id
  name                        = "${var.project_id}-tfstate"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  versioning {
    enabled = true
  }

  depends_on = [google_billing_project_info.default]
}

resource "google_project_service" "apis" {
  for_each = toset([
    "firebase.googleapis.com",
    "firebasehosting.googleapis.com",
    "firebasestorage.googleapis.com",
    "firestore.googleapis.com",
    "firebaserules.googleapis.com",
    "identitytoolkit.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "monitoring.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false

  depends_on = [google_billing_project_info.default]
}

resource "google_firebase_project" "default" {
  provider = google-beta
  project  = var.project_id

  depends_on = [google_project_service.apis]
}

resource "google_firebase_web_app" "editor" {
  provider     = google-beta
  project      = var.project_id
  display_name = "UniToccata Editor (${var.environment})"

  depends_on = [google_firebase_project.default]
}

data "google_firebase_web_app_config" "editor" {
  provider   = google-beta
  project    = var.project_id
  web_app_id = google_firebase_web_app.editor.app_id
}

resource "google_firebase_hosting_site" "default" {
  provider = google-beta
  project  = var.project_id
  site_id  = var.project_id

  depends_on = [google_firebase_project.default]
}

# 利用者が曲のフォルダを保存する Cloud Storage。
resource "google_storage_bucket" "storage" {
  project                     = var.project_id
  name                        = "${var.project_id}-storage"
  location                    = var.region
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"

  depends_on = [google_project_service.apis]
}

resource "google_firebase_storage_bucket" "storage" {
  provider  = google-beta
  project   = var.project_id
  bucket_id = google_storage_bucket.storage.name

  depends_on = [google_firebase_project.default]
}

# 規則は結合テストが読む storage.rules と同じファイルを使う。
resource "google_firebaserules_ruleset" "storage" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "storage.rules"
      content = file("${path.module}/../storage.rules")
    }
  }

  depends_on = [google_firebase_storage_bucket.storage]
}

resource "google_firebaserules_release" "storage" {
  provider     = google-beta
  project      = var.project_id
  name         = "firebase.storage/${google_storage_bucket.storage.name}"
  ruleset_name = google_firebaserules_ruleset.storage.name
}

# 利用者のプロジェクト情報と譜面 (users/{uid}/projects) を保存する Firestore。音源は上の Cloud Storage に置く。
resource "google_firestore_database" "default" {
  provider    = google-beta
  project     = var.project_id
  name        = "(default)"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  # 誤操作・不具合による書き込み破損時に、直近7日以内の任意時点へ復元できるようにする。
  # dev は使い捨てデータのため対象外にし、ストレージ課金の増加を避ける。
  point_in_time_recovery_enablement = var.pitr_enabled ? "POINT_IN_TIME_RECOVERY_ENABLED" : "POINT_IN_TIME_RECOVERY_DISABLED"

  depends_on = [google_project_service.apis]
}

# 規則は結合テストが読む firestore.rules と同じファイルを使う。
resource "google_firebaserules_ruleset" "firestore" {
  provider = google-beta
  project  = var.project_id

  source {
    files {
      name    = "firestore.rules"
      content = file("${path.module}/../firestore.rules")
    }
  }

  depends_on = [google_firestore_database.default]
}

resource "google_firebaserules_release" "firestore" {
  provider     = google-beta
  project      = var.project_id
  name         = "cloud.firestore"
  ruleset_name = google_firebaserules_ruleset.firestore.name

  depends_on = [google_firebaserules_ruleset.firestore]
}

# Authentication の初期化と Google でのログイン (google.com IdP) の有効化は Terraform 管理外。
# client_secret を Terraform 変数経由で渡すと tfstate に平文で残り iac.md に反するため、コンソールで設定する。

resource "google_iam_workload_identity_pool" "github" {
  project                   = var.project_id
  workload_identity_pool_id = "github-actions"
  display_name              = "GitHub Actions"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  project                            = var.project_id
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"

  attribute_mapping = {
    "google.subject"        = "assertion.sub"
    "attribute.repository"  = "assertion.repository"
    "attribute.environment" = "assertion.environment"
  }

  # この環境名の GitHub 環境で動くワークフローだけを通す。
  attribute_condition = "assertion.repository == \"${var.github_repo}\" && assertion.environment == \"${var.environment}\""

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account" "github_actions" {
  project      = var.project_id
  account_id   = "github-actions-deploy"
  display_name = "GitHub Actions Deploy (${var.environment})"

  depends_on = [google_project_service.apis]
}

resource "google_service_account_iam_member" "github_actions_wif" {
  service_account_id = google_service_account.github_actions.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repo}"
}

resource "google_project_iam_member" "github_actions_firebase_hosting" {
  project = var.project_id
  role    = "roles/firebasehosting.admin"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_project_iam_member" "github_actions_service_usage" {
  project = var.project_id
  role    = "roles/serviceusage.serviceUsageConsumer"
  member  = "serviceAccount:${google_service_account.github_actions.email}"
}

resource "google_monitoring_notification_channel" "email" {
  project      = var.project_id
  display_name = "予算アラートの宛先 (${var.environment})"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  depends_on = [google_project_service.apis]
}

data "google_project" "current" {
  project_id = var.project_id
}

# 想定外のコストを早く知るためのメール通知。自動停止はしない。
resource "google_billing_budget" "monthly" {
  billing_account = var.billing_account_id
  display_name    = "unitoccata-editor-${var.environment}-budget"

  # budget_filter.projects は projects/PROJECT_NUMBER 形式 (PROJECT_ID ではない)
  budget_filter {
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      currency_code = "JPY"
      units         = var.monthly_budget_jpy
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.email.id]
  }

  depends_on = [google_billing_project_info.default]
}

resource "github_repository_environment" "this" {
  repository  = split("/", var.github_repo)[1]
  environment = var.environment
}

# ワークフローが vars.* で読む値。
resource "github_actions_environment_variable" "this" {
  for_each = {
    FIREBASE_PROJECT_ID     = var.project_id
    FIREBASE_API_KEY        = data.google_firebase_web_app_config.editor.api_key
    FIREBASE_AUTH_DOMAIN    = data.google_firebase_web_app_config.editor.auth_domain
    FIREBASE_STORAGE_BUCKET = google_storage_bucket.storage.name
    FIREBASE_APP_ID         = google_firebase_web_app.editor.app_id
    WIF_PROVIDER            = google_iam_workload_identity_pool_provider.github.name
    WIF_SERVICE_ACCOUNT     = google_service_account.github_actions.email
  }

  repository    = github_repository_environment.this.repository
  environment   = github_repository_environment.this.environment
  variable_name = each.key
  value         = each.value
}
