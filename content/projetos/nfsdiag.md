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

## Por que fiz

NFS costuma falhar com mensagens genéricas. Um `permission denied` pode ser export policy, UID/GID, ACL, root squash, SELinux/AppArmor ou idmapping. Um mount travado pode ser firewall, rpcbind, mountd, lockd, statd ou versão de protocolo. Eu queria uma ferramenta repetível para separar essas hipóteses sem depender de uma lista manual de comandos.

## O que você pode fazer com ele

- testa DNS, TCP/111, TCP/2049, rpcbind, portas dinâmicas, NFS v2/v3/v4 e mountd
- descobre os exports pelo mountd, ou tenta a pseudo-root `/` em servidor NFSv4-only
- monta em cascata: NFSv4.2, 4.1, 4 e 3, com opções seguras por padrão
- valida leitura, escrita, UID/GID, grupos suplementares, ACLs, xattrs e root squash
- checa locks, `ESTALE`, nomes longos, caracteres especiais, close-to-open e as métricas do mountstats
- gera relatório em texto, JSON, HTML, NDJSON, Prometheus e JUnit, além de um bundle de evidências
- roda em batch com `--hosts-file`, em loop com `--watch`, como exporter com `--listen`, e compara com o baseline de cada host

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

## Do que é feito

C com libtirpc, pra falar RPC e NFS direto e manter um binário simples. Um Makefile cuida de build, testes, empacotamento e fixtures. As fixtures são cenários em Docker que reproduzem falha de verdade: root squash, export read-only, mountd ausente, stale handle.

## Decisões de projeto

O diagnóstico é conservador por padrão. Uma ferramenta que roda como root e monta export remoto não pode deixar lixo no sistema nem criar objeto arriscado no export sem o operador pedir.

Os relatórios foram pensados pra automação: além da saída pra gente ler, cada evento tem categoria, um `check_id` estável e texto de remediação. E as fixtures existem pra regressão, porque um bug de diagnóstico de NFS só aparece quando o servidor está quebrado do jeito certo.

## Status atual

Já tem binário, manpage, completions de shell, pacotes pra distribuições Linux, imagem OCI, site próprio e suíte de testes com fixtures. Continua mudando conforme aparecem casos reais, principalmente em ambientes com NFSv3, NFSv4-only, Kerberos, root squash e políticas de export mais restritivas.

## Onde encontrar

- [Site do projeto](https://www.nfsdiag.org)
- [Código no GitHub](https://github.com/lsferreira42/nfsdiag)
