import numpy as np
from PIL import Image
import tkinter as tk
from tkinter import filedialog, messagebox, ttk
import os

def bytes_to_vals(data_bytes, num_bits):
    vals = []
    if num_bits == 1:
        for b in data_bytes:
            vals.extend([(b >> i) & 1 for i in range(7, -1, -1)])
    elif num_bits == 2:
        for b in data_bytes:
            vals.extend([(b >> i) & 3 for i in range(6, -1, -2)])
    elif num_bits == 4:
        for b in data_bytes:
            vals.extend([(b >> i) & 15 for i in range(4, -1, -4)])
    return vals

def vals_to_bytes(vals, num_bits):
    data_bytes = bytearray()
    if num_bits == 1:
        for i in range(0, len(vals), 8):
            b = 0
            for j in range(8):
                b = (b << 1) | vals[i+j]
            data_bytes.append(b)
    elif num_bits == 2:
        for i in range(0, len(vals), 4):
            b = 0
            for j in range(4):
                b = (b << 2) | vals[i+j]
            data_bytes.append(b)
    elif num_bits == 4:
        for i in range(0, len(vals), 2):
            b = 0
            for j in range(2):
                b = (b << 4) | vals[i+j]
            data_bytes.append(b)
    return bytes(data_bytes)

def esconder_arquivo(caminho_imagem, caminho_arquivo, saida_imagem, num_bits=1):
    try:
        # Carrega a imagem e converte para array
        img = Image.open(caminho_imagem).convert('RGB')
        dados_img = np.array(img)
        
        # Lê o arquivo
        with open(caminho_arquivo, 'rb') as f:
            bytes_arquivo = f.read()
            
        nome_arquivo = os.path.basename(caminho_arquivo)
        bytes_nome = nome_arquivo.encode('utf-8')
        tamanho_nome = len(bytes_nome)
        
        # Header do payload
        tamanho = len(bytes_arquivo)
        bytes_totais = tamanho.to_bytes(4, byteorder='big') + tamanho_nome.to_bytes(2, byteorder='big') + bytes_nome + bytes_arquivo
        
        # Configuração (1 byte) -> sempre usa 1 bit/canal (8 valores)
        config_vals = bytes_to_vals(bytes([num_bits]), 1)
        
        # O Payload usa num_bits/canal
        payload_vals = bytes_to_vals(bytes_totais, num_bits)
        
        if len(config_vals) + len(payload_vals) > dados_img.size:
            return False, f"O arquivo é grande demais para esta imagem. Mude para 2 ou 4 bits, ou escolha uma imagem maior."

        formato_original = dados_img.shape
        dados_flat = dados_img.flatten()
        
        # Escreve a configuração usando máscara de 1 bit (254)
        for i in range(8):
            dados_flat[i] = (dados_flat[i] & 254) | config_vals[i]
            
        # Escreve o payload usando a máscara apropriada
        mask = 256 - (1 << num_bits)
        for i in range(len(payload_vals)):
            idx = i + 8
            dados_flat[idx] = (dados_flat[idx] & mask) | payload_vals[i]
            
        img_final = Image.fromarray(dados_flat.reshape(formato_original))
        img_final.save(saida_imagem, format="PNG")
        return True, f"Arquivo escondido com sucesso em:\n{saida_imagem}"
    except Exception as e:
        return False, f"Erro ao esconder: {str(e)}"

def extrair_dados_imagem(caminho_imagem):
    try:
        img = Image.open(caminho_imagem)
        dados_flat = np.array(img).flatten()
        
        # Extrai os primeiros 8 canais (1 bit cada) para descobrir num_bits
        config_bits = dados_flat[:8] & 1
        num_bits_byte = vals_to_bytes(config_bits, 1)[0]
        num_bits = num_bits_byte
        
        if num_bits not in [1, 2, 4]:
            return False, None, "A imagem não contém um arquivo oculto compatível ou está corrompida."
            
        vals_per_byte = 8 // num_bits
        mask = (1 << num_bits) - 1
        
        # Ler o cabeçalho base (6 bytes -> 4 tamanho_arquivo, 2 tamanho_nome)
        header_vals_len = 6 * vals_per_byte
        
        if 8 + header_vals_len > len(dados_flat):
            return False, None, "Imagem pequena demais, corrompida."
            
        header_vals = dados_flat[8 : 8 + header_vals_len] & mask
        header_bytes = vals_to_bytes(header_vals, num_bits)
        
        tamanho_arquivo = int.from_bytes(header_bytes[:4], byteorder='big')
        tamanho_nome = int.from_bytes(header_bytes[4:6], byteorder='big')
        
        if tamanho_arquivo <= 0 or tamanho_nome <= 0:
             return False, None, "Nenhum arquivo válido encontrado."
             
        total_payload_bytes = 6 + tamanho_nome + tamanho_arquivo
        total_payload_vals_len = total_payload_bytes * vals_per_byte
        
        if 8 + total_payload_vals_len > len(dados_flat):
             return False, None, "O arquivo escondido está incompleto ou a imagem foi alterada."
             
        # Lê apenas os valores que compõem o payload inteiro
        payload_vals = dados_flat[8 : 8 + total_payload_vals_len] & mask
        todos_bytes = vals_to_bytes(payload_vals, num_bits)
        
        nome_arquivo_original = todos_bytes[6:6+tamanho_nome].decode('utf-8', errors='replace')
        dados_originais = todos_bytes[6+tamanho_nome : ]
        
        return True, (nome_arquivo_original, dados_originais), ""
    except Exception as e:
        return False, None, f"Erro ao extrair: {str(e)}"

