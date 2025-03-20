---
title: "NADB - Not A Database"
date: 2025-03-20
description: "Uma solução de armazenamento chave-valor simples, thread-safe, com buffer em memória e persistência em disco."
draft: false
tags: ["python", "key-value", "database", "storage", "redis"]
categories: ["projetos"]
---

## NADB - Not A Database

Você já precisou de um armazenamento de dados simples, mas robusto, que não exige toda a complexidade de um banco de dados tradicional? O NADB é exatamente isso: 

Uma solução de armazenamento chave-valor thread-safe, com buffer de memória assíncrono e persistência em disco, sem nenhuma dependência externa.

## Por que criei este projeto?

Desenvolvi o NADB para preencher uma lacuna comum em muitos projetos: a necessidade de armazenar dados de forma persistente e organizada, mas sem o overhead de configurar e manter um sistema de banco de dados completo. É uma solução educativa que demonstra como implementar conceitos fundamentais de armazenamento de dados, oferecendo uma alternativa leve para casos de uso específicos.

## O que você pode fazer com ele

- **Armazenar dados com segurança**: Operações thread-safe para configurar, obter e excluir pares chave-valor
- **Otimizar a performance**: Buffer em memória com flush assíncrono para disco
- **Organizar seus dados**: Sistema de namespace e separação de bancos de dados
- **Armazenar qualquer tipo de arquivo**: Suporte para dados binários
- **Categorizar informações**: Sistema de tags para organizar e consultar dados
- **Economizar espaço**: Compressão de dados para armazenamento eficiente
- **Controlar expiração**: TTL (Time To Live) para expiração automática de dados
- **Monitorar performance**: Métricas e monitoramento detalhados
- **Otimizar uso de disco**: Compactação de armazenamento
- **Escolher onde armazenar**: Backends de armazenamento plugáveis (sistema de arquivos, Redis)

## Como funciona por dentro

O NADB é construído com uma arquitetura modular que separa:

- **Gerenciamento de dados em memória**: Buffer eficiente para operações rápidas
- **Persistência assíncrona**: Thread dedicada para flush periódico dos dados
- **Metadados inteligentes**: Armazenamento de informações como tags e TTL
- **Backends intercambiáveis**: Possibilidade de usar diferentes sistemas de armazenamento

## Tecnologias que escolhi

- **Python**: Linguagem de alto nível para facilitar o uso e extensão
- **Threading nativo**: Para garantir operações concorrentes seguras
- **Sistema de arquivo e Redis**: Como backends de armazenamento
- **Compressão de dados**: Para otimizar o uso de espaço em disco

## Como está organizado

```
nadb/
├── __init__.py
├── nakv.py
├── storage.py
├── storage_backends/
│   ├── fs.py
│   └── redis.py
├── sql/
├── setup.py
├── pyproject.toml
├── Makefile
└── tests/
```

## Quer experimentar?

### Instalação via pip

```shell
pip install nadb
```

### Uso básico

```python
from nadb import KeyValueStore, KeyValueSync

# Inicializa o KeyValueSync para flush assíncrono
kv_sync = KeyValueSync(flush_interval_seconds=60)
kv_sync.start()

# Inicializa o KeyValueStore com compressão ativada
kv_store = KeyValueStore(
    data_folder_path='./data', 
    db='db1', 
    buffer_size_mb=1, 
    namespace='meu_namespace', 
    sync=kv_sync,
    compression_enabled=True,
    storage_backend="fs"
)

# Armazena dados com tags
kv_store.set("chave_teste", "Olá, mundo!".encode('utf-8'), tags=["texto", "saudação"])

# Obtém um valor
valor = kv_store.get("chave_teste").decode('utf-8')
print(valor)  # Exibe: Olá, mundo!
```

## Minha motivação pessoal

Este projeto nasceu da minha experiência trabalhando com diversos sistemas de armazenamento. Percebi que muitas vezes precisamos de algo mais simples que um banco de dados relacional, mas mais estruturado que um simples arquivo. O NADB preenche esse nicho, proporcionando uma solução educativa que demonstra conceitos importantes de armazenamento de dados, buffering, operações assíncronas e persistência.

## Onde encontrar

- [Código no GitHub](https://github.com/lsferreira42/nadb) 