data "external" "git" {
    program = [
        "git",
        "log",
        "--pretty=format:{ \"sha\": \"%H\" }",
        "-1",
        "HEAD"
    ]
}

locals {
    name = "nlogn-llm-bot"
    tag = data.external.git.result.sha
    image = "registry.i.siriusfrk.ru/${local.name}:${local.tag}"
}

resource "docker_image" "image" {
    name = local.image
    build {
        context    = ".."
        dockerfile = "deploy/Dockerfile"
        platform = "linux/amd64"
    }
}

resource "docker_registry_image" "pushed" {
    name = local.image
    depends_on = [docker_image.image]
    keep_remotely = false
}

resource "kubernetes_namespace" "nlogn-llm-bot" {
    metadata {
        name = local.name
    }
}


resource "kubernetes_deployment_v1" "nlogn-llm-bot" {
    metadata {
        name = local.name
        namespace = kubernetes_namespace.nlogn-llm-bot.metadata[0].name
    }

    spec {
        replicas = 1

        selector {
            match_labels = {
                app = local.name
            }
        }

        template {
            metadata {
                labels = {
                    app = local.name
                }
            }

            spec {
                node_selector = {
                    "siriusfrk.me/location" = "berlin"
                }
                container {
                    image = local.image
                    name = local.name
                    image_pull_policy = "Always"
                }
            }
        }
    }
}
