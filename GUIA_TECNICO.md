# Guia Técnico - Image Format Converter Pro

Este documento descreve o funcionamento interno do sistema de esteganografia e as correções recentes aplicadas ao protocolo de ocultação de dados.

## 🚀 Novas Funcionalidades e Correções

### 1. Suporte a Colar Imagens (Ctrl+V)
Agora é possível adicionar imagens diretamente da área de transferência. Ao usar o comando `Ctrl+V` (ou `Cmd+V`), o sistema intercepta a imagem, gera um arquivo temporário em PNG e o adiciona à fila de processamento.

### 2. Protocolo de Dados V3 (Integridade Garantida)
O sistema agora utiliza o **Protocolo V3**, que inclui verificação de integridade via Checksum (CRC32):
- **Magic Bytes:** `0xCA 0x8B` (V3) ou `0xCA 0x8A` (V2).
- **Cabeçalho V3 (16 bytes):** 
  - Magic (2)
  - Tamanho do Chunk (4)
  - Tamanho do Nome (2)
  - Total de Partes (2)
  - Índice da Parte (2)
  - **Checksum CRC32 (4)** -> *Novo na V3*
- **Dados Variáveis:** Nome do Arquivo + Payload Binário.

Isso garante que, se um único bit for alterado (por compressão ou edição), o sistema detectará a corrupção e avisará o usuário durante a restauração.

### 3. Protocolo de Dados V4 (Modo QR Data - Matriz de Cores)
O **Protocolo V4** é uma mudança de paradigma: em vez de esconder dados em uma imagem existente, ele gera uma nova imagem do zero.
- **Magic Bytes:** `0xCA 0x8C`.
- **Estrutura Visual:** Mosaico de blocos de 4x4 pixels.
- **Densidade:** Cada bloco armazena 3 bytes de dados (R, G, B).
- **Cabeçalho V4 (12 bytes base):** 
  - Magic (2)
  - Tamanho do Nome (2)
  - Tamanho dos Dados (4)
  - Checksum CRC32 (4)
- **Vantagem:** Permite converter qualquer arquivo diretamente em uma imagem visual, útil para compartilhamento em plataformas que aceitam apenas imagens.

### 4. Correção de Redimensionamento do Canvas
Um erro crítico foi corrigido onde o canvas interno mantinha as dimensões da imagem anterior ao processar múltiplos arquivos. Agora, o canvas é redimensionado exatamente para as dimensões de cada imagem antes de salvar, garantindo a integridade dos pixels.

## 🛠 Como usar para resultados profissionais

### Para ocultar metadados:
1. Selecione ou **cole** a imagem de fundo.
2. Selecione o arquivo que deseja esconder.
3. Escolha o **Nível de Processamento**:
   - **Nível 1 (1 bit):** Praticamente impossível de detectar visualmente.
   - **Nível 3 (4 bits):** Maior capacidade, mas pode introduzir ruído visível em áreas de cor sólida.
4. Clique em **Converter & Baixar**.

### Para restaurar:
1. Arraste as imagens convertidas para a aba "Restaurar Original".
2. Se o arquivo foi dividido em partes, você pode selecionar todas de uma vez (a ordem não importa, o sistema as organiza automaticamente).
3. Clique em **Restaurar Arquivo Original**.

---
*Nota: Este sistema foi otimizado para navegadores modernos (Chrome/Edge/Firefox) e utiliza compressão Lossless (sem perdas) via formato PNG.*
