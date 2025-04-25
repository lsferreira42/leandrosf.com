+++
title = "OpenTofu: Como iniciar no fork do terraform"
date = "2025-03-20T10:00:00-03:00"
draft = false
tags = ["infraestrutura", "iac", "devops", "opentofu", "terraform", "docker"]
+++

![OpenTofu vs Terraform](/images/opentofu-terraform.png)

**Se você usa Terraform e está preocupado com a mudança de licença da HashiCorp, o OpenTofu é a solução. Neste guia, você aprenderá a migrar para o OpenTofu e criar infraestrutura com Docker em menos de 10 minutos.**

## O que aconteceu com o Terraform?

Em agosto de 2023, a HashiCorp mudou a licença do Terraform de Mozilla Public License (open source) para Business Source License (proprietária). Isso causou preocupação em empresas e desenvolvedores que dependiam da natureza aberta da ferramenta.

{{< figure src="/images/license-change-timeline.png" caption="Timeline da mudança de licença do Terraform" >}}

Como resposta, a Linux Foundation e várias empresas criaram o **OpenTofu**, um fork 100% compatível com o Terraform que mantém a licença open source original.

### O que você precisa saber sobre o OpenTofu:

1. É um drop-in replacement (substituto direto) do Terraform
2. Mantém a mesma sintaxe e comandos (apenas troque `terraform` por `tofu`)
3. Funciona com seu estado e módulos Terraform existentes
4. Continua sendo open source sob a licença MPL 2.0

## Instalação rápida em qualquer sistema

Escolha seu sistema operacional:

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

Verifique a instalação com `tofu version`. Viu como é fácil?

## Tutorial prático: Crie uma stack Docker completa em 5 minutos

Vamos criar três containers interconectados usando OpenTofu: uma API Node.js, um banco de dados MySQL e um Redis para cache. Este exemplo demonstra como o OpenTofu gerencia facilmente infraestrutura local ou em nuvem.

{{< figure src="/images/docker-stack-architecture.png" caption="Arquitetura da stack Docker que vamos criar" >}}

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

Agora, execute:

```bash
# Inicializar
tofu init

# Verificar mudanças
tofu plan

# Criar a infraestrutura
tofu apply -auto-approve
```

{{< figure src="/images/opentofu-apply-output.png" caption="Saída do comando tofu apply mostrando a criação bem-sucedida dos containers" >}}

### Verificando a infraestrutura

```bash
docker ps
```

Pronto! Você acabou de criar uma stack Docker completa com OpenTofu. Para destruir, execute `tofu destroy -auto-approve`.

## Próximos passos

Este tutorial cobriu apenas o básico do OpenTofu. A ferramenta suporta todos os recursos do Terraform que você já conhece:

- Gerenciamento de múltiplas clouds (AWS, GCP, Azure)
- Módulos reutilizáveis e composições
- Workspaces para ambientes isolados
- Backends remotos para colaboração em equipe
- Importação de recursos existentes

## Dúvidas frequentes

**P: Preciso migrar meus arquivos de estado?**  
R: Não! O OpenTofu usa o mesmo formato de arquivo de estado do Terraform.

**P: Os módulos do Terraform Registry funcionam?**  
R: Sim, todos os módulos e provedores do ecossistema Terraform são compatíveis.

**P: O OpenTofu tem suporte comercial?**  
R: Sim, várias empresas como Spacelift e Gruntwork oferecem suporte para OpenTofu.

**P: É seguro usar em produção?**  
R: Absolutamente! Grandes empresas já migraram suas cargas de trabalho para o OpenTofu.

## Recursos

- [Site oficial do OpenTofu](https://opentofu.org/)
- [Repositório GitHub do OpenTofu](https://github.com/opentofu/opentofu)
- [Documentação do provedor Docker](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs)
- [Anúncio sobre a mudança de licença da HashiCorp](https://www.hashicorp.com/blog/hashicorp-adopts-business-source-license)
- [OpenTofu vs. Terraform: Análise completa](https://opensource.com/article/23/10/opentofu-terraform-fork) 