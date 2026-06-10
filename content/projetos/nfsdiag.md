---
title: "nfsdiag - NFS Diagnostic Tool"
date: 2026-06-10
description: "Ferramenta de linha de comando em C para diagnosticar servidores NFS pelo lado do cliente."
draft: false
tags: ["c", "linux", "nfs", "sre", "devops", "troubleshooting"]
categories: ["projetos"]
---

## nfsdiag - NFS Diagnostic Tool

O `nfsdiag` é uma ferramenta de linha de comando para diagnosticar NFS a partir do cliente. Você passa um IP ou hostname, e ela percorre as camadas que normalmente quebram: rede, rpcbind, versões de NFS, mountd, exports, permissões, root squash, locking, stale handles e performance.

## Por que criei este projeto?

NFS costuma falhar com mensagens genéricas. Um `permission denied` pode ser export policy, UID/GID, ACL, root squash, SELinux/AppArmor ou idmapping. Um mount travado pode ser firewall, rpcbind, mountd, lockd, statd ou versão de protocolo. Eu queria uma ferramenta repetível para separar essas hipóteses sem depender de uma lista manual de comandos.

## O que você pode fazer com ele

- **Checar rede e RPC**: Testa DNS, TCP/111, TCP/2049, rpcbind, portas dinâmicas, NFS v2/v3/v4 e mountd.
- **Descobrir exports**: Usa mountd e também consegue tentar a pseudo-root `/` para servidores NFSv4-only.
- **Montar em cascata**: Tenta NFSv4.2, 4.1, 4 e 3, usando opções seguras por padrão.
- **Validar permissões**: Testa leitura, escrita, UID/GID, grupos suplementares, ACLs, xattrs e root squash.
- **Investigar comportamento do filesystem**: Checa locks, `ESTALE`, nomes longos, caracteres especiais, close-to-open e métricas de mountstats.
- **Gerar relatórios**: Emite texto, JSON, HTML, NDJSON, Prometheus, JUnit e bundle de evidências.
- **Automatizar troubleshooting**: Roda em batch com `--hosts-file`, em loop com `--watch`, como exporter com `--listen` e compara baseline por host.

## Como funciona por dentro

O fluxo é dividido em etapas:

1. valida argumentos, exports e opções de mount;
2. checa dependências locais e daemons do cliente;
3. testa reachability de rede;
4. consulta RPC e versões de protocolo;
5. enumera exports;
6. monta cada export em workspace temporário;
7. roda testes no filesystem;
8. coleta estatísticas e gera recomendações.

Quando roda como root, tenta usar mount namespace privado para não deixar mounts no namespace global. Por padrão, também adiciona `nosuid,nodev,noexec` às montagens de teste. Probes mais arriscados, como symlink, hardlink, FIFO e device node, só rodam com `--dangerous-fs-tests`.

## Tecnologias escolhidas

- **C e libtirpc**: Para falar RPC/NFS de forma direta e manter o binário simples.
- **Makefile**: Build, testes, empacotamento e fixtures.
- **Docker fixtures**: Cenários reproduzíveis de falha, como root squash, export read-only, mountd ausente e stale handle.
- **JSON, HTML, Prometheus e JUnit**: Para usar tanto no terminal quanto em automação.

## Decisões importantes

Algumas escolhas foram importantes no projeto:

- **Diagnóstico conservador por padrão**: A ferramenta tenta ajudar sem deixar lixo no sistema ou criar objetos arriscados no export.
- **Mount namespace quando possível**: Rodando como root, os mounts de teste ficam isolados do namespace global.
- **Relatórios pensados para automação**: Além da saída humana, os eventos têm categorias, `check_id` estável e texto de remediação.
- **Fixtures de falhas reais**: O projeto tem cenários Docker para reproduzir problemas comuns de NFS e evitar regressões.

## Status atual

O `nfsdiag` já possui binário, manpage, completions para shells, empacotamento para distribuições Linux, imagem OCI, site próprio e suíte de testes com fixtures. Ainda é uma ferramenta que evolui conforme encontro casos reais de NFS, principalmente em ambientes com NFSv3, NFSv4-only, Kerberos, root squash e políticas de export mais restritivas.

## Onde encontrar

- [Site do projeto](https://www.nfsdiag.org)
- [Código no GitHub](https://github.com/lsferreira42/nfsdiag)
