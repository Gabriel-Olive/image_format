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
            text = "Drag & Drop or Click to Select";
            msgElement.classList.remove('selected');
        } else if (files.length === 1) {
            text = files[0].name;
            msgElement.classList.add('selected');
        } else {
            text = `${files.length} files selected`;
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
            capacityInfo.textContent = "Conversion Buffer: -- KB";
            capacityInfo.className = "capacity-info";
            return;
        }

        try {
            capacityInfo.textContent = "Calculating capacity...";
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
            capacityInfo.textContent = `Total Conversion Buffer: ${capacityKB} KB (Processing Level ${numBits} across ${currentHideImages.length} image(s))`;
            capacityInfo.className = "capacity-info has-capacity";
            
            validateHideState();
        } catch (e) {
            capacityInfo.textContent = "Error reading image capacity";
            capacityInfo.className = "capacity-info error";
        }
    }

    function validateHideState() {
        hideBtn.disabled = !(currentHideImages.length > 0 && currentHideFile);
    }

    // Setup Hide File Inputs
    setupFileDropArea('hide-image-area', 'hide-image-input', 'hide-image-msg', (files) => {
        currentHideImages = files;
        updateCapacity();
    }, true);

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
            hideBtn.textContent = "Processing...";

            const fileBytes = new Uint8Array(await currentHideFile.arrayBuffer());
            const numBits = parseInt(bitConfig.value);
            
            // 1. Calculate how many parts we need
            const processedImages = [];
            let remainingBytesToFit = fileBytes.length;
            const nameBytes = new TextEncoder().encode(currentHideFile.name);
            const nameLenBytes = intToBytes(nameBytes.length, 2);
            
            // Header V2 is 12 bytes + name length
            const headerBytesLength = 12 + nameBytes.length;

            for (const imgFile of currentHideImages) {
                const imageData = await loadImageData(imgFile);
                const totalChannels = (imageData.width * imageData.height * 3) - 8;
                const maxBytesAvailable = Math.floor((totalChannels * numBits) / 8);
                const maxPayloadChunk = maxBytesAvailable - headerBytesLength;

                if (maxPayloadChunk > 0) {
                    processedImages.push({ imgFile, imageData, maxPayloadChunk });
                }
            }

            let totalPartsNeeded = 0;
            let checkRemaining = fileBytes.length;
            for (const img of processedImages) {
                if (checkRemaining <= 0) break;
                totalPartsNeeded++;
                checkRemaining -= img.maxPayloadChunk;
            }

            if (checkRemaining > 0) {
                showToast("Metadata payload is too large for the selected images combined.", "error");
                hideBtn.disabled = false;
                hideBtn.textContent = "Convert & Download";
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
                const ctx = canvas.getContext('2d');
                ctx.putImageData(imgData.imageData, 0, 0);
                
                await new Promise(resolve => {
                    canvas.toBlob((blob) => {
                        let baseName = currentHideFile.name.split('.')[0];
                        let filename = totalPartsNeeded === 1 ? `${baseName}_hidden.png` : `${baseName}_part${partIndex+1}.png`;
                        downloadBlob(blob, filename);
                        setTimeout(resolve, 300); // Slight delay to let browser handle multiple downloads
                    }, 'image/png');
                });

                currentOffset += chunk_size;
            }

            showToast("Image(s) converted successfully!");
            
            // Reset State
            hideBtn.disabled = false;
            hideBtn.textContent = "Convert & Download";
            currentHideImages = [];
            currentHideFile = null;
            hideImageMsg.textContent = "Drag & Drop or Click to Select";
            hideImageMsg.classList.remove('selected');
            hideFileMsg.textContent = "Drag & Drop or Click to Select";
            hideFileMsg.classList.remove('selected');
            document.getElementById('hide-image-input').value = "";
            document.getElementById('hide-file-input').value = "";
            updateCapacity();

        } catch (error) {
            console.error(error);
            showToast("Error converting image: " + error.message, "error");
            hideBtn.disabled = false;
            hideBtn.textContent = "Convert & Download";
        }
    });

    // Extract Logic
    extractBtn.addEventListener('click', async () => {
        try {
            extractBtn.disabled = true;
            extractBtn.textContent = "Processing...";

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
                    console.log(`Skipping ${imgFile.name}: Invalid config bit depth.`);
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
                
                // Check if V2
                if (headerBytes[0] === 0xCA && headerBytes[1] === 0x8A) {
                    // V2 Protocol
                    const chunkSize = bytesToInt(headerBytes.slice(2, 6));
                    const nameSize = bytesToInt(headerBytes.slice(6, 8));
                    const totalParts = bytesToInt(headerBytes.slice(8, 10));
                    const partIndex = bytesToInt(headerBytes.slice(10, 12));

                    const totalPayloadBytes = 12 + nameSize + chunkSize;
                    const totalPayloadValsLen = totalPayloadBytes * valsPerByte;

                    if (8 + totalPayloadValsLen > totalChannels) {
                        console.error(`Skipping ${imgFile.name}: Incomplete payload.`);
                        continue;
                    }

                    const payloadValsArray = new Uint8Array(totalPayloadValsLen);
                    for (let i = 0; i < totalPayloadValsLen; i++) {
                        payloadValsArray[i] = data[getRgbIndex(i + 8)] & mask;
                    }

                    const allBytes = vals_to_bytes(payloadValsArray, numBits);
                    const nameBytes = allBytes.slice(12, 12 + nameSize);
                    const originalName = new TextDecoder('utf-8').decode(nameBytes);
                    const chunkData = allBytes.slice(12 + nameSize);

                    chunks.push({
                        part_index: partIndex,
                        total_parts: totalParts,
                        originalName: originalName,
                        chunkData: chunkData
                    });
                } else {
                    // V1 Protocol Fallback (from previous version)
                    const fileSize = bytesToInt(headerBytes.slice(0, 4));
                    const nameSize = bytesToInt(headerBytes.slice(4, 6));

                    if (fileSize <= 0 || nameSize <= 0) continue;

                    const totalPayloadBytes = 6 + nameSize + fileSize;
                    const totalPayloadValsLen = totalPayloadBytes * valsPerByte;

                    if (8 + totalPayloadValsLen > totalChannels) continue;

                    const payloadValsArray = new Uint8Array(totalPayloadValsLen);
                    for (let i = 0; i < totalPayloadValsLen; i++) {
                        payloadValsArray[i] = data[getRgbIndex(i + 8)] & mask;
                    }

                    const allBytes = vals_to_bytes(payloadValsArray, numBits);
                    const nameBytes = allBytes.slice(6, 6 + nameSize);
                    const originalName = new TextDecoder('utf-8').decode(nameBytes);
                    const fileData = allBytes.slice(6 + nameSize);

                    chunks.push({
                        part_index: 0,
                        total_parts: 1,
                        originalName: originalName,
                        chunkData: fileData
                    });
                }
            }

            if (chunks.length === 0) {
                showToast("No valid metadata/original files found in the selected images.", "error");
                resetExtractBtn();
                return;
            }

            // Sort by part_index
            chunks.sort((a, b) => a.part_index - b.part_index);

            // Validation
            const expectedParts = chunks[0].total_parts;
            if (chunks.length !== expectedParts) {
                showToast(`Missing parts! Found ${chunks.length} parts, but expected ${expectedParts}.`, "error");
                resetExtractBtn();
                return;
            }

            for (let i = 0; i < expectedParts; i++) {
                if (chunks[i].part_index !== i) {
                    showToast(`Missing part ${i + 1}. Expected sequence is broken.`, "error");
                    resetExtractBtn();
                    return;
                }
            }

            // Reassemble
            const finalData = concatUint8Arrays(chunks.map(c => c.chunkData));
            const originalName = chunks[0].originalName;

            const blob = new Blob([finalData]);
            downloadBlob(blob, originalName);
            
            showToast("Metadata/original file restored successfully!");
            
            // Reset
            currentExtractImages = [];
            extractImageMsg.textContent = "Drag & Drop or Click to Select";
            extractImageMsg.classList.remove('selected');
            document.getElementById('extract-image-input').value = "";
            resetExtractBtn();

        } catch (error) {
            console.error(error);
            showToast("Error restoring file: " + error.message, "error");
            resetExtractBtn();
        }
    });

    function resetExtractBtn() {
        extractBtn.disabled = currentExtractImages.length === 0;
        extractBtn.textContent = "Restore Original File";
    }
});
