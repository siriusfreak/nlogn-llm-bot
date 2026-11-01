IMAGE   := registry.i.siriusfrk.ru/nlogn-llm-bot
TAG     ?= $(shell git rev-parse HEAD)
NS      := nlogn-llm-bot
KUBECTL := kubectl --context microk8s

.PHONY: test build push diff deploy logs

test:
	npm test

# The tag is the commit sha, so refuse to build from a dirty tree.
build:
	@git diff --quiet HEAD || (echo "uncommitted changes: commit first, the image tag is the commit sha" && exit 1)
	docker build --platform linux/amd64 -t $(IMAGE):$(TAG) .

push: build
	docker push $(IMAGE):$(TAG)

diff:
	sed 's#$(IMAGE):TAG#$(IMAGE):$(TAG)#' k8s/deployment.yaml | $(KUBECTL) diff -f - || true

deploy:
	$(KUBECTL) apply -f k8s/namespace.yaml
	sed 's#$(IMAGE):TAG#$(IMAGE):$(TAG)#' k8s/deployment.yaml | $(KUBECTL) apply -f -
	$(KUBECTL) -n $(NS) rollout status deployment/nlogn-llm-bot --timeout=180s

logs:
	$(KUBECTL) -n $(NS) logs deploy/nlogn-llm-bot --tail=200 -f
