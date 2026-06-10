+++
date = '2026-06-10T10:00:00-03:00'
draft = false
title = 'NFSdiag: diagnóstico de NFS pelo lado do cliente'
tags = ["linux", "nfs", "sre", "devops", "troubleshooting", "c"]
+++

**O `nfsdiag` é uma ferramenta de linha de comando que criei para diagnosticar servidores NFS pelo lado do cliente. Você passa um IP ou hostname, e ele percorre as camadas que normalmente quebram em NFS: rede, rpcbind, versões do protocolo, mountd, exports, permissões, root squash, locking, stale handles e performance.**

NFS é simples até o dia em que para de funcionar. A mensagem no cliente costuma ser genérica: `permission denied`, `stale file handle`, mount travado, timeout, lock que não funciona, export que aparece em um servidor mas não monta em outro. Em produção, isso vira uma investigação espalhada entre rede, firewall, `/etc/exports`, UID/GID, idmapping, Kerberos, ACL, SELinux, versão de NFS e comportamento do kernel.

Eu queria uma ferramenta que fizesse esse caminho de forma repetível. Não para substituir análise no servidor, mas para responder rápido uma pergunta prática: o problema está na rede, no RPC, no mount, nas permissões, no comportamento do filesystem ou em alguma característica do cliente?

