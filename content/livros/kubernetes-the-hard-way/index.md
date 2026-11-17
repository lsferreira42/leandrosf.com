---
title: "Kubernetes The Hard Way"
autor: "Kelsey Hightower"
date: 2026-11-17
draft: false
description: "Guia que monta um cluster Kubernetes na mão, binário por binário, sem kubeadm e sem script de instalação."
edicao: "Revisão de abril de 2025, com Kubernetes 1.32"
link: "https://github.com/kelseyhightower/kubernetes-the-hard-way"
tags: ["kubernetes", "linux", "containers", "tls", "etcd"]
highlights:
  - texto: "Kubernetes The Hard Way is optimized for learning, which means taking the long route to ensure you understand each task required to bootstrap a Kubernetes cluster."
    onde: "README"
  - texto: "The results of this tutorial should not be viewed as production ready, and may receive limited support from the community, but don't let that stop you from learning!"
    onde: "README"
  - texto: "Security is a tradeoff, and in this case, we are optimizing for convenience."
    onde: "Lab 3, Provisioning Compute Resources"
  - texto: "In a real-world environment these certificates should be treated like a set of sensitive secrets as they are used as credentials by the Kubernetes components to authenticate to each other."
    onde: "Lab 4, Provisioning a CA and Generating TLS Certificates"
  - texto: "When generating kubeconfig files for Kubelets the client certificate matching the Kubelet's node name must be used. This will ensure Kubelets are properly authorized by the Kubernetes Node Authorizer."
    onde: "Lab 5, Generating Kubernetes Configuration Files for Authentication"
  - texto: "Kubernetes components are stateless and store cluster state in etcd."
    onde: "Lab 7, Bootstrapping the etcd Cluster"
  - texto: "Kubernetes has limited support for the use of swap memory, as it is difficult to provide guarantees and account for pod memory utilization when swap is involved."
    onde: "Lab 9, Bootstrapping the Kubernetes Worker Nodes"
  - texto: "At this point pods can not communicate with other pods running on different nodes due to missing network routes."
    onde: "Lab 11, Provisioning Pod Network Routes"
---

Não é livro de papel. É um guia em Markdown no GitHub, com 13 labs curtos, e a capa aí do lado é só pra ele não ficar sem lugar na estante. Entra na lista mesmo assim: é leitura, só que com um terminal aberto do lado.

## Resumo

O guia sobe um cluster Kubernetes sem nenhuma ferramenta de instalação. Nada de kubeadm, k3s, kops ou Ansible. Você baixa os binários, gera os certificados com `openssl`, escreve os kubeconfigs, cria as units do systemd e liga um componente de cada vez. O objetivo declarado é aprender, e o próprio README avisa que o resultado não serve pra produção.

A revisão atual usa quatro máquinas Debian 12, ARM64 ou AMD64: uma `jumpbox` de onde saem todos os comandos, uma `server` com o control plane inteiro e dois workers, `node-0` e `node-1`. Os componentes são Kubernetes 1.32, containerd 2.1, etcd 3.6 e os plugins CNI 1.6. As edições antigas eram amarradas ao GCP. Essa só pede que as quatro máquinas se enxerguem na rede, então dá pra fazer em VM local.

## O caminho

Os labs seguem a ordem em que as dependências aparecem.

1. **Máquinas e jumpbox** (labs 1 a 3). Um arquivo `machines.txt` com IP, FQDN, hostname e subnet de pods de cada máquina faz o papel de inventário. SSH como root, hostnames e `/etc/hosts` copiado pra todo mundo. Não tem DNS no cluster: os nomes resolvem por `/etc/hosts`.
2. **PKI** (lab 4). Uma CA self-signed e um certificado por componente, tudo a partir de um `ca.conf` só. É aqui que aparece como o Kubernetes identifica quem fala com a API: o kubelet do `node-0` usa `CN = system:node:node-0` e `O = system:nodes`, o admin usa `O = system:masters`. A identidade está no subject do certificado.
3. **Kubeconfigs** (lab 5). Um arquivo por cliente: kubelets, kube-proxy, controller-manager, scheduler e admin. O Node Authorizer só aceita o kubelet se o nome no certificado bater com o nome do node.
4. **Criptografia dos Secrets** (lab 6). Um `encryption-config.yaml` com uma chave `aescbc`. No smoke test você faz um hexdump do Secret direto do etcd e vê o prefixo `k8s:enc:aescbc:v1:key1`.
5. **etcd** (lab 7). Um membro só, na `server`, ouvindo em `127.0.0.1`.
6. **Control plane** (lab 8). `kube-apiserver`, `kube-controller-manager` e `kube-scheduler` como units do systemd, com `--authorization-mode=Node,RBAC`. Depois vem o ClusterRole `system:kube-apiserver-to-kubelet`, que é o que deixa o API server buscar log, métrica e rodar `exec` no kubelet.
7. **Workers** (lab 9). runc, plugins CNI, containerd, kubelet e kube-proxy. Swap desligado, `br_netfilter` carregado e uma rede `bridge` por node.
8. **kubectl remoto** (lab 10).
9. **Rotas de pod** (lab 11). Cada node tem um CIDR de pods, e um pod não alcança o do outro node até alguém ensinar o caminho. O guia resolve com `ip route add` em cada máquina. A rede de pods deixa de ser mágica nesse ponto: é uma rota estática.
10. **Smoke test** (lab 12). Secret criptografado, Deployment, `port-forward`, `logs`, `exec` e um Service NodePort.

## O que fica de fora

O cluster que sai daqui tem um control plane em uma máquina só, um etcd de um membro falando HTTP puro em loopback, e nenhum add-on. Não tem CoreDNS, então pod não resolve nome de Service (as edições antigas terminavam instalando o add-on de DNS, a atual não). Também não tem CNI com overlay ou NetworkPolicy, Ingress, Service do tipo LoadBalancer, storage, rotação de certificado nem upgrade.

Isso é escolha do guia, e ele diz isso com todas as letras. Só não dá pra sair dele achando que montou um cluster de produção.

## Pra quem serve

Pra quem usa Kubernetes gerenciado e nunca viu o que tem embaixo. Depois de montar na mão, erro deixa de ser texto solto e vira peça: `x509: certificate signed by unknown authority` aponta pro lab 4, node em `NotReady` aponta pro kubelet ou pro CNI do lab 9, pod que não fala com pod de outro node aponta pra rota do lab 11.

Quem já administra cluster com kubeadm vai achar boa parte conhecida. Mesmo assim o lab de certificados e o de rotas valem a leitura, porque são as duas coisas que as ferramentas de instalação mais escondem.
