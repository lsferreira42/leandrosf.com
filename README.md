# leandrosf.com

Este repositório contém o código fonte do meu site pessoal [leandrosf.com](https://www.leandrosf.com), desenvolvido utilizando o framework [Hugo](https://gohugo.io/).

## O que tem no site

- **Sobre**: quem eu sou e por onde passei
- **Projetos**: ferramentas open source e os produtos da ftclabs
- **Blog**: posts técnicos
- **Livros**: os livros que eu li, com resumo e os trechos que marquei

Hugo com o tema PaperMod, em português. O tema está copiado dentro de
`themes/PaperMod` (não é submódulo), então um `git clone` simples já traz tudo.

## Estrutura

- `content/posts/<slug>/index.md`: um post por pasta, com a `capa.webp` e as
  outras imagens dele ao lado
- `content/projetos/`: uma página por projeto
- `content/livros/<slug>/index.md`: um livro por pasta, com a `capa.webp`
- `layouts/`: o que foi sobrescrito do tema (home, listagens, sumário, estante)
- `assets/css/extended/`: CSS próprio, que o PaperMod junta ao dele
- `static/`: favicons e a foto

## Rodar localmente

```
git clone git@github.com:lsferreira42/leandrosf.com.git
cd leandrosf.com
hugo server -D
```

O site abre em `http://localhost:1313`. Precisa do Hugo **extended** 0.125.7 ou
mais novo: o PaperMod exige essa versão, e as miniaturas em WebP só saem no
extended. Em produção roda o 0.151.0.

## Escrever

Post novo:

```
hugo new posts/meu-post/index.md
```

A capa vai em `content/posts/meu-post/capa.webp` e entra no front matter:

```toml
[cover]
image = "capa.webp"
alt = "descrição da imagem"
relative = true
```

Ela aparece no topo do post, na listagem do blog e na home. Tempo de leitura e
o sumário "Neste texto" saem sozinhos. O sumário aparece quando o post tem três
títulos ou mais, e `sumarioNivel = 2` no front matter deixa só os `##`.

Shortcodes próprios, pra usar dentro de um post:

- `{{</* ilustra src="arquivo.webp" alt="..." caption="..." */>}}`: imagem da pasta
  do post, redimensionada
- `{{</* svg src="arquivo.svg" caption="..." */>}}`: SVG da pasta do post posto
  direto no HTML, pra herdar as cores do tema
- `{{</* larga */>}} tabela {{</* /larga */>}}`: tabela que rola pro lado no celular
- `{{</* dns lab="..." titulo="..." */>}}`: os quadros interativos do post de DNS

Um post pode carregar CSS e JavaScript só dele: os arquivos ficam na pasta do
post e entram no front matter como `estilos = ["a.css"]` e `scripts = ["a.js"]`.

Livro novo:

```
hugo new livros/nome-do-livro
```

Isso cria a pasta com o `index.md` já no formato da estante. Falta pôr a
`capa.webp` (proporção 2:3) na pasta, preencher `autor`, `description`,
`edicao`, `link` e a lista `highlights` (cada item com `texto` e `onde`), e
escrever o resumo no corpo. Com `draft: false` o livro aparece em `/livros/`.

## Deploy

O site roda no k3s da alcserver000, no namespace `leandrosf`. Os manifests e o
script de deploy ficam em `deploy/k3s/`.

```
make k3s-deploy   # git push origin main, git pull no servidor e deploy/k3s/deploy.sh
make k3s-status   # pods e ingress
make k3s-logs     # últimas linhas do log do nginx
```

Só vai pro ar o que foi pro GitHub: o servidor puxa o repo em
`/root/leandrosf.com` e faz tudo lá. O `public/` não está no git, então o
`deploy.sh` apaga o `public/`, roda o Hugo do servidor (`/usr/local/sbin/hugo`,
0.151.0 extended; o PaperMod exige 0.125.7 ou mais novo), constrói a imagem com
o `Dockerfile` da raiz, manda pro registry local e aplica os manifests.

O nginx de borda (`website.conf` no repo alicercelabs) repassa
`www.leandrosf.com` pro ingress do k3s e responde o `leandrosf.com` com
redirect.

### Se o k3s quebrar

O `docker-compose.yml` da raiz é o caminho de volta. Ele fica parado no
servidor e o deploy deixa um atalho pronto:

```
sudo /root/compose-emergencia/leandrosf.sh
```

Ele zera o deployment no k3s, sobe o compose com o `public/` do último deploy e
devolve o vhost antigo (`website.conf.compose`), que aponta pro
`leandrosfcom-website-1:9034`. Quando o k3s voltar:
`git -C /apisbr checkout automation/infra/nginx/conf.d`, reload do nginx,
`docker compose down` em `/root/leandrosf.com` e `make k3s-deploy` de novo.
