# Nest — Guia de publicação (repositório novo)

O app já está pronto e testado localmente. Faltam só os passos de sempre para colocar no ar — desta vez em um repositório e projeto Vercel **novos**, separados do `webapps-store`.

## 1. Criar o repositório no GitHub

1. Acesse [github.com/new](https://github.com/new)
2. Nome sugerido: `nest-budget-app`
3. Deixe **Public** ou **Private** (tanto faz para o Vercel conseguir publicar) e **não** marque "Add a README" (vamos enviar os arquivos já prontos)
4. Clique em **Create repository**

## 2. Enviar os arquivos

A forma mais confiável (evita o problema de não conseguir selecionar a pasta inteira que tivemos da última vez):

- **Opção A — arrastar a pasta** (Chrome ou Edge): na página do repositório recém-criado, clique em "uploading an existing file" e **arraste a pasta `nest-budget-app` inteira** (descompactada) do seu computador para a área de upload. O Chrome/Edge preserva a estrutura de pastas quando você arrasta uma pasta de verdade (não funciona com clique + seleção de arquivos).
- **Opção B — GitHub Desktop**: se preferir não depender do navegador, o [GitHub Desktop](https://desktop.github.com/) permite apontar para a pasta local e sincronizar tudo de uma vez, sem esse tipo de limitação.

Confirme o commit ("Add Nest app files" ou similar).

## 3. Criar o projeto no Vercel

1. No [vercel.com](https://vercel.com), clique em **Add New → Project**
2. Selecione **Import** no repositório `nest-budget-app` que você acabou de criar
3. Na tela de configuração do time, **selecione o time "Conquista Astologica" (Hobby)** que você já usa — não clique em "Create a Team", isso força um Pro Trial que não é necessário
4. Framework Preset: deixe **Other** (é um site estático puro, sem build)
5. Root Directory: deixe o padrão (raiz do repositório)
6. Clique em **Deploy**

## 4. Um cuidado importante (aprendido da última vez)

**Não crie um arquivo `vercel.json` com `rewrites`/`cleanUrls`.** Da última vez isso fez o Vercel gerar um `middleware` automático que quebrou todas as rotas com erro 404. Este projeto foi construído para funcionar com a configuração padrão do Vercel — o `index.html` na raiz já serve o app inteiro em `/`. Não é necessário nenhum arquivo de configuração extra.

## 5. Testar

Depois do deploy, abra a URL que o Vercel gerar (algo como `nest-budget-app.vercel.app`). Você deve ver a tela do quiz ("Who's in your household?"). Percorra o quiz, chegue ao dashboard, adicione uma despesa e confira se tudo funciona.

Há uma planilha de teste em `test-data/my-old-budget-spreadsheet.csv` — pode usá-la em **Configurações → Importar do Excel/CSV** para testar a importação de planilha antiga (ela tem colunas Date/Description/Category/Amount, que o app já reconhece automaticamente).

## O que ainda falta (por decisão sua)

- **Leitura de recibo por foto (IA)**: o botão "Scan Receipt" já existe no dashboard, mas por enquanto mostra um aviso de "em breve" e direciona para o preenchimento manual — como combinamos, essa parte fica para depois (fluxo "traga sua própria conta de IA").
- **Domínio próprio / nome do projeto**: por enquanto o link será o `*.vercel.app` gerado automaticamente; se quiser um nome específico, dá para ajustar em Settings → Domains no próprio Vercel.