class AppEsteganografia:
    def __init__(self, root):
        self.root = root
        self.root.title("Esteganografia - Imagem Carona")
        self.root.geometry("520x420")
        self.root.resizable(False, False)
        
        self.notebook = ttk.Notebook(root)
        self.notebook.pack(pady=10, padx=10, expand=True, fill="both")
        
        self.aba_esconder = ttk.Frame(self.notebook)
        self.aba_extrair = ttk.Frame(self.notebook)
        
        self.notebook.add(self.aba_esconder, text="Esconder Arquivo")
        self.notebook.add(self.aba_extrair, text="Extrair Arquivo")
        
        self.setup_aba_esconder()
        self.setup_aba_extrair()
        
    def setup_aba_esconder(self):
        frame = ttk.Frame(self.aba_esconder, padding="20")
        frame.pack(expand=True, fill="both")
        
        self.var_img_esconder = tk.StringVar()
        self.var_arq_esconder = tk.StringVar()
        self.var_num_bits = tk.StringVar(value="1")
        
        # Imagem Base
        ttk.Label(frame, text="1. Selecione a Imagem Base (PNG/JPG):").pack(anchor="w", pady=(0, 5))
        frame_img = ttk.Frame(frame)
        frame_img.pack(fill="x", pady=(0, 5))
        ttk.Entry(frame_img, textvariable=self.var_img_esconder, state="readonly").pack(side="left", fill="x", expand=True, padx=(0, 10))
        ttk.Button(frame_img, text="Procurar...", command=lambda: self.selecionar_arquivo(self.var_img_esconder, [("Imagens", "*.png *.jpg *.jpeg")])).pack(side="right")
        
        self.lbl_capacidade = ttk.Label(frame, text="Capacidade disponível: -- KB", foreground="gray")
        self.lbl_capacidade.pack(anchor="w", pady=(0, 15))
        
        # Qualidade vs Espaço (num bits)
        ttk.Label(frame, text="2. Configuração (Espaço vs Qualidade):").pack(anchor="w", pady=(0, 5))
        frame_bits = ttk.Frame(frame)
        frame_bits.pack(fill="x", pady=(0, 15))
        opcoes_bits = [
            "1 bit (Maior Qualidade da Imagem, Menos Espaço)",
            "2 bits (Qualidade Média, 2x Espaço)",
            "4 bits (Qualidade Inferior, 4x Espaço)"
        ]
        self.cb_bits = ttk.Combobox(frame_bits, textvariable=self.var_num_bits, values=opcoes_bits, state="readonly")
        self.cb_bits.set(opcoes_bits[0])
        self.cb_bits.pack(fill="x", expand=True)
        
        self.var_img_esconder.trace_add('write', self.atualizar_capacidade)
        self.var_num_bits.trace_add('write', self.atualizar_capacidade)
        
        # Arquivo para Esconder
        ttk.Label(frame, text="3. Selecione o Arquivo para Esconder:").pack(anchor="w", pady=(0, 5))
        frame_arq = ttk.Frame(frame)
        frame_arq.pack(fill="x", pady=(0, 25))
        ttk.Entry(frame_arq, textvariable=self.var_arq_esconder, state="readonly").pack(side="left", fill="x", expand=True, padx=(0, 10))
        ttk.Button(frame_arq, text="Procurar...", command=lambda: self.selecionar_arquivo(self.var_arq_esconder, [("Todos os arquivos", "*.*")])).pack(side="right")
        
        # Botão de Ação
        ttk.Button(frame, text="Esconder e Salvar Como...", command=self.executar_esconder).pack(pady=10, ipadx=10, ipady=5)
        
    def setup_aba_extrair(self):
        frame = ttk.Frame(self.aba_extrair, padding="20")
        frame.pack(expand=True, fill="both")
        
        self.var_img_extrair = tk.StringVar()
        
        ttk.Label(frame, text="1. Selecione a Imagem Modificada (PNG):").pack(anchor="w", pady=(0, 5))
        frame_img = ttk.Frame(frame)
        frame_img.pack(fill="x", pady=(0, 25))
        ttk.Entry(frame_img, textvariable=self.var_img_extrair, state="readonly").pack(side="left", fill="x", expand=True, padx=(0, 10))
        ttk.Button(frame_img, text="Procurar...", command=lambda: self.selecionar_arquivo(self.var_img_extrair, [("Imagens PNG", "*.png")])).pack(side="right")
        
        ttk.Button(frame, text="Extrair Arquivo e Salvar Como...", command=self.executar_extrair).pack(pady=10, ipadx=10, ipady=5)
        
    def get_num_bits(self):
        val = self.var_num_bits.get()
        if val.startswith("1"): return 1
        if val.startswith("2"): return 2
        if val.startswith("4"): return 4
        return 1

    def atualizar_capacidade(self, *args):
        caminho = self.var_img_esconder.get()
        num_bits = self.get_num_bits()
        
        if caminho and os.path.exists(caminho):
            try:
                with Image.open(caminho) as img:
                    width, height = img.size
                
                # Capacidade: os 8 primeiros valores armazenam config, restam (pixels * 3) - 8
                # Cada valor restante armazena `num_bits`.
                capacidade_bits = ((width * height * 3) - 8) * num_bits
                capacidade_bytes = capacidade_bits // 8
                capacidade_kb = capacidade_bytes / 1024
                self.lbl_capacidade.config(text=f"Capacidade disponível: {capacidade_kb:.2f} KB (usando {num_bits} bit(s))", foreground="blue")
            except Exception:
                self.lbl_capacidade.config(text="Capacidade disponível: Erro ao ler imagem", foreground="red")
        else:
            self.lbl_capacidade.config(text="Capacidade disponível: -- KB", foreground="gray")

    def selecionar_arquivo(self, var, filetypes):
        caminho = filedialog.askopenfilename(filetypes=filetypes)
        if caminho:
            var.set(caminho)
            
    def executar_esconder(self):
        img_path = self.var_img_esconder.get()
        arq_path = self.var_arq_esconder.get()
        num_bits = self.get_num_bits()
        
        if not img_path or not arq_path:
            messagebox.showwarning("Atenção", "Por favor, selecione a imagem base e o arquivo a ser escondido.")
            return
            
        salvar_path = filedialog.asksaveasfilename(
            defaultextension=".png", 
            filetypes=[("Imagem PNG", "*.png")], 
            title="Salvar Imagem Modificada Como"
        )
        
        if not salvar_path:
            return
            
        sucesso, msg = esconder_arquivo(img_path, arq_path, salvar_path, num_bits)
        if sucesso:
            messagebox.showinfo("Sucesso", msg)
            self.var_img_esconder.set("")
            self.var_arq_esconder.set("")
        else:
            messagebox.showerror("Erro", msg)
            
    def executar_extrair(self):
        img_path = self.var_img_extrair.get()
        
        if not img_path:
            messagebox.showwarning("Atenção", "Por favor, selecione a imagem contendo o arquivo.")
            return
            
        sucesso, dados, msg = extrair_dados_imagem(img_path)
        if not sucesso:
            messagebox.showerror("Erro", msg)
            return
            
        nome_original, dados_originais = dados
        _, ext = os.path.splitext(nome_original)
        
        salvar_path = filedialog.asksaveasfilename(
            title="Salvar Arquivo Extraído Como",
            initialfile=nome_original,
            defaultextension=ext,
            filetypes=[("Formato Original", f"*{ext}"), ("Todos os arquivos", "*.*")]
        )
        
        if not salvar_path:
            return
            
        try:
            with open(salvar_path, 'wb') as f:
                f.write(dados_originais)
            messagebox.showinfo("Sucesso", f"Arquivo extraído com sucesso para:\n{salvar_path}")
            self.var_img_extrair.set("")
        except Exception as e:
            messagebox.showerror("Erro", f"Erro ao salvar arquivo: {str(e)}")

if __name__ == "__main__":
    root = tk.Tk()
    
    style = ttk.Style(root)
    if 'clam' in style.theme_names():
        style.theme_use('clam')
        
    app = AppEsteganografia(root)
    root.mainloop()