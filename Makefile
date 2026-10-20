.PHONY: help image run-docker build clean all k3s-deploy k3s-status k3s-logs

help: ## Show this help menu
	@echo 'Usage: make [TARGET]'
	@echo ''
	@echo 'Targets:'
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build the Hugo site
	@echo "Building Hugo site..."
	git submodule update --init --recursive
	hugo

image: build ## Build the Nginx Docker image (after building Hugo site)
	@echo "Building Docker image..."
	docker build -t leandrosf-website:latest .

run-docker: ## Run the Docker Compose setup
	@echo "Starting Docker Compose services..."
	docker-compose up -d

clean: ## Clean generated files
	@echo "Cleaning generated files..."
	rm -rf public
	
all: clean build image run-docker ## Build everything and run 

# Production is k3s on alcserver000. The server pulls this repo and builds
# Hugo, the image and the manifests there, so only pushed commits deploy.
K3S_HOST ?= rocky@alcserver000
K3S_DIR  ?= /root/leandrosf.com
KUBECTL  := sudo /usr/local/bin/k3s kubectl -n leandrosf

k3s-deploy: ## Push main and deploy it to k3s
	git push origin main
	ssh $(K3S_HOST) 'sudo -n sh -c "cd $(K3S_DIR) && git pull --ff-only -q && deploy/k3s/deploy.sh"'

k3s-status: ## Pods and ingress of the site in k3s
	ssh $(K3S_HOST) "$(KUBECTL) get pods,ingress -o wide"

k3s-logs: ## Last log lines of the site in k3s
	ssh $(K3S_HOST) "$(KUBECTL) logs deploy/website --tail 100"
