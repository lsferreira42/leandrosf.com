.PHONY: help image run-docker build clean

help: ## Show this help menu
	@echo 'Usage: make [TARGET]'
	@echo ''
	@echo 'Targets:'
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Build the Hugo site
	@echo "Building Hugo site..."
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