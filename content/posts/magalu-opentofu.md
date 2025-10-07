+++
date = '2025-04-25T21:10:00-03:00'
draft = false
title = 'Introdução ao módulo Terraform da Magalu Cloud com o OpenTofu'
tags = ["infraestrutura","iac","devops","magalucloud","opentofu","terraform"]
+++

![Magalu Cloud + OpenTofu](/images/magalu-opentofu.png)

**Com OpenTofu e os módulos oficiais da Magalu Cloud, você provisiona recursos em minutos, mantendo sua infraestrutura como código 100% open source. Neste post vamos explorar diversas opções do provider MGC e usar a variável de ambiente `MAGALU_API_KEY` para fornecer sua chave de API de forma segura.**

## O que é OpenTofu?

OpenTofu é um fork open source do Terraform, mantendo 100% de compatibilidade com a linguagem HCL e workflows existentes. Após a mudança de licença do Terraform para BSL, o OpenTofu surgiu como alternativa totalmente open source sob a licença MPL 2.0, sendo adotado pela Linux Foundation.

## Antes de começar

Para usar o OpenTofu com a Magalu Cloud, você precisa:

1. [Criar uma conta na Magalu Cloud](https://www.magalucloud.com.br)
2. Gerar uma API Key no painel da Magalu Cloud (Dashboard > Perfil > API Keys)
3. [Instalar o OpenTofu](https://opentofu.org/docs/intro/install/)
4. [Criar uma chave SSH](https://docs.magalu.cloud/docs/computing/virtual-machine/how-to/instances/gen-ssh-key-instance) e adicionar à sua conta

Defina a variável de ambiente com sua API Key:

```bash
export TF_VAR_mgc_api_key="sua api key aqui"
```

Caso queira pode definir também a variável para o nome da chave SSH:

```bash
export TF_VAR_ssh_key_name=mac-pessoal
```

## Estrutura do projeto

Vamos organizar nosso projeto com a seguinte estrutura:

```
magalu-opentofu-demo/
├── providers.tf       # Configuração do provider Magalu Cloud
├── variables.tf       # Definição das variáveis
├── vm.tf              # Configuração de máquinas virtuais
├── storage.tf         # Configuração de volumes e armazenamento
├── bucket.tf          # Configuração de object storage
├── k8s.tf             # Configuração de clusters Kubernetes
├── database.tf        # Configuração de bancos de dados
└── outputs.tf         # Outputs para informações importantes
```

Crie uma pasta para o projeto e os arquivos necessários:

```bash
mkdir magalu-opentofu-demo
cd magalu-opentofu-demo
touch providers.tf variables.tf vm.tf storage.tf bucket.tf k8s.tf database.tf outputs.tf
```

## Configurando o Provider Magalu Cloud

Crie `providers.tf` apontando ao provider MGC e usando a variável `mgc_api_key`:

```hcl
terraform {
  required_providers {
    mgc = {
      source  = "registry.terraform.io/MagaluCloud/mgc"
      version = "~> 1.0.0"
    }
  }
}

# Provider principal na região Sudeste (São Paulo)
provider "mgc" {
  alias   = "sudeste"
  region  = "br-se1"
  api_key = var.mgc_api_key
}

# Provider adicional na região Nordeste (opcional)
provider "mgc" {
  alias   = "nordeste"
  region  = "br-ne1"
  api_key = var.mgc_api_key
}
```

Em `variables.tf`, declare as variáveis necessárias:

```hcl
variable "mgc_api_key" {
  description = "API Key da Magalu Cloud via variável de ambiente MAGALU_API_KEY"
  type        = string
  sensitive   = true
}

variable "ssh_key_name" {
  description = "Nome da chave SSH cadastrada na Magalu Cloud"
  type        = string
}

variable "project_name" {
  description = "Nome do projeto para identificação dos recursos"
  type        = string
  default     = "opentofu-demo"
}

variable "vm_tags" {
  description = "Tags para as VMs criadas"
  type        = map(string)
  default = {
    environment = "development"
    managed_by  = "opentofu"
    project     = "demo"
  }
}
```

## 1. Criando Máquinas Virtuais

No arquivo `vm.tf`, vamos criar diferentes tipos de VMs utilizando os recursos do MGC:

```hcl
# VM básica Ubuntu
resource "mgc_virtual_machine_instances" "vm_basica" {
  provider     = mgc.sudeste
  name         = "${var.project_name}-vm-ubuntu"
  machine_type = "BV1-1-40"
  image        = "cloud-ubuntu-24.04 LTS"
  ssh_key_name = var.ssh_key_name
}

# VM com script de inicialização (user data)
resource "mgc_virtual_machine_instances" "vm_com_userdata" {
  provider     = mgc.sudeste
  name         = "${var.project_name}-vm-userdata"
  machine_type = "BV4-8-100"
  image        = "cloud-ubuntu-24.04 LTS"
  ssh_key_name = var.ssh_key_name
  # coloque um ip publico para acessar a VM
  user_data    = base64encode(<<-EOF
    #!/bin/bash
    apt update
    apt install -y nginx
    echo "<h1>Hello from Magalu Cloud + OpenTofu!</h1>" > /var/www/html/index.html
    systemctl enable nginx
    systemctl start nginx
  EOF
  )
}

```

## 2. Criando Volumes de Armazenamento

No arquivo `storage.tf`, vamos configurar volumes para armazenamento de bloco:

```hcl
# Criando um volume de armazenamento de bloco
resource "mgc_block_storage_volumes" "data_volume" {
  provider = mgc.sudeste
  name     = "${var.project_name}-data-volume"
  size     = 10
  type     = "cloud_nvme"
}

# Anexando o volume a uma VM
resource "mgc_block_storage_volume_attachment" "data_attachment" {
  provider          = mgc.sudeste
  block_storage_id  = mgc_block_storage_volumes.data_volume.id
  virtual_machine_id = mgc_virtual_machine_instances.vm_basica.id
}

# Volume adicional para backups
resource "mgc_block_storage_volumes" "backup_volume" {
  provider    = mgc.sudeste
  name        = "${var.project_name}-backup-volume"
  size        = 50
  type        = "cloud_nvme"
  description = "Volume para armazenamento de backups"
}

# Output para o ID do volume
output "data_volume_id" {
  value = mgc_block_storage_volumes.data_volume.id
}

# Exemplo de como referenciar um volume existente
# Descomente e ajuste conforme necessário
# data "terraform_remote_state" "existing_volumes" {
#   backend = "local"
#   config = {
#     path = "../existing-infra/terraform.tfstate"
#   }
# }
# 
# resource "mgc_block_storage_volume_attachment" "existing_volume_attachment" {
#   provider          = mgc.sudeste
#   block_storage_id  = data.terraform_remote_state.existing_volumes.outputs.existing_volume_id
#   virtual_machine_id = mgc_virtual_machine_instances.vm_windows.id
# }
```

## 3. Criando Buckets de Object Storage

Em `bucket.tf`, vamos configurar objetos de armazenamento:

```hcl
# Bucket básico
resource "mgc_object_storage_buckets" "my_bucket" {
  provider          = mgc.sudeste
  bucket            = "${var.project_name}-storage"
  enable_versioning = true
  recursive         = true  # Aplica configurações aos objetos dentro do bucket
  bucket_is_prefix  = false # Indica se o nome do bucket será usado como prefixo
}

# Bucket com configurações avançadas
resource "mgc_object_storage_buckets" "logs_bucket" {
  provider          = mgc.sudeste
  bucket            = "${var.project_name}-logs"
  enable_versioning = false
  
  # Configuração para objetos expirarem após um período
  lifecycle_rules {
    enabled = true
    id      = "delete-old-logs"
    
    expiration {
      days = 14
    }
  }
}

# Upload de um objeto para o bucket
resource "mgc_object_storage_object" "index_html" {
  provider     = mgc.sudeste
  bucket       = mgc_object_storage_buckets.my_bucket.bucket
  key          = "index.html"
  content      = "<html><body><h1>Hello from Magalu Cloud!</h1></body></html>"
  content_type = "text/html"
}
```

## 4. Criando um Cluster Kubernetes

No `k8s.tf`, vamos criar um cluster Kubernetes:

```hcl
# Cluster Kubernetes
resource "mgc_kubernetes_cluster" "cluster_demo" {
  provider             = mgc.sudeste
  name                 = "${var.project_name}-cluster"
  version              = "v1.30.2"
  enabled_server_group = false
  description          = "Cluster Kubernetes para aplicações de demonstração"
}

# NodePool de uso geral
resource "mgc_kubernetes_nodepool" "nodepool_gp1" {
  provider    = mgc.sudeste
  depends_on  = [mgc_kubernetes_cluster.cluster_demo]
  name        = "np-gp-small"
  cluster_id  = mgc_kubernetes_cluster.cluster_demo.id
  flavor_name = "cloud-k8s.gp1.small"
  replicas    = 1
  min_replicas = 1
  max_replicas = 3
}

# NodePool adicional para workloads específicas
resource "mgc_kubernetes_nodepool" "nodepool_gp2" {
  provider    = mgc.sudeste
  depends_on  = [mgc_kubernetes_cluster.cluster_demo]
  name        = "np-gp-medium"
  cluster_id  = mgc_kubernetes_cluster.cluster_demo.id
  flavor_name = "cloud-k8s.gp1.medium"
  replicas    = 2
  min_replicas = 2
  max_replicas = 5
}
```

## 5. Provisionando Bancos de Dados

No arquivo `database.tf`, vamos configurar bancos de dados gerenciados:

```hcl
# Instância de banco de dados MySQL
resource "mgc_dbaas_instances" "mysql_db" {
  provider          = mgc.sudeste
  name              = "${var.project_name}-mysql"
  user              = "db_user"
  password          = "Ch4ng3M3!"  # Melhor prática: usar variável sensitive
  engine_name       = "mysql 8.0"
  instance_type_name = "cloud-dbaas-bs1.medium"
  volume_size       = 50
}

# Instância de banco de dados PostgreSQL
resource "mgc_dbaas_instances" "postgres_db" {
  provider          = mgc.sudeste
  name              = "${var.project_name}-postgres"
  user              = "postgres"
  password          = "Ch4ng3M3!"  # Melhor prática: usar variável sensitive
  engine_name       = "postgresql 15"
  instance_type_name = "cloud-dbaas-bs1.medium"
  volume_size       = 30
}
```

## 6. Configurando Outputs

No arquivo `outputs.tf`, defina outputs para facilitar o acesso às informações dos recursos criados:

```hcl
# Informações das VMs
output "vm_basica_info" {
  description = "Informações da VM básica"
  value = {
    id = mgc_virtual_machine_instances.vm_basica.id
    ip = mgc_virtual_machine_instances.vm_basica.network.public_address
  }
}

output "vm_windows_info" {
  description = "Informações da VM Windows"
  value = {
    id = mgc_virtual_machine_instances.vm_windows.id
    ip = mgc_virtual_machine_instances.vm_windows.network.public_address
  }
}

# Informações do Object Storage
output "bucket_name" {
  description = "Nome do bucket criado"
  value       = mgc_object_storage_buckets.my_bucket.bucket
}

output "bucket_region" {
  description = "Região do bucket"
  value       = mgc.sudeste.region
}

# Informações do Kubernetes
output "kubernetes_cluster_id" {
  description = "ID do cluster Kubernetes"
  value       = mgc_kubernetes_cluster.cluster_demo.id
}

output "kubernetes_kubeconfig_cmd" {
  description = "Comando para obter o kubeconfig do cluster"
  value       = "mgc kubernetes get-kubeconfig --cluster ${mgc_kubernetes_cluster.cluster_demo.name} --region ${mgc.sudeste.region} > kubeconfig.yaml"
}

# Informações dos bancos de dados
output "mysql_connection" {
  description = "Informações de conexão do MySQL"
  value       = "Host: ${mgc_dbaas_instances.mysql_db.host}, Port: ${mgc_dbaas_instances.mysql_db.port}"
}

output "postgres_connection" {
  description = "Informações de conexão do PostgreSQL"
  value       = "Host: ${mgc_dbaas_instances.postgres_db.host}, Port: ${mgc_dbaas_instances.postgres_db.port}"
}
```

## Executando o projeto

Agora podemos inicializar e aplicar nossa configuração:

```bash
# Inicializar o projeto OpenTofu
tofu init

# Planejar as mudanças
tofu plan

# Aplicar as mudanças (opcional: adicione -target para recursos específicos)
tofu apply -auto-approve

# Para destruir os recursos quando não forem mais necessários
# tofu destroy -auto-approve
```

## Práticas avançadas

### Uso de módulos personalizados

Para reutilizar configurações, você pode criar módulos personalizados. Por exemplo, um módulo para criar uma aplicação web completa:

```hcl
module "web_app" {
  source = "./modules/web-app"
  
  project_name = var.project_name
  ssh_key_name = var.ssh_key_name
  region       = "br-se1"
}
```

### Integração com CI/CD

Para integrar o OpenTofu com pipelines de CI/CD, armazene o estado do OpenTofu em um backend remoto:

```hcl
terraform {
  backend "s3" {
    bucket  = "terraform-state-bucket"
    key     = "opentofu-magalu/terraform.tfstate"
    region  = "br-se1"
    endpoint = "https://s3.br-se1.magalucloud.com.br"
    
    # Configurações adicionais
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_metadata_api_check     = true
    force_path_style            = true
  }
}
```

---

Em poucos minutos, você provisionou uma infraestrutura completa na Magalu Cloud usando OpenTofu, incluindo:

1. Múltiplas VMs com diferentes sistemas operacionais e configurações
2. Volumes de armazenamento de bloco
3. Object Storage com políticas de ciclo de vida
4. Cluster Kubernetes com múltiplos node pools
5. Bancos de dados gerenciados MySQL e PostgreSQL

Tudo isso consumindo a variável `MAGALU_API_KEY` do ambiente para autenticação segura.

## Próximos passos

- Explore módulos avançados para configurar balanceadores de carga e DNS
- Implemente compliance as code com o recurso `mgc_policy`
- Integre seus deployments com ArgoCD e Flux
- Contribua no [repositório oficial de exemplos da Magalu Cloud](https://github.com/MagaluCloud/terraform-examples)
- Consulte a [documentação completa do provider Magalu Cloud](https://registry.terraform.io/providers/MagaluCloud/mgc/latest/docs)