O código está em [github.com/lsferreira42/nfsdiag](https://github.com/lsferreira42/nfsdiag) e a página do projeto está em [www.nfsdiag.org](https://www.nfsdiag.org).

## Como ele funciona

O fluxo do `nfsdiag` é em camadas. Ele começa com o que não precisa montar nada, depois tenta descobrir os exports, monta cada export em um diretório temporário e roda os testes de filesystem.

Em um diagnóstico padrão ele faz, nesta ordem:

1. valida o host, os paths de export e as opções de mount;
2. verifica dependências locais, como `mount`, `umount` e ferramentas de Kerberos quando necessário;
3. checa daemons do cliente em sistemas com systemd, como `rpcbind.service`, `nfs-client.target`, `nfs-idmapd.service` e `rpc-gssd.service`;
4. testa resolução de nome, porta TCP `111` do rpcbind e porta TCP `2049` do NFS;
5. mede latência de conexão TCP e tenta obter o path MTU até o servidor;
6. consulta o mapa RPC pelo portmapper legado, pelo rpcbind v3/v4 DUMP ou por probes diretos;
7. verifica portas dinâmicas registradas para `mountd`, `lockd` e `statd`;
8. identifica versões de NFS v2, v3 e v4 com `NULLPROC`;
9. checa mountd v1, v2 e v3;
10. enumera exports via mountd, ou tenta `/` como pseudo-root NFSv4 quando a lista vem vazia;
11. monta cada export tentando NFSv4.2, depois 4.1, 4 e 3;
12. roda testes no mount: leitura, escrita, ACL, xattrs, locking, root squash, nomes longos, `ESTALE`, métricas e opções efetivas;
13. compara estatísticas RPC antes e depois dos testes;
14. gera saída em texto, JSON, HTML, NDJSON, Prometheus ou JUnit.

Quando roda como root, ele tenta usar um mount namespace privado por padrão. Isso evita deixar mounts de teste no namespace global da máquina. As montagens também usam `nosuid,nodev,noexec` por padrão, a menos que você libere explicitamente com `--allow-risky-mount-options`.

## Instalação rápida

Se você só quer rodar sem compilar:

```sh
docker run --rm --privileged ghcr.io/lsferreira42/nfsdiag 192.168.1.10
```

Para compilar localmente em Debian ou Ubuntu:

```sh
sudo apt-get install -y build-essential pkg-config libtirpc-dev nfs-common
git clone https://github.com/lsferreira42/nfsdiag
cd nfsdiag
make
sudo make install
```

No Fedora ou RHEL:

```sh
sudo dnf install -y gcc make pkgconf-pkg-config libtirpc-devel nfs-utils
git clone https://github.com/lsferreira42/nfsdiag
cd nfsdiag
make
sudo make install
```

Também dá para rodar só a checagem local:

```sh
./nfsdiag --self-test
```

## Uso básico

O uso mais comum é direto:

```sh
sudo nfsdiag 192.168.1.10
```

Para ver todos os passos:

```sh
sudo nfsdiag --verbose 192.168.1.10
```

Para testar só rede e RPC, sem montar export:

```sh
nfsdiag --no-mount 192.168.1.10
```

Para testar um export específico:

```sh
sudo nfsdiag --export /data 192.168.1.10
```

Para não criar arquivos no export:

```sh
sudo nfsdiag --read-only 192.168.1.10
```

## O que ele checa

Na parte de rede, o `nfsdiag` valida DNS, TCP/111, TCP/2049, latência de conexão e path MTU. Isso separa problemas básicos de reachability de problemas de protocolo.

Na parte de RPC, ele tenta buscar o mapa de serviços e verifica se `nfs`, `mountd`, `lockd/nlm` e `statd/nsm` aparecem como esperado. Isso ajuda bastante quando o firewall libera só `111` e `2049`, mas bloqueia portas dinâmicas usadas por NFSv3.

Na parte de protocolo, ele testa NFS v2, v3 e v4 com `NULLPROC`. Para NFSv4, as versões menores 4.1 e 4.2 são validadas durante a tentativa real de mount.

Na descoberta de exports, ele usa mountd. Se o servidor é NFSv4-only ou esconde a lista, ele pode tentar a pseudo-root `/`. Também dá para ignorar a descoberta e passar exports manualmente com `--export`.

Depois do mount, ele entra nos testes que costumam revelar o problema real: `stat`, `statvfs`, leitura e traverse de diretório, listagem, ACL POSIX, ACL NFSv4, simulação de UID/GID, escrita com `fsync`, leitura de volta, locking com `fcntl`, root squash, xattrs, `copy_file_range`, `fallocate`, `O_DIRECT`, consistência close-to-open, delegations NFSv4, latência de metadados, loop de `ESTALE`, `/proc/self/mountstats`, `/proc/self/mountinfo` e `/proc/fs/nfsfs/servers`.

Os números de performance são sinais de troubleshooting, não benchmark definitivo. Eles ajudam a comparar clientes, opções de mount e regressões, mas não substituem um teste de carga feito com método.

## Opções de diagnóstico

`-e, --export PATH` testa apenas o export informado. Pode ser usado várias vezes, até 64 paths. Isso é útil para NFSv4-only, para servidores que escondem a lista de exports ou quando você quer evitar montar tudo.

```sh
sudo nfsdiag --export /data --export /backup 192.168.1.10
```

`-o, --mount-options OPTS` passa opções extras para o `mount(8)`. O `nfsdiag` sempre monta com `vers=<versao>` e adiciona `nosuid,nodev,noexec` por padrão. Se você passar `-o hard,timeo=30`, ele compõe isso com a versão testada. Opções como `exec`, `suid` e `dev` são recusadas, a menos que você use `--allow-risky-mount-options`.

```sh
sudo nfsdiag -o hard,timeo=30,retrans=2 192.168.1.10
```

`--no-mount` roda só rede, RPC, versões e descoberta. Não cria workspace temporário, não monta exports e normalmente não precisa de root.

`--dry-run` mostra o que seria feito, mas não executa mounts reais nem testes de filesystem. É bom para validar argumentos e entender o plano antes de tocar em um ambiente sensível.

`--read-only` desliga testes que criam ou escrevem arquivos. Ele ainda consegue validar leitura, traverse, ACLs e parte das informações do mount, mas pula escrita, benchmark, locking, xattrs criados em arquivo de teste e outros probes que dependem de criação.

`--uid UID`, `--gid GID` e `--groups G1,G2` simulam acesso como outro usuário. O teste roda em processo filho, troca grupos suplementares, aplica `setgid()` e `setuid()`, e tenta ler/traversar o export. Se escrita estiver habilitada, também tenta criar um arquivo. Isso é útil quando root monta, mas a aplicação roda como `uid=1000`.

```sh
sudo nfsdiag --uid 1000 --gid 1000 --groups 10,20 192.168.1.10
```

`--krb5` ativa checagens de Kerberos. Ele procura configuração, valida ticket com `klist -s`, verifica `rpc-gssd`/`gssproxy` quando possível e, depois do diagnóstico principal, tenta montar com `sec=krb5`, `sec=krb5i` e `sec=krb5p`. Se você já passou `sec=` em `--mount-options`, ele não faz o probe automático dos flavors.

`--parallel N` testa até `N` exports ao mesmo tempo, de 1 a 32. Internamente ele usa workers via `fork()` e depois junta eventos, recomendações e resultados. Ajuda em servidores com muitos exports, mas eu usaria com cuidado em ambiente carregado.

`--sweep` roda um sweep de opções de performance em um export que montou com sucesso. Ele testa combinações de `rsize`, `wsize` e `nconnect`, mede leitura e escrita com o tamanho configurado em `--bench-bytes` e sugere a melhor combinação observada daquele cliente.

`--diff-baseline` compara o resumo atual com o último baseline salvo para o host e atualiza o arquivo no final. Por padrão, fica em `$XDG_DATA_HOME/nfsdiag` ou `~/.local/share/nfsdiag`. É útil para detectar regressão simples: mais warnings, mais failures ou mudança de comportamento.

`--udp` adiciona probes RPC `NULLPROC` via UDP. O padrão é TCP, porque é o caminho mais comum em NFS moderno.

`--ipv4-only` e `--ipv6-only` forçam a família de endereço nos checks TCP diretos. Isso ajuda quando DNS retorna A e AAAA, mas só uma pilha está funcionando. O mount em si continua sendo feito pelo `mount.nfs`.

`--no-nfs4-discovery` desliga o fallback da pseudo-root `/`. Sem isso, quando mountd não responde ou retorna lista vazia, o `nfsdiag` tenta `/` para cobrir servidores NFSv4-only.

`--mount-namespace` força o uso de mount namespace privado. `--no-mount-namespace` desliga a tentativa automática. Rodando como root, o padrão é tentar namespace privado para não sujar o namespace global.

`--dangerous-fs-tests` habilita probes de symlink, hardlink, FIFO e device node. Esses testes são úteis para diagnosticar export policy, root squash e comportamento do servidor, mas são opt-in por um motivo: eu não quero criar esse tipo de objeto em export de produção sem o operador pedir.

`--deep` é um alias para `--dangerous-fs-tests`.

`--allow-risky-mount-options` permite opções como `exec`, `suid` e `dev`, e também remove o hardening padrão `nosuid,nodev,noexec`. Use só quando você realmente precisa testar esse comportamento.

## Perfis

Os perfis são presets para reduzir digitação:

- `--profile quick`: não monta exports, reduz timeouts e amostras. Bom para triagem rápida de rede/RPC.
- `--profile safe`: desliga escrita e probes perigosos, com loop menor de `ESTALE`.
- `--profile readonly`: igual ao modo seguro/read-only.
- `--profile full`: habilita probes perigosos e usa os defaults completos.
- `--profile performance`: aumenta o benchmark para 64 MiB, usa 50 iterações de metadados e habilita `--sweep`.
- `--profile security`: habilita Kerberos, desliga escrita, força mount namespace e mantém probes perigosos desligados.

Exemplos:

```sh
sudo nfsdiag --profile quick 192.168.1.10
sudo nfsdiag --profile safe 192.168.1.10
sudo nfsdiag --profile performance 192.168.1.10
```

## Timeouts e controle de ritmo

`--timeout SEC` controla conexões de rede e chamadas RPC. O padrão é 5 segundos.

`--command-timeout SEC` controla comandos externos como `mount`, `umount`, `fio`, `systemctl` e `klist`. O padrão é 30 segundos.

`--fs-timeout SEC` limita grupos de testes no filesystem. O padrão é 30 segundos.

`--delay-ms MS` adiciona atraso entre exports. Em batch ou servidores sensíveis, isso evita bater em todos os exports de uma vez.

```sh
sudo nfsdiag --timeout 3 --command-timeout 15 --delay-ms 500 192.168.1.10
```

## Benchmark e stale handle

`--bench-bytes BYTES` define o tamanho do arquivo usado em leitura/escrita. O padrão é 4 MiB.

`--bench-iterations N` define quantas iterações entram no benchmark de metadados `create+rename+unlink`. O padrão é 10.

`--bench-type internal` usa o benchmark interno. `--bench-type fio` chama `fio`, que precisa estar instalado.

`--stale-iterations N` define quantas iterações o loop de `stat/readdir` executa procurando `ESTALE`. O padrão é 100.

```sh
sudo nfsdiag --bench-bytes 167772160 --bench-iterations 500 192.168.1.10
sudo nfsdiag --bench-type=fio 192.168.1.10
sudo nfsdiag --stale-iterations 1000 192.168.1.10
```

Sobre `ESTALE`: se o teste não encontrou stale handle, isso só quer dizer que ele não reproduziu no intervalo do teste. Não quer dizer que o problema nunca acontece.

## Saídas e relatórios

O formato padrão é texto com `[OK]`, `[WARN]`, `[FAIL]` e `[INFO]`. Por padrão ele mostra uma saída compacta. Com `--verbose`, mostra todos os passos.

`--json[=PATH]` gera relatório JSON. Sem path, ou com `-`, escreve no stdout.

```sh
nfsdiag --json 192.168.1.10
nfsdiag --json=report.json 192.168.1.10
```

`--html[=PATH]` gera um relatório HTML autocontido.

```sh
nfsdiag --html=report.html 192.168.1.10
```

`--output-dir DIR` grava um bundle com JSON, HTML, evidência em texto e `SHA256SUMS`.

```sh
sudo nfsdiag --output-dir ./nfsdiag-report 192.168.1.10
```

`--output-format text` é o padrão. `table` mostra tabela de resumo no final. `ndjson` emite um evento JSON por linha enquanto roda. `prometheus` imprime métricas em formato Prometheus/OpenMetrics. `junit` gera XML para CI.

```sh
sudo nfsdiag --output-format=table 192.168.1.10
sudo nfsdiag --output-format=ndjson 192.168.1.10 | jq 'select(.level=="fail")'
sudo nfsdiag --output-format=prometheus 192.168.1.10
sudo nfsdiag --output-format=junit 192.168.1.10
```

`--listen PORT` sobe um exporter HTTP simples com as métricas mais recentes. Ele reexecuta o diagnóstico a cada `--watch SEC`, ou a cada 60 segundos se `--watch` não for informado.

```sh
sudo nfsdiag --listen 9108 --watch 60 192.168.1.10
```

`--quiet` suprime stdout, útil quando você quer só arquivo de relatório. `--keep-temp` mantém o workspace temporário depois do teste para inspeção manual.

`-V, --version` imprime a versão. `-h, --help` mostra a ajuda.

O subcomando `diff` compara dois relatórios JSON:

```sh
nfsdiag diff before.json after.json
```

## Batch, watch e hook de falha

`--hosts-file FILE` lê um host por linha. Linhas vazias e comentários com `#` são ignorados.

```sh
sudo nfsdiag --hosts-file /etc/nfs-servers.txt --json=audit.json
```

`--watch SEC` reexecuta o diagnóstico no mesmo host até `Ctrl-C`.

```sh
sudo nfsdiag --watch 60 192.168.1.10
```

`--on-fail-exec SCRIPT` executa um script quando há falha. Ele não usa shell, resolve o caminho por diretórios confiáveis e passa um ambiente mínimo com `NFSDIAG_HOST`, `NFSDIAG_LEVEL`, `NFSDIAG_FAIL_COUNT` e `NFSDIAG_WARN_COUNT`.

```sh
sudo nfsdiag --on-fail-exec /usr/local/bin/alerta-nfs.sh 192.168.1.10
```

`--config FILE` carrega opções de um arquivo `key=value` antes de processar a CLI. As flags da linha de comando sobrescrevem o arquivo. O arquivo é recusado se não for de root ou do usuário atual, ou se for gravável por grupo/outros.

Exemplo:

```ini
timeout = 10
command-timeout = 20
bench-bytes = 8388608
output-format = table
mount-namespace = true
```

## Segurança por padrão

Como a ferramenta pode rodar como root e montar exports remotos, segurança entra no desenho:

- host, export path e mount options são validados antes de executar;
- helpers são resolvidos em diretórios confiáveis e executados com ambiente mínimo;
- `--on-fail-exec` não passa por shell;
- relatórios são abertos com `O_NOFOLLOW` e permissão `0600`;
- strings vindas do servidor são sanitizadas antes de exibir;
- paths de teste usam bytes aleatórios para evitar symlink pré-criado;
- `TMPDIR` é validado antes de criar workspace;
- opções de mount arriscadas precisam de flag explícita;
- probes de filesystem incomuns precisam de flag explícita.

Isso não transforma NFS em algo simples. Só reduz o risco de uma ferramenta de diagnóstico criar um problema maior enquanto tenta investigar outro.

## Testes do próprio projeto

O projeto tem testes unitários, self-test, fuzz harnesses para parsers e fixtures Docker que simulam falhas comuns:

- rpcbind inacessível;
- NFS em `2049` inacessível;
- mapa RPC sem NFS;
- mountd indisponível;
- lista de exports vazia;
- mount negado;
- permission denied;
- ACL não suportado;
- identidade sem acesso;
- export read-only;
- root squash;
- locking/statd ausente;
- stale handle;
- performance ruim.

Para rodar:

```sh
make check
make docker-build-all
sudo make test-fixtures
```

Algumas fixtures dependem do kernel e de privilégios Docker para NFS real. Quando a máquina não suporta isso, o runner marca como `SKIP`.

## Limitações

O `nfsdiag` observa o NFS pelo lado do cliente. Ele mostra sintomas com contexto e recomendações, mas algumas causas só aparecem no servidor: logs do nfsd, exportfs, SELinux/AppArmor, storage backend, carga do servidor, rede entre racks, appliance específico.

Também existem casos que dependem de timing. `ESTALE` é o exemplo clássico: se o handle não ficar stale durante a janela do teste, o diagnóstico fica limpo mesmo que a aplicação veja o problema depois.

Para mim, o valor da ferramenta é reduzir o espaço de busca. Em vez de começar com "NFS está ruim", eu quero sair com algo mais específico: `TCP/2049 não responde`, `mountd não lista export`, `uid=1000 não escreve`, `root está sendo squashed`, `NLM/statd não aparece`, `mount efetivo veio com soft`, `houve retransmissão RPC`, ou `o problema não foi reproduzido nesse intervalo`.

Isso já muda bastante o troubleshooting.
