# leandrosf.com

Este repositório contém o código fonte do meu site pessoal [leandrosf.com](https://www.leandrosf.com), desenvolvido utilizando o framework [Hugo](https://gohugo.io/).

## Sobre o Site

O site serve como meu portfólio pessoal e blog, onde compartilho:
- Informações sobre minha experiência profissional
- Projetos em que estou trabalhando
- Artigos técnicos no blog

## Tecnologias Utilizadas

- **Framework**: Hugo
- **Tema**: PaperMod
- **Linguagem Principal**: Português (Brasil)

## Estrutura do Projeto

- **content/**: Conteúdo do site (posts, projetos, páginas)
- **layouts/**: Templates e layouts customizados
- **static/**: Arquivos estáticos
- **assets/**: Recursos como CSS, JavaScript, etc.
- **themes/**: Tema PaperMod (submodule)

## Como Executar Localmente

1. Clone o repositório:
   ```
   git clone https://github.com/seu-usuario/leandrosf.com.git
   git submodule update --init --recursive
   ```

2. Instale o Hugo (caso ainda não tenha):
   ```
   # macOS com Homebrew
   brew install hugo
   
   # Windows com Chocolatey
   choco install hugo -confirm
   
   # Linux
   sudo apt-get install hugo
   ```

3. Execute o servidor local:
   ```
   hugo server -D
   ```

4. Acesse o site em `http://localhost:1313`

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

## Contato

Para mais informações, entre em contato através das redes sociais listadas no site.

---

© Leandro Ferreira 