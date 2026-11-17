+++
title = "OpenTofu: Como iniciar no fork do terraform"
date = "2025-03-20T10:00:00-03:00"
draft = false
tags = ["infraestrutura", "iac", "devops", "opentofu", "terraform", "docker"]

[cover]
image = "capa.webp"
alt = "Terraform e OpenTofu lado a lado"
relative = true
+++

**O OpenTofu é um fork open source do Terraform, criado depois da mudança de licença da HashiCorp. Este guia mostra como instalar o OpenTofu e provisionar uma stack Docker local com três containers.**

## O que aconteceu com o Terraform?

Em agosto de 2023 a HashiCorp trocou a licença do Terraform da Mozilla Public License 2.0 pela Business Source License 1.1. Com a BSL o código continua visível, mas você não pode usar o Terraform pra oferecer um produto que concorra com a HashiCorp. Deixou de ser open source.

A sequência foi rápida:

- 10 de agosto de 2023: a HashiCorp anuncia a mudança pra BSL.
- 25 de agosto de 2023: sai o fork, ainda com o nome OpenTF.
- 20 de setembro de 2023: o projeto entra na Linux Foundation e passa a se chamar OpenTofu.
- 10 de janeiro de 2024: sai o OpenTofu 1.6.0, a primeira versão estável.

O OpenTofu partiu do último código do Terraform sob MPL e continua nessa licença. Pra quem já usa Terraform, muda pouco:

- o binário é `tofu` em vez de `terraform`, com os mesmos subcomandos
- a sintaxe HCL é a mesma
- o state e os módulos que você já tem funcionam sem conversão

## Instalação

### Linux (Ubuntu/Debian)
```bash
# Adicione a chave GPG e repositório
sudo wget -O- https://apt.releases.opentofu.org/opentofu.gpg | sudo gpg --dearmor -o /usr/share/keyrings/opentofu-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/opentofu-archive-keyring.gpg] https://apt.releases.opentofu.org $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/opentofu.list > /dev/null

# Instale
sudo apt-get update && sudo apt-get install opentofu
```

### macOS
```bash
brew install opentofu
```

### Windows
```powershell
choco install opentofu
```

Verifique a instalação com `tofu version`.

## Tutorial: stack Docker com três containers

O exemplo sobe três containers na mesma rede Docker: uma API Node.js, um MySQL e um Redis pra cache. Em nuvem o fluxo é igual, só muda o provider.

{{< figure src="docker-stack-architecture.webp" caption="Os três containers da stack e a rede que liga eles" >}}

### 1. Crie a estrutura do projeto

```bash
mkdir opentofu-docker-demo
cd opentofu-docker-demo
touch main.tf variables.tf outputs.tf
```

### 2. Configure o provedor Docker

Cole no arquivo `main.tf`:

```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0.0"
    }
  }
}

provider "docker" {}

# Rede para comunicação entre containers
resource "docker_network" "app_network" {
  name = "app_network"
}
```

### 3. Defina as variáveis

Cole no arquivo `variables.tf`:

```hcl
variable "mysql_root_password" {
  description = "Senha root do MySQL"
  type        = string
  default     = "rootpassword"
  sensitive   = true
}

variable "mysql_database" {
  description = "Nome do banco de dados"
  type        = string
  default     = "appdb"
}

variable "mysql_user" {
  description = "Usuário do banco de dados"
  type        = string
  default     = "appuser"
}

variable "mysql_password" {
  description = "Senha do usuário do banco de dados"
  type        = string
  default     = "apppassword"
  sensitive   = true
}

variable "app_port" {
  description = "Porta para a aplicação"
  type        = number
  default     = 8080
}
```

### 4. Crie os containers

Adicione ao arquivo `main.tf`:

```hcl
# Container MySQL
resource "docker_container" "mysql" {
  name  = "mysql"
  image = "mysql:8.0"
  
  networks_advanced {
    name = docker_network.app_network.name
  }
  
  env = [
    "MYSQL_ROOT_PASSWORD=${var.mysql_root_password}",
    "MYSQL_DATABASE=${var.mysql_database}",
    "MYSQL_USER=${var.mysql_user}",
    "MYSQL_PASSWORD=${var.mysql_password}"
  ]
  
  ports {
    internal = 3306
    external = 3306
  }
  
  volumes {
    host_path      = "${path.cwd}/mysql-data"
    container_path = "/var/lib/mysql"
  }
}

# Container Redis
resource "docker_container" "redis" {
  name  = "redis"
  image = "redis:alpine"
  
  networks_advanced {
    name = docker_network.app_network.name
  }
  
  ports {
    internal = 6379
    external = 6379
  }
  
  command = ["redis-server", "--appendonly", "yes"]
  
  volumes {
    host_path      = "${path.cwd}/redis-data"
    container_path = "/data"
  }
}

# Container da Aplicação
resource "docker_container" "app" {
  name  = "app"
  image = "node:14-alpine"
  
  networks_advanced {
    name = docker_network.app_network.name
  }
  
  ports {
    internal = 3000
    external = var.app_port
  }
  
  env = [
    "MYSQL_HOST=mysql",
    "MYSQL_USER=${var.mysql_user}",
    "MYSQL_PASSWORD=${var.mysql_password}",
    "MYSQL_DATABASE=${var.mysql_database}",
    "REDIS_HOST=redis"
  ]
  
  # Mantém o container rodando
  command = ["sh", "-c", "echo 'App is running on port ${var.app_port}...' && tail -f /dev/null"]
  
  depends_on = [
    docker_container.mysql,
    docker_container.redis
  ]
}
```

### 5. Configure os outputs

Cole no arquivo `outputs.tf`:

```hcl
output "app_container_ip" {
  value = docker_container.app.network_data[0].ip_address
}

output "mysql_container_ip" {
  value = docker_container.mysql.network_data[0].ip_address
}

output "redis_container_ip" {
  value = docker_container.redis.network_data[0].ip_address
}

output "app_access_url" {
  value = "http://localhost:${var.app_port}"
}
```

### 6. Execute o OpenTofu

Agora roda:

```bash
# Inicializar
tofu init

# Verificar mudanças
tofu plan

# Criar a infraestrutura
tofu apply -auto-approve
```

{{< figure src="opentofu-apply-output.webp" caption="Saída do tofu apply com os containers criados" >}}

### Verificando a infraestrutura

```bash
docker ps
```

Os três containers aparecem na lista. Pra destruir tudo:

```bash
tofu destroy -auto-approve
```

## Depois disso

Isso é só o básico. O resto do que você já usa no Terraform continua valendo: providers de AWS, GCP e Azure, módulos, workspaces, backend remoto e `import` de recurso existente.

O OpenTofu lê o mesmo formato de state, então não tem migração pra fazer: é rodar `tofu init` no diretório que já existe. Os providers e módulos vêm do registry do próprio OpenTofu, que espelha o que está publicado pro Terraform.

## Recursos

- [Site oficial do OpenTofu](https://opentofu.org/)
- [Repositório GitHub do OpenTofu](https://github.com/opentofu/opentofu)
- [Documentação do provedor Docker](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs)
- [Anúncio da mudança de licença da HashiCorp](https://www.hashicorp.com/blog/hashicorp-adopts-business-source-license)
- [Anúncio do OpenTofu pela Linux Foundation](https://www.linuxfoundation.org/press/announcing-opentofu)
