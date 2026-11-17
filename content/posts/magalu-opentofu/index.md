+++
date = '2025-04-25T21:10:00-03:00'
draft = false
title = 'Introdução ao módulo Terraform da Magalu Cloud com o OpenTofu'
tags = ["infraestrutura","iac","devops","magalucloud","opentofu","terraform"]

[cover]
image = "capa.webp"
alt = "Magalu Cloud e OpenTofu"
relative = true
+++

**Este post mostra como usar o provider MGC da Magalu Cloud com OpenTofu para provisionar VMs, volumes, object storage, Kubernetes e bancos de dados gerenciados. Atualizado em novembro de 2026 pra versão 0.56 do provider.**

## O que é OpenTofu?

OpenTofu é o fork open source do Terraform, mantido sob a Linux Foundation e licenciado em MPL 2.0. Ele surgiu depois que o Terraform foi pra BSL e aceita a mesma linguagem HCL e o mesmo fluxo de `init`, `plan` e `apply`. A instalação e o básico estão no [post anterior](/posts/introducao-ao-opentofu/).

## Antes de começar

Você precisa de:

1. [Uma conta na Magalu Cloud](https://www.magalucloud.com.br)
2. Uma API Key, gerada no console
3. Um par de chaves do Object Storage (ID e segredo), se for criar buckets
4. Uma chave SSH cadastrada na conta
5. [OpenTofu](https://opentofu.org/docs/intro/install/) 1.11 ou mais novo. O provider usa argumentos write-only (a senha do banco e o pedido de IP público, por exemplo), que versões mais antigas não entendem

A [documentação da Magalu Cloud](https://docs.magalu.cloud) mostra onde gerar cada credencial. Nada disso vai pro código: tudo entra por variável de ambiente.

```bash
export TF_VAR_mgc_api_key="sua api key"
export TF_VAR_mgc_key_pair_id="id do par de chaves"
export TF_VAR_mgc_key_pair_secret="segredo do par de chaves"
export TF_VAR_ssh_key_name="nome da chave ssh"
export TF_VAR_db_password="uma senha forte"
```

O código deste post foi validado com `validate` contra a versão 0.56.0 do provider, de outubro de 2026. O provider ainda está em 0.x e já mudou nomes de recurso e de argumento entre versões, então fixe a versão.

## Estrutura do projeto

O projeto fica com um arquivo por tipo de recurso:

```
magalu-opentofu-demo/
├── providers.tf       # provider e regiões
├── variables.tf       # variáveis
├── consulta/main.tf   # o que a conta tem disponível
├── vm.tf              # máquinas virtuais
├── storage.tf         # volumes de bloco
├── bucket.tf          # object storage
├── k8s.tf             # cluster Kubernetes
├── database.tf        # bancos de dados
└── outputs.tf         # saídas
```

```bash
mkdir magalu-opentofu-demo
cd magalu-opentofu-demo
mkdir consulta
touch providers.tf variables.tf vm.tf storage.tf bucket.tf k8s.tf database.tf outputs.tf consulta/main.tf
```

## Configurando o provider

Em `providers.tf`, o provider aparece duas vezes, uma por região. Cada recurso escolhe a região pelo alias:

```hcl
terraform {
  required_providers {
    mgc = {
      source  = "MagaluCloud/mgc"
      version = "~> 0.56"
    }
  }
}

# Provider principal na região Sudeste (São Paulo)
provider "mgc" {
  alias           = "sudeste"
  region          = "br-se1"
  api_key         = var.mgc_api_key
  key_pair_id     = var.mgc_key_pair_id
  key_pair_secret = var.mgc_key_pair_secret
}

# Provider adicional na região Nordeste (opcional)
provider "mgc" {
  alias   = "nordeste"
  region  = "br-ne1"
  api_key = var.mgc_api_key
}
```

Em `variables.tf`:

```hcl
variable "mgc_api_key" {
  description = "API Key da Magalu Cloud, vinda de TF_VAR_mgc_api_key"
  type        = string
  sensitive   = true
}

variable "mgc_key_pair_id" {
  description = "ID do par de chaves do Object Storage"
  type        = string
  sensitive   = true
}

variable "mgc_key_pair_secret" {
  description = "Segredo do par de chaves do Object Storage"
  type        = string
  sensitive   = true
}

variable "ssh_key_name" {
  description = "Nome da chave SSH cadastrada na Magalu Cloud"
  type        = string
}

variable "project_name" {
  description = "Prefixo dos nomes dos recursos"
  type        = string
  default     = "opentofu-demo"
}

variable "k8s_version" {
  description = "Versão do Kubernetes, no formato vX.Y.Z"
  type        = string
}

variable "k8s_flavor" {
  description = "Flavor dos nodes do Kubernetes"
  type        = string
}

variable "db_password" {
  description = "Senha do usuário administrador dos bancos"
  type        = string
  sensitive   = true
}

variable "postgres_version" {
  description = "Versão do PostgreSQL"
  type        = string
}
```

## Descobrindo o que está disponível

Tipo de máquina, tipo de volume, versão de Kubernetes, flavor de node e versão de banco mudam com o tempo e variam por região. Em vez de copiar um nome de um post (inclusive deste), pergunte pro provider. Isso fica numa pasta à parte, `consulta/`, com um `main.tf` que só tem data sources:

```hcl
terraform {
  required_providers {
    mgc = {
      source  = "MagaluCloud/mgc"
      version = "~> 0.56"
    }
  }
}

variable "mgc_api_key" {
  type      = string
  sensitive = true
}

provider "mgc" {
  region  = "br-se1"
  api_key = var.mgc_api_key
}

data "mgc_virtual_machine_types" "tipos" {
}

data "mgc_block_storage_volume_types" "tipos" {
}

data "mgc_kubernetes_version" "versoes" {
  include_deprecated = false
}

data "mgc_kubernetes_flavor" "flavors" {
}

data "mgc_dbaas_engines" "engines" {
  status = "ACTIVE"
}

data "mgc_dbaas_instance_types" "tipos" {
}

output "disponivel" {
  value = {
    vm_tipos      = [for t in data.mgc_virtual_machine_types.tipos.machine_types : t.name]
    volume_tipos  = [for t in data.mgc_block_storage_volume_types.tipos.volume_types : t.name]
    k8s_versoes   = [for v in data.mgc_kubernetes_version.versoes.versions : v.version]
    k8s_flavors   = [for f in data.mgc_kubernetes_flavor.flavors.nodepool : f.name]
    banco_engines = [for e in data.mgc_dbaas_engines.engines.engines : "${e.name} ${e.version}"]
    banco_tipos   = [for t in data.mgc_dbaas_instance_types.tipos.instance_types : t.name]
  }
}
```

Rode antes de criar qualquer coisa. Como só tem leitura, o `apply` não cria nada:

```bash
cd consulta
tofu init
tofu apply
cd ..
```

A saída lista os nomes válidos na sua conta. Escolha a versão de Kubernetes, o flavor dos nodes e a versão do PostgreSQL e passe adiante:

```bash
export TF_VAR_k8s_version="uma das versões listadas"
export TF_VAR_k8s_flavor="um dos flavors listados"
export TF_VAR_postgres_version="uma das versões listadas"
```

## 1. Máquinas virtuais

Em `vm.tf`, duas VMs: uma só com IP privado e outra com IP público e um script de inicialização que instala o nginx.

```hcl
# VM básica Ubuntu, só com IP privado
resource "mgc_virtual_machine_instances" "vm_basica" {
  provider     = mgc.sudeste
  name         = "${var.project_name}-vm-ubuntu"
  machine_type = "BV1-1-40"
  image        = "cloud-ubuntu-24.04 LTS"
  ssh_key_name = var.ssh_key_name
}

# VM com IP público e script de inicialização (user data)
resource "mgc_virtual_machine_instances" "vm_com_userdata" {
  provider             = mgc.sudeste
  name                 = "${var.project_name}-vm-userdata"
  machine_type         = "BV4-8-100"
  image                = "cloud-ubuntu-24.04 LTS"
  ssh_key_name         = var.ssh_key_name
  allocate_public_ipv4 = true
  user_data = base64encode(<<-EOF
    #!/bin/bash
    apt update
    apt install -y nginx
    echo "<h1>Hello from Magalu Cloud + OpenTofu!</h1>" > /var/www/html/index.html
    systemctl enable --now nginx
  EOF
  )
}
```

O `allocate_public_ipv4` cria um IP público junto com a VM. Um detalhe que custa dinheiro: destruir a VM não destrói esse IP, e ele continua sendo cobrado até você apagar.

## 2. Volumes de bloco

Em `storage.tf`:

```hcl
# Volume de bloco pra dados
resource "mgc_block_storage_volumes" "data_volume" {
  provider = mgc.sudeste
  name     = "${var.project_name}-data-volume"
  size     = 10
  type     = "cloud_nvme1k"
}

# Anexa o volume à VM básica
resource "mgc_block_storage_volume_attachment" "data_attachment" {
  provider           = mgc.sudeste
  block_storage_id   = mgc_block_storage_volumes.data_volume.id
  virtual_machine_id = mgc_virtual_machine_instances.vm_basica.id
}

# Volume maior, cifrado, pra backups
resource "mgc_block_storage_volumes" "backup_volume" {
  provider  = mgc.sudeste
  name      = "${var.project_name}-backup-volume"
  size      = 50
  type      = "cloud_nvme1k"
  encrypted = true
}
```

## 3. Object Storage

Em `bucket.tf`, um bucket com versionamento, outro com CORS liberado pra um front-end em outro domínio, e um objeto:

```hcl
# Bucket com versionamento
resource "mgc_object_storage_buckets" "my_bucket" {
  provider   = mgc.sudeste
  bucket     = "${var.project_name}-storage"
  versioning = true
}

# Bucket que um front-end em outro domínio pode ler
resource "mgc_object_storage_buckets" "assets_bucket" {
  provider = mgc.sudeste
  bucket   = "${var.project_name}-assets"

  cors = {
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["https://app.exemplo.com.br"]
    max_age_seconds = 600
  }
}

# Sobe um objeto pro primeiro bucket
resource "mgc_object_storage_objects" "index_html" {
  provider     = mgc.sudeste
  bucket       = mgc_object_storage_buckets.my_bucket.bucket
  key          = "index.html"
  content      = "<html><body><h1>Hello from Magalu Cloud!</h1></body></html>"
  content_type = "text/html"
}
```

Se o `apply` reclamar que o nome do bucket já existe, troque o `project_name`.

## 4. Cluster Kubernetes

Em `k8s.tf`, um cluster e dois node pools. O segundo tem label e taint, pra receber só o que tolerar a taint:

```hcl
# Cluster Kubernetes
resource "mgc_kubernetes_cluster" "cluster_demo" {
  provider             = mgc.sudeste
  name                 = "${var.project_name}-cluster"
  version              = var.k8s_version
  enabled_server_group = false
  description          = "Cluster de demonstração"
}

# Node pool com autoscaling de 1 a 3 nodes
resource "mgc_kubernetes_nodepool" "nodepool_principal" {
  provider     = mgc.sudeste
  name         = "np-principal"
  cluster_id   = mgc_kubernetes_cluster.cluster_demo.id
  flavor_name  = var.k8s_flavor
  replicas     = 1
  min_replicas = 1
  max_replicas = 3
}

# Segundo node pool, separado por label e taint
resource "mgc_kubernetes_nodepool" "nodepool_batch" {
  provider     = mgc.sudeste
  name         = "np-batch"
  cluster_id   = mgc_kubernetes_cluster.cluster_demo.id
  flavor_name  = var.k8s_flavor
  replicas     = 2
  min_replicas = 2
  max_replicas = 5

  labels = {
    carga = "batch"
  }

  taints = [{
    key    = "carga"
    value  = "batch"
    effect = "NoSchedule"
  }]
}
```

Depois de criado, o campo `replicas` deixa de mandar: o tamanho do node pool passa a ser decidido pelo autoscaler, entre `min_replicas` e `max_replicas`.

## 5. Bancos de dados

Em `database.tf`:

```hcl
# MySQL gerenciado
resource "mgc_dbaas_instances" "mysql_db" {
  provider              = mgc.sudeste
  name                  = "${var.project_name}-mysql"
  user                  = "dbadmin"
  password              = var.db_password
  engine_name           = "mysql"
  engine_version        = "8.0"
  instance_type         = "DP2-8-40"
  volume_size           = 50
  backup_retention_days = 7
}

# PostgreSQL gerenciado
resource "mgc_dbaas_instances" "postgres_db" {
  provider       = mgc.sudeste
  name           = "${var.project_name}-postgres"
  user           = "dbadmin"
  password       = var.db_password
  engine_name    = "postgresql"
  engine_version = var.postgres_version
  instance_type  = "DP2-8-40"
  volume_size    = 30
}
```

## 6. Outputs

Em `outputs.tf` ficam os endereços que você vai precisar depois. O kubeconfig e os endereços do banco não são atributos dos recursos, vêm de data sources:

```hcl
# VMs
output "vm_basica_ip_privado" {
  value = mgc_virtual_machine_instances.vm_basica.local_ipv4
}

output "vm_userdata_ip_publico" {
  value = mgc_virtual_machine_instances.vm_com_userdata.ipv4
}

# Object Storage
output "bucket_url" {
  value = mgc_object_storage_buckets.my_bucket.url
}

# Kubernetes
output "kubernetes_cluster_id" {
  value = mgc_kubernetes_cluster.cluster_demo.id
}

data "mgc_kubernetes_cluster_kubeconfig" "cluster_demo" {
  provider   = mgc.sudeste
  cluster_id = mgc_kubernetes_cluster.cluster_demo.id
}

output "kubeconfig" {
  value     = data.mgc_kubernetes_cluster_kubeconfig.cluster_demo.kubeconfig
  sensitive = true
}

# Bancos de dados
data "mgc_dbaas_instance" "mysql_db" {
  provider = mgc.sudeste
  id       = mgc_dbaas_instances.mysql_db.id
}

output "mysql_enderecos" {
  value = data.mgc_dbaas_instance.mysql_db.addresses
}
```

## Executando o projeto

```bash
tofu init
tofu plan
tofu apply
```

Pra pegar o kubeconfig depois do apply:

```bash
tofu output -raw kubeconfig > kubeconfig.yaml
kubectl --kubeconfig kubeconfig.yaml get nodes
```

E pra apagar tudo, lembrando do IP público, que é cobrado enquanto existir:

```bash
tofu destroy
```

## Indo além do básico

### Módulos

Quando o mesmo conjunto de recursos começa a se repetir, vale virar módulo:

```hcl
module "web_app" {
  source = "./modules/web-app"

  project_name = var.project_name
  ssh_key_name = var.ssh_key_name

  providers = {
    mgc = mgc.sudeste
  }
}
```

### State remoto pra CI/CD

Pra rodar em pipeline o state não pode ficar na máquina de quem aplicou. O Object Storage da Magalu Cloud fala S3, então serve de backend:

```hcl
terraform {
  backend "s3" {
    bucket = "meu-bucket-de-state"
    key    = "opentofu-magalu/terraform.tfstate"
    region = "br-se1"

    endpoints = {
      s3 = "https://br-se1.magaluobjects.com"
    }

    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
```

As credenciais do backend são as do par de chaves do Object Storage, nas variáveis `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY`. Esse bloco eu não testei contra uma conta: o endpoint existe e a sintaxe é a do backend S3 atual, mas confirme com um `tofu init` antes de confiar.

## Onde continuar

O provider tem bem mais do que entrou aqui: VPC, subnets, security groups, IP público, load balancer, container registry e snapshots. A lista completa de recursos está na [documentação do provider no registry](https://registry.terraform.io/providers/MagaluCloud/mgc/latest/docs), e a Magalu Cloud mantém um [repositório de exemplos](https://github.com/MagaluCloud/terraform-examples) que vale olhar antes de escrever do zero.

Antes de subir a versão do provider, leia o changelog.
