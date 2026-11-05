IMAGE   := registry.i.siriusfrk.ru/nlogn-llm-bot
TAG     ?= $(shell git rev-parse HEAD)
NS      := nlogn-llm-bot
KUBECTL := kubectl --context microk8s

.PHONY: test build push deploy logs

test:
	npm test

# The tag is the commit sha, so refuse to build from a dirty tree.
build:
	@git diff --quiet HEAD || (echo "uncommitted changes: commit first, the image tag is the commit sha" && exit 1)
	docker build --platform linux/amd64 -t $(IMAGE):$(TAG) .

push: build
	docker push $(IMAGE):$(TAG)

deploy:
	@echo "Manifests are k8s/nlogn-llm-bot in home-infrastructure: set the image tag to $(TAG), commit there, then Sync in Argo CD."

logs:
	$(KUBECTL) -n $(NS) logs deploy/nlogn-llm-bot --tail=200 -f
