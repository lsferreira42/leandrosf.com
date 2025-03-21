+++
title = "Introdução ao OpenTofu: Alternativa Open Source ao Terraform"
date = "2025-03-20T10:00:00-03:00"
draft = false
tags = ["infraestrutura", "iac", "devops", "opentofu", "terraform", "docker"]
+++

## O que é Terraform?

O Terraform é uma ferramenta de Infraestrutura como Código (IaC) desenvolvida pela HashiCorp em 2014. Ela permite que você defina recursos de infraestrutura em arquivos de configuração que podem ser versionados, reutilizados e compartilhados. Com o Terraform, é possível criar, modificar e versionar infraestrutura de forma segura e eficiente.

Características principais do Terraform:

- **Declarativo:** Você descreve o estado desejado da sua infraestrutura, e o Terraform se encarrega de realizar as ações necessárias para alcançá-lo.
- **Multiplataforma:** Suporta diversos provedores de nuvem (AWS, GCP, Azure) e serviços (Docker, Kubernetes, etc).
- **Planos de Execução:** Permite visualizar mudanças antes de aplicá-las.
- **Grafos de Dependência:** Cria automaticamente grafos de dependências entre recursos.

## O Conflito na Comunidade Terraform

Em agosto de 2023, a HashiCorp anunciou uma mudança significativa na licença do Terraform e de outros produtos da empresa, migrando da licença Mozilla Public License v2.0 (MPL 2.0) para a Business Source License (BUSL 1.1). Esta alteração removeu a natureza completamente open source do Terraform.

A mudança gerou preocupações na comunidade por diversos motivos:

1. **Restrições de uso:** A BUSL limita o uso comercial do código em certos contextos.
2. **Incerteza jurídica:** Empresas passaram a questionar como a nova licença afetaria seus fluxos de trabalho.
3. **Dependência de fornecedor:** Aumentou a dependência da comunidade em relação às decisões da HashiCorp.

Este movimento criou uma divisão na comunidade, pois muitos usuários e empresas dependiam do Terraform como solução open source para suas necessidades de infraestrutura como código.

## OpenTofu: O Fork da Comunidade

Como resposta à mudança de licença, a Linux Foundation, com apoio de empresas como Gruntwork, Spacelift e muitas outras, anunciou a criação do projeto OpenTofu. Este projeto é um fork do Terraform, mantendo-se sob a licença MPL 2.0, garantindo que continue sendo verdadeiramente open source.

O OpenTofu mantém compatibilidade com o ecossistema Terraform existente, incluindo:

- Compatibilidade com arquivos de estado do Terraform
- Suporte a provedores do Terraform Registry
- Compatibilidade com módulos existentes

Este fork representa um esforço da comunidade para preservar uma alternativa genuinamente open source para o gerenciamento de infraestrutura como código.

## Instalando o OpenTofu

Vamos ver como instalar o OpenTofu em diferentes sistemas operacionais:

### Linux

Para distribuições baseadas em Debian/Ubuntu:

```bash
# Adicione a chave GPG
sudo wget -O- https://apt.releases.opentofu.org/opentofu.gpg | sudo gpg --dearmor -o /usr/share/keyrings/opentofu-archive-keyring.gpg

# Adicione o repositório
echo "deb [signed-by=/usr/share/keyrings/opentofu-archive-keyring.gpg] https://apt.releases.opentofu.org $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/opentofu.list > /dev/null

# Atualize e instale
sudo apt-get update && sudo apt-get install opentofu
```

Para Red Hat/Fedora:

```bash
# Adicione o repositório
sudo tee /etc/yum.repos.d/opentofu.repo << 'EOF'
[opentofu]
name=OpenTofu
baseurl=https://yum.releases.opentofu.org/yum/
enabled=1
gpgcheck=1
gpgkey=https://yum.releases.opentofu.org/gpg
EOF

# Instale
sudo yum install -y opentofu
```

### macOS

Usando Homebrew:

```bash
brew install opentofu
```

### Windows

Usando Chocolatey:

```powershell
choco install opentofu
```

Ou baixe o binário diretamente do [repositório oficial](https://github.com/opentofu/opentofu/releases) e adicione ao PATH.

## Verificando a instalação

Para confirmar que o OpenTofu foi instalado corretamente:

```bash
tofu version
```

Você deverá ver algo como:

```
OpenTofu v1.6.0
on darwin_amd64
```

## Criando Infraestrutura Docker com OpenTofu

Vamos criar uma infraestrutura Docker contendo três containers: uma aplicação, um banco de dados MySQL e um Redis para cache. Este exemplo simples demonstra como o OpenTofu pode ser usado para gerenciar infraestrutura local.

### 1. Estrutura do Projeto

Crie uma pasta para o projeto e os arquivos necessários:

```bash
mkdir opentofu-docker-demo
cd opentofu-docker-demo
touch main.tf variables.tf outputs.tf
```

### 2. Configurando o Provedor Docker

Edite o arquivo `main.tf` para configurar o provedor Docker:

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

# Criar uma rede Docker para comunicação entre containers
resource "docker_network" "app_network" {
  name = "app_network"
}
```

### 3. Definindo Variáveis

Edite o arquivo `variables.tf` para definir as variáveis que usaremos:

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

### 4. Criando os Containers

Adicione ao `main.tf` a definição dos três containers:

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

# Container da Aplicação (usando uma imagem Node.js simples como exemplo)
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
  
  # Este comando mantém o container rodando (em produção, você executaria sua aplicação real)
  command = ["sh", "-c", "echo 'App is running...' && tail -f /dev/null"]
  
  depends_on = [
    docker_container.mysql,
    docker_container.redis
  ]
}
```

### 5. Definindo Outputs

Edite o arquivo `outputs.tf` para exibir informações úteis após a criação:

```hcl
output "app_container_ip" {
  value = docker_container.app.ip_address
}

output "mysql_container_ip" {
  value = docker_container.mysql.ip_address
}

output "redis_container_ip" {
  value = docker_container.redis.ip_address
}

output "app_access_url" {
  value = "http://localhost:${var.app_port}"
}
```

### 6. Executando o OpenTofu

Agora, vamos usar o OpenTofu para criar nossa infraestrutura:

```bash
# Inicializar o diretório de trabalho
tofu init

# Ver o plano de mudanças
tofu plan

# Aplicar as mudanças
tofu apply

# Para confirmar, digite "yes"
```

### 7. Verificando a Infraestrutura

Após a execução bem-sucedida, você pode verificar se os containers foram criados:

```bash
docker ps
```

Você deverá ver três containers rodando: app, mysql e redis.

### 8. Removendo a Infraestrutura

Quando terminar de usar a infraestrutura, você pode removê-la com:

```bash
tofu destroy
# Para confirmar, digite "yes"
```

## Conclusão

O OpenTofu surge como uma alternativa viável ao Terraform, mantendo a natureza open source que muitos usuários valorizam. Neste post, vimos como o projeto nasceu a partir de um conflito de licenciamento, como instalá-lo em diferentes sistemas e como usá-lo para gerenciar uma infraestrutura Docker simples.

Essa infraestrutura demonstra apenas uma pequena parte do que é possível fazer com OpenTofu. O ecossistema permite gerenciar desde ambientes locais até complexas arquiteturas multi-cloud com a mesma facilidade e sintaxe declarativa.

À medida que o projeto evolui, espera-se que a comunidade contribua com novos recursos e melhorias, mantendo a ferramenta atualizada e relevante no dinâmico mundo da infraestrutura como código.

## Referências

- [Site oficial do OpenTofu](https://opentofu.org/)
- [Repositório GitHub do OpenTofu](https://github.com/opentofu/opentofu)
- [Documentação do provedor Docker](https://registry.terraform.io/providers/kreuzwerker/docker/latest/docs)
- [Anúncio sobre a mudança de licença da HashiCorp](https://www.hashicorp.com/blog/hashicorp-adopts-business-source-license) 