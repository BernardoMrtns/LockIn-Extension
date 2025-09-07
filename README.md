Perfeito 👍 Então vou te entregar a versão do **README.md** já formatada em Markdown, mas com a descrição e tópicos em **português**. Assim você só copia e cola no GitHub.

---

# 🔒 Lock In — Extensão de Produtividade para o Chrome

O **Lock In** é uma extensão para o Google Chrome criada para ajudar você a manter o foco.
Ela bloqueia sites que causam distração durante sessões de estudo ou trabalho, registra suas tentativas de acesso e exibe relatórios no final da sessão.

---

## ✨ Funcionalidades

* ⏱️ **Sessões de Foco**
  Defina um tempo de foco (padrão: 25 minutos) para evitar distrações.

* 🚫 **Bloqueio de Sites**
  Adicione os sites que você deseja bloquear (ex: YouTube, Instagram, Twitter).

* 📊 **Registro de Tentativas**
  Cada vez que você tenta acessar um site bloqueado, o Lock In contabiliza a tentativa.

* 🔔 **Notificações e Badge**
  Você recebe uma notificação quando a sessão começa/termina e vê no ícone da extensão o número de tentativas.

* 📑 **Resumo de Acessos (summary.html)**
  Consulte um relatório de quantas vezes tentou acessar cada site bloqueado durante a sessão.

---

## 🐞 Problemas Conhecidos

---

## 🛠️ Tecnologias Utilizadas

* **Linguagem:** JavaScript (Manifest V3)
* **APIs:** `chrome.storage.local`, `chrome.tabs`, `chrome.alarms`, `chrome.notifications`
* **Frontend:** HTML + CSS (popup, página de bloqueio, página de resumo)
* **Background:** Service Worker (`background.js`)

---

## 🚀 Como Instalar e Usar

1. Clone este repositório:

   ```bash
   git clone https://github.com/seu-usuario/lock-in-extension.git
   ```

2. Abra o Chrome e vá em:
   `chrome://extensions/`

3. Ative o **Modo do Desenvolvedor** e clique em **Carregar sem compactação**.

4. Selecione a pasta do projeto.

5. Inicie uma sessão de foco e adicione os sites que deseja bloquear.

---
