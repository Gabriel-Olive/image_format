// --- Utility Functions ---

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 4000);
}

function getRgbIndex(i) {
    // Maps a flat RGB array index to Canvas RGBA array index
    const pixelIndex = Math.floor(i / 3);
    const channelOffset = i % 3;
    return (pixelIndex * 4) + channelOffset;
}

function bytes_to_vals(data_bytes, num_bits) {
    const vals = [];
    if (num_bits === 1) {
        for (let i = 0; i < data_bytes.length; i++) {
            const b = data_bytes[i];
            for (let j = 7; j >= 0; j--) vals.push((b >> j) & 1);
        }
    } else if (num_bits === 2) {
        for (let i = 0; i < data_bytes.length; i++) {
            const b = data_bytes[i];
            for (let j = 6; j >= 0; j -= 2) vals.push((b >> j) & 3);
        }
    } else if (num_bits === 4) {
        for (let i = 0; i < data_bytes.length; i++) {
            const b = data_bytes[i];
            for (let j = 4; j >= 0; j -= 4) vals.push((b >> j) & 15);
        }
    }
    return vals;
}

function vals_to_bytes(vals, num_bits) {
    const data_bytes = [];
    if (num_bits === 1) {
        for (let i = 0; i < vals.length; i += 8) {
            let b = 0;
            for (let j = 0; j < 8; j++) b = (b << 1) | vals[i + j];
            data_bytes.push(b);
        }
    } else if (num_bits === 2) {
        for (let i = 0; i < vals.length; i += 4) {
            let b = 0;
            for (let j = 0; j < 4; j++) b = (b << 2) | vals[i + j];
            data_bytes.push(b);
        }
    } else if (num_bits === 4) {
        for (let i = 0; i < vals.length; i += 2) {
            let b = 0;
            for (let j = 0; j < 2; j++) b = (b << 4) | vals[i + j];
            data_bytes.push(b);
        }
    }
    return new Uint8Array(data_bytes);
}

function intToBytes(num, size) {
    const bytes = new Uint8Array(size);
    for (let i = size - 1; i >= 0; i--) {
        bytes[i] = num & 0xff;
        num = Math.floor(num / 256);
    }
    return bytes;
}

function bytesToInt(bytes) {
    let num = 0;
    for (let i = 0; i < bytes.length; i++) {
        num = num * 256 + bytes[i];
    }
    return num;
}

function concatUint8Arrays(arrays) {
    const totalLength = arrays.reduce((acc, val) => acc + val.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
}

function loadImageData(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.getElementById('canvas');
            // Ensure canvas is large enough, but we can reuse it
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(img, 0, 0);
            resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
        };
        img.onerror = () => reject(new Error("Failed to load image"));
        img.src = URL.createObjectURL(file);
    });
}

function detectExistingData(imageData) {
    const data = imageData.data;
    const totalChannels = (imageData.width * imageData.height * 3) - 8;

    // Extract Config (first 8 channels)
    const configVals = [];
    for (let i = 0; i < 8; i++) {
        configVals.push(data[getRgbIndex(i)] & 1);
    }
    const numBits = vals_to_bytes(configVals, 1)[0];

    if (![1, 2, 4].includes(numBits)) {
        return false;
    }

    const valsPerByte = 8 / numBits;
    const mask = (1 << numBits) - 1;
    
    // Read enough bytes to check V2 header (12 bytes)
    const headerLen = 12;
    const headerValsLen = headerLen * valsPerByte;
    if (headerValsLen > totalChannels) return false;

    const headerVals = [];
    for (let i = 0; i < headerValsLen; i++) {
        headerVals.push(data[getRgbIndex(i + 8)] & mask);
    }
    
    const headerBytes = vals_to_bytes(headerVals, numBits);
    
    // Protocol V2 (0xCA 0x8A)
    if (headerBytes[0] === 0xCA && headerBytes[1] === 0x8A) {
        return "V2";
    } 
    
    // Fallback Protocol V1
    const fileSize = bytesToInt(headerBytes.slice(0, 4));
    const nameSize = bytesToInt(headerBytes.slice(4, 6));

    if (fileSize > 0 && fileSize < totalChannels && nameSize > 0 && nameSize < 255) {
        return "V1";
    }

    return false;
}

// --- Main App Logic ---

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    const hideImageInput = document.getElementById('hide-image-input');
    const hideImageMsg = document.getElementById('hide-image-msg');
    const hideFileInput = document.getElementById('hide-file-input');
    const hideFileMsg = document.getElementById('hide-file-msg');
    const bitConfig = document.getElementById('bit-config');
    const capacityInfo = document.getElementById('capacity-info');
    const hideBtn = document.getElementById('hide-btn');

    const extractImageInput = document.getElementById('extract-image-input');
    const extractImageMsg = document.getElementById('extract-image-msg');
    const extractBtn = document.getElementById('extract-btn');

    // State
    let currentHideImages = [];
    let currentHideFile = null;
    let currentExtractImages = [];

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // File Drop Areas Setup
    function setupFileDropArea(areaId, inputId, msgId, onChange, isMultiple) {
        const area = document.getElementById(areaId);
        const input = document.getElementById(inputId);
        const msg = document.getElementById(msgId);

        area.addEventListener('dragover', (e) => {
            e.preventDefault();
            area.classList.add('dragover');
        });

        area.addEventListener('dragleave', () => {
            area.classList.remove('dragover');
        });

        area.addEventListener('drop', (e) => {
            e.preventDefault();
            area.classList.remove('dragover');
            if (e.dataTransfer.files.length) {
                input.files = e.dataTransfer.files;
                handleFileSelect(input.files, msg, onChange, isMultiple);
            }
        });

        input.addEventListener('change', () => {
            if (input.files.length) {
                handleFileSelect(input.files, msg, onChange, isMultiple);
            }
        });
    }

    function handleFileSelect(files, msgElement, onChange, isMultiple) {
        let text = "";
        if (files.length === 0) {
            text = "Arraste e solte ou clique para selecionar";
            msgElement.classList.remove('selected');
        } else if (files.length === 1) {
            text = files[0].name;
            msgElement.classList.add('selected');
        } else {
            text = `${files.length} arquivos selecionados`;
            msgElement.classList.add('selected');
        }
        msgElement.textContent = text;
        
        if (isMultiple) {
            onChange(Array.from(files));
        } else {
            onChange(files[0]);
        }
    }

    // Capacity Calculation
    async function updateCapacity() {
        if (!currentHideImages || currentHideImages.length === 0) {
            capacityInfo.textContent = "Buffer de Conversão: -- KB";
            capacityInfo.className = "capacity-info";
            return;
        }

        try {
            capacityInfo.textContent = "Calculando capacidade...";
            capacityInfo.className = "capacity-info";

            const numBits = parseInt(bitConfig.value);
            let totalCapacityBytes = 0;

            const promises = currentHideImages.map(file => {
                return new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => {
                        const width = img.width;
                        const height = img.height;
                        const capacityBits = ((width * height * 3) - 8) * numBits;
                        resolve(Math.floor(capacityBits / 8));
                    };
                    img.onerror = () => resolve(0);
                    img.src = URL.createObjectURL(file);
                });
            });

            const capacities = await Promise.all(promises);
            totalCapacityBytes = capacities.reduce((a, b) => a + b, 0);

            const capacityKB = (totalCapacityBytes / 1024).toFixed(2);
            capacityInfo.textContent = `Buffer de Conversão Total: ${capacityKB} KB (Nível de Processamento ${numBits} em ${currentHideImages.length} imagens)`;
            capacityInfo.className = "capacity-info has-capacity";
            
            validateHideState();
        } catch (e) {
            capacityInfo.textContent = "Erro ao ler a capacidade da imagem";
            capacityInfo.className = "capacity-info error";
        }
    }

    function validateHideState() {
        hideBtn.disabled = !(currentHideImages.length > 0 && currentHideFile);
    }

    // Setup Hide File Inputs
    setupFileDropArea('hide-image-area', 'hide-image-input', 'hide-image-msg', (files) => {
        currentHideImages = Array.from(files);
        updateCapacity();
    }, true);

    // Permitir colar imagens com Ctrl+V
    document.addEventListener('paste', (e) => {
        // Verificar se estamos na aba de esconder
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab || activeTab.dataset.target !== 'hide-tab') return;

        const items = e.clipboardData.items;
        let imagePasted = false;
        
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
                    const newFile = new File([file], `colado_${dateStr}.png`, { type: file.type });
                    
                    if (!Array.isArray(currentHideImages)) {
                        currentHideImages = Array.from(currentHideImages || []);
                    }
                    currentHideImages.push(newFile);
                    imagePasted = true;
                }
            }
        }

        if (imagePasted) {
            const msgElement = document.getElementById('hide-image-msg');
            msgElement.classList.add('selected');
            msgElement.textContent = `${currentHideImages.length} arquivos selecionados`;
            updateCapacity();
            showToast("Imagem colada da área de transferência!");
        }
    });

    setupFileDropArea('hide-file-area', 'hide-file-input', 'hide-file-msg', (file) => {
        currentHideFile = file;
        validateHideState();
    }, false);

    bitConfig.addEventListener('change', updateCapacity);

    // Setup Extract File Inputs
    setupFileDropArea('extract-image-area', 'extract-image-input', 'extract-image-msg', (files) => {
        currentExtractImages = files;
        extractBtn.disabled = currentExtractImages.length === 0;
    }, true);

    // Hide Logic
    hideBtn.addEventListener('click', async () => {
        try {
            hideBtn.disabled = true;
            hideBtn.textContent = "Processando...";

            const fileBytes = new Uint8Array(await currentHideFile.arrayBuffer());
            const numBits = parseInt(bitConfig.value);
            
            // 1. Calculate how many parts we need and check for existing data
            const processedImages = [];
            const imagesWithData = [];
            let remainingBytesToFit = fileBytes.length;
            const nameBytes = new TextEncoder().encode(currentHideFile.name);
            const nameLenBytes = intToBytes(nameBytes.length, 2);
            
            // Header V2 is 12 bytes + name length
            const headerBytesLength = 12 + nameBytes.length;

            for (const imgFile of currentHideImages) {
                const imageData = await loadImageData(imgFile);
                
                // --- NOVO: Verificação de dados existentes ---
                const existingProtocol = detectExistingData(imageData);
                if (existingProtocol) {
                    imagesWithData.push(imgFile.name);
                }

                const totalChannels = (imageData.width * imageData.height * 3) - 8;
                const maxBytesAvailable = Math.floor((totalChannels * numBits) / 8);
                const maxPayloadChunk = maxBytesAvailable - headerBytesLength;

                if (maxPayloadChunk > 0) {
                    processedImages.push({ imgFile, imageData, maxPayloadChunk });
                }
            }

            // --- NOVO: Bloquear se houver dados ---
            if (imagesWithData.length > 0) {
                const names = imagesWithData.join(", ");
                showToast(`Operação cancelada: As seguintes imagens já contêm dados: ${names}`, "error");
                hideBtn.disabled = false;
                hideBtn.textContent = "Converter & Baixar";
                return;
            }

            let totalPartsNeeded = 0;
            let checkRemaining = fileBytes.length;
            for (const img of processedImages) {
                if (checkRemaining <= 0) break;
                totalPartsNeeded++;
                checkRemaining -= img.maxPayloadChunk;
            }

            if (checkRemaining > 0) {
                showToast("O arquivo/metadados é muito grande para as imagens combinadas.", "error");
                hideBtn.disabled = false;
                hideBtn.textContent = "Converter & Baixar";
                return;
            }

            // 2. Embed into images
            let currentOffset = 0;
            const totalPartsBytes = intToBytes(totalPartsNeeded, 2);
            const magicBytes = new Uint8Array([0xCA, 0x8A]);

            for (let partIndex = 0; partIndex < totalPartsNeeded; partIndex++) {
                const imgData = processedImages[partIndex];
                const chunk_size = Math.min(fileBytes.length - currentOffset, imgData.maxPayloadChunk);
                const chunkBytes = fileBytes.slice(currentOffset, currentOffset + chunk_size);
                
                const sizeBytes = intToBytes(chunk_size, 4);
                const partIndexBytes = intToBytes(partIndex, 2);

                const payloadBytes = concatUint8Arrays([
                    magicBytes, sizeBytes, nameLenBytes, totalPartsBytes, partIndexBytes, nameBytes, chunkBytes
                ]);

                const configVals = bytes_to_vals(new Uint8Array([numBits]), 1);
                const payloadVals = bytes_to_vals(payloadBytes, numBits);
                
                const data = imgData.imageData.data;

                // --- NOVO: Forçar Alpha 255 para evitar corrupção de cor pelo navegador ---
                for (let i = 3; i < data.length; i += 4) {
                    data[i] = 255;
                }

                // Write Config (1 bit mask: 254)
                for (let i = 0; i < 8; i++) {
                    const idx = getRgbIndex(i);
                    data[idx] = (data[idx] & 254) | configVals[i];
                }

                // Write Payload
                const mask = 256 - (1 << numBits);
                for (let i = 0; i < payloadVals.length; i++) {
                    const idx = getRgbIndex(i + 8);
                    data[idx] = (data[idx] & mask) | payloadVals[i];
                }

                // Save
                const canvas = document.getElementById('canvas');
                // IMPORTANTE: Redimensionar o canvas para cada imagem individual
                canvas.width = imgData.imageData.width;
                canvas.height = imgData.imageData.height;
                
                const ctx = canvas.getContext('2d');
                ctx.putImageData(imgData.imageData, 0, 0);
                
                await new Promise(resolve => {
                    canvas.toBlob((blob) => {
                        let originalFullName = currentHideFile.name;
                        let lastDotIndex = originalFullName.lastIndexOf('.');
                        let baseName = lastDotIndex !== -1 ? originalFullName.substring(0, lastDotIndex) : originalFullName;
                        
                        let filename = totalPartsNeeded === 1 ? `${baseName}_convertido.png` : `${baseName}_part${partIndex+1}.png`;
                        downloadBlob(blob, filename);
                        setTimeout(resolve, 300);
                    }, 'image/png');
                });

                currentOffset += chunk_size;
            }

            showToast("Imagem(ns) convertida(s) com sucesso!");
            
            // Reset State
            hideBtn.disabled = false;
            hideBtn.textContent = "Converter & Baixar";
            currentHideImages = [];
            currentHideFile = null;
            hideImageMsg.textContent = "Arraste, clique ou cole (Ctrl+V) para selecionar";
            hideImageMsg.classList.remove('selected');
            hideFileMsg.textContent = "Arraste e solte ou clique para selecionar";
            hideFileMsg.classList.remove('selected');
            document.getElementById('hide-image-input').value = "";
            document.getElementById('hide-file-input').value = "";
            updateCapacity();

        } catch (error) {
            console.error(error);
            showToast("Erro ao converter a imagem: " + error.message, "error");
            hideBtn.disabled = false;
            hideBtn.textContent = "Converter & Baixar";
        }
    });

    // Extract Logic
    extractBtn.addEventListener('click', async () => {
        try {
            extractBtn.disabled = true;
            extractBtn.textContent = "Processando...";

            const chunks = [];

            for (const imgFile of currentExtractImages) {
                const imageData = await loadImageData(imgFile);
                const data = imageData.data;
                const totalChannels = imageData.width * imageData.height * 3;

                // Extract Config
                const configVals = [];
                for (let i = 0; i < 8; i++) {
                    configVals.push(data[getRgbIndex(i)] & 1);
                }
                const numBits = vals_to_bytes(configVals, 1)[0];

                if (![1, 2, 4].includes(numBits)) {
                    console.log(`Ignorando ${imgFile.name}: Profundidade de bits de configuração inválida.`);
                    continue;
                }

                const valsPerByte = 8 / numBits;
                const mask = (1 << numBits) - 1;
                
                // Read enough bytes to check V2 header (12 bytes)
                const headerLen = 12;
                const headerValsLen = headerLen * valsPerByte;
                if (8 + headerValsLen > totalChannels) continue;

                const headerVals = [];
                for (let i = 0; i < headerValsLen; i++) {
                    headerVals.push(data[getRgbIndex(i + 8)] & mask);
                }
                
                const headerBytes = vals_to_bytes(headerVals, numBits);
                
                // --- Protocolo V2 (0xCA 0x8A) ---
                if (headerBytes[0] === 0xCA && headerBytes[1] === 0x8A) {
                    const chunkSize = bytesToInt(headerBytes.slice(2, 6));
                    const nameSize = bytesToInt(headerBytes.slice(6, 8));
                    const totalParts = bytesToInt(headerBytes.slice(8, 10));
                    const partIndex = bytesToInt(headerBytes.slice(10, 12));

                    const totalPayloadBytes = 12 + nameSize + chunkSize;
                    const totalPayloadValsLen = totalPayloadBytes * valsPerByte;

                    if (8 + totalPayloadValsLen > totalChannels) {
                        console.error(`Ignorando ${imgFile.name}: Payload excede tamanho da imagem.`);
                        continue;
                    }

                    const payloadValsArray = new Uint8Array(totalPayloadValsLen);
                    for (let i = 0; i < totalPayloadValsLen; i++) {
                        payloadValsArray[i] = data[getRgbIndex(i + 8)] & mask;
                    }

                    const allBytes = vals_to_bytes(payloadValsArray, numBits);
                    const nameBytes = allBytes.slice(12, 12 + nameSize);
                    const originalName = new TextDecoder('utf-8').decode(nameBytes);
                    const chunkData = allBytes.slice(12 + nameSize, 12 + nameSize + chunkSize);

                    chunks.push({
                        part_index: partIndex,
                        total_parts: totalParts,
                        originalName: originalName,
                        chunkData: chunkData,
                        version: 'V2'
                    });
                    console.log(`Detectado V2: Part ${partIndex+1}/${totalParts} de ${originalName}`);
                } 
                // --- Fallback Protocolo V1 ---
                else {
                    const fileSize = bytesToInt(headerBytes.slice(0, 4));
                    const nameSize = bytesToInt(headerBytes.slice(4, 6));

                    // Validação mínima para V1 (evitar lixo)
                    if (fileSize > 0 && fileSize < totalChannels && nameSize > 0 && nameSize < 255) {
                        const totalPayloadBytes = 6 + nameSize + fileSize;
                        const totalPayloadValsLen = totalPayloadBytes * valsPerByte;

                        if (8 + totalPayloadValsLen <= totalChannels) {
                            const payloadValsArray = new Uint8Array(totalPayloadValsLen);
                            for (let i = 0; i < totalPayloadValsLen; i++) {
                                payloadValsArray[i] = data[getRgbIndex(i + 8)] & mask;
                            }

                            const allBytes = vals_to_bytes(payloadValsArray, numBits);
                            const nameBytes = allBytes.slice(6, 6 + nameSize);
                            const originalName = new TextDecoder('utf-8').decode(nameBytes);
                            const chunkData = allBytes.slice(6 + nameSize, 6 + nameSize + fileSize);

                            chunks.push({
                                part_index: 0,
                                total_parts: 1,
                                originalName: originalName,
                                chunkData: chunkData,
                                version: 'V1'
                            });
                            console.log(`Detectado V1 (Legacy): ${originalName}`);
                        }
                    } else {
                        console.warn(`A imagem ${imgFile.name} não parece conter metadados válidos.`);
                    }
                }
            }

            if (chunks.length === 0) {
                showToast("Nenhum metadado/arquivo original válido encontrado nas imagens selecionadas.", "error");
                resetExtractBtn();
                return;
            }

            // Sort by part_index
            chunks.sort((a, b) => a.part_index - b.part_index);

            // Validation
            const expectedParts = chunks[0].total_parts;
            if (chunks.length !== expectedParts) {
                showToast(`Partes faltando! Encontradas ${chunks.length} partes, mas era esperado ${expectedParts}.`, "error");
                resetExtractBtn();
                return;
            }

            for (let i = 0; i < expectedParts; i++) {
                if (chunks[i].part_index !== i) {
                    showToast(`Parte ${i + 1} faltando. A sequência esperada está quebrada.`, "error");
                    resetExtractBtn();
                    return;
                }
            }

            // Reassemble
            const finalData = concatUint8Arrays(chunks.map(c => c.chunkData));
            const originalName = chunks[0].originalName;

            const blob = new Blob([finalData]);
            downloadBlob(blob, originalName);
            
            showToast("Metadados/arquivo original restaurado com sucesso!");
            
            // Reset
            currentExtractImages = [];
            extractImageMsg.textContent = "Arraste e solte ou clique para selecionar";
            extractImageMsg.classList.remove('selected');
            document.getElementById('extract-image-input').value = "";
            resetExtractBtn();

        } catch (error) {
            console.error(error);
            showToast("Erro ao restaurar arquivo: " + error.message, "error");
            resetExtractBtn();
        }
    });

    function resetExtractBtn() {
        extractBtn.disabled = currentExtractImages.length === 0;
        extractBtn.textContent = "Restaurar Arquivo Original";
    }
});
