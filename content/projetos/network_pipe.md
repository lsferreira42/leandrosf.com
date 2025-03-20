---
title: "NP - Network Pipe: Uma Alternativa Moderna ao Netcat"
date: 2023-08-30
description: "Uma ferramenta de linha de comando para criar pipes de rede bidirecionais entre máquinas, com suporte integrado para detecção de serviços e um protocolo simples de autenticação."
draft: false
tags: ["go", "network", "pipe", "netcat", "command-line", "tcp", "udp"]
categories: ["projetos"]
---

## NP (Network Pipe) - Conectando Máquinas de Forma Simples

NP é uma ferramenta de linha de comando que permite criar pipes de rede bidirecionais entre máquinas de forma intuitiva e eficiente. Funciona como uma alternativa moderna ao netcat, oferecendo recursos avançados como detecção de serviços e um protocolo simples de autenticação que garante comunicações mais confiáveis.

> 🔗 **Acesse o projeto:** [https://github.com/lsferreira42/np](https://github.com/lsferreira42/np)

## Por que criei este projeto?

Ao trabalhar com sistemas distribuídos, frequentemente nos deparamos com a necessidade de transferir dados rapidamente entre máquinas ou conectar a saída de um processo em uma máquina à entrada de outro processo em outra máquina. As ferramentas tradicionais como o netcat, embora poderosas, carecem de alguns recursos modernos que facilitariam este trabalho.

O NP nasceu da necessidade de ter uma ferramenta simples, intuitiva e moderna para comunicação entre máquinas que pudesse ser facilmente integrada com o fluxo de trabalho de desenvolvedores e administradores de sistemas.

## O que você pode fazer com o NP

- **Transferir arquivos rapidamente** entre máquinas sem configurações complexas
- **Criar chats simples** para comunicação em tempo real
- **Conectar comandos** em diferentes máquinas através de pipes
- **Depurar conexões de rede** de forma intuitiva
- **Transmitir logs** ou saídas de comandos remotos em tempo real
- **Monitorar conexões** através de uma interface web integrada
- **Descobrir serviços** automaticamente via mDNS
- **Gerenciar múltiplas conexões** com o modo multiplex
- **Comprimir dados** em tempo real com diferentes algoritmos

## Como funciona por dentro

O NP é estruturado em torno de dois modos principais:

- **Modo receptor (servidor)**: escuta por conexões de entrada
- **Modo emissor (cliente)**: conecta-se a um receptor

A ferramenta utiliza um protocolo simples para autenticação que garante que apenas instâncias do NP se comuniquem entre si, evitando confusões com outros serviços de rede.

Tecnicamente, o NP oferece:

- Suporte a protocolos **UDP e TCP**
- Interface web integrada para **monitoramento em tempo real**
- Descoberta automática via **mDNS** (Bonjour/Avahi)
- Suporte a **múltiplas conexões simultâneas**
- **Compressão de dados** com algoritmos como gzip, zlib e zstd
- Código leve escrito em **Go**, compatível com múltiplas plataformas

## Como usar

A utilização do NP é extremamente simples. Para iniciar um receptor (servidor):

```
np --receiver
```

Para se conectar a um receptor como emissor (cliente):

```
np --sender -H 192.168.1.100
```

Para ativar a interface web de monitoramento:

```
np --receiver --web-ui
```

A ferramenta se integra perfeitamente com pipes Unix, permitindo usos criativos como:

```
# Na máquina A (receptor)
ls -la | np --receiver

# Na máquina B (emissor)
np --sender -H [IP-da-máquina-A] | grep "arquivo-importante"
```

## Planos futuros

O desenvolvimento do NP continua ativo, com diversos recursos planejados:

- Implementação de **criptografia end-to-end** para comunicações seguras
- Aprimoramento do **modo relay** para NAT traversal
- Expansão das capacidades de **compressão de dados**
- Melhoria da **interface web** com mais recursos de monitoramento
- Implementação de **plug-ins** para funcionalidades específicas

## Instalação

Você pode instalar o NP facilmente usando o Go:

```
go install github.com/lsferreira42/np@latest
```

Ou compilar a partir do código fonte:

```
git clone https://github.com/lsferreira42/np.git
cd np
go build
```

## Quer saber mais?

- [Repositório no GitHub](https://github.com/lsferreira42/np)
- [Guia de Exemplos](https://github.com/lsferreira42/np/blob/main/README_EXAMPLES.md)
- [English Documentation](https://github.com/lsferreira42/np/blob/main/README.en.md) 