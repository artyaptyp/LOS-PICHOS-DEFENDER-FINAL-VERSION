const API_URL =
    window.location.origin && window.location.origin !== "null"
        ? window.location.origin
        : "http://127.0.0.1:8000";

const chatHistory = [];


document.addEventListener("DOMContentLoaded", () => {
    const input = document.getElementById("urlInput");
    const button = document.getElementById("scanButton");
    const fileInput = document.getElementById("fileInput");
    const fileButton = document.getElementById("fileScanButton");

    if (!input || !button || !fileInput || !fileButton) {
        console.warn("Elementos do scanner não encontrados na página atual.");
        return;
    }

    button.addEventListener("click", scanWebsite);
    fileButton.addEventListener("click", scanFile);
    fileInput.addEventListener("change", updateSelectedFile);

    document.querySelectorAll("[data-scan-mode]").forEach((tab) => {
        tab.addEventListener("click", () => setScanMode(tab.dataset.scanMode));
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => setView(button.dataset.view));
    });

    document.getElementById("sidebarToggle").addEventListener("click", toggleSidebar);

    document.getElementById("chatForm").addEventListener("submit", sendChatMessage);

    input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            scanWebsite();
        }
    });
});


function toggleSidebar() {
    const sidebar = document.getElementById("sidebar");
    const shell = document.getElementById("appShell");
    const button = document.getElementById("sidebarToggle");
    const isOpening = sidebar.classList.contains("hidden");

    sidebar.classList.toggle("hidden", !isOpening);
    shell.classList.toggle("sidebar-open", isOpening);
    button.setAttribute("aria-expanded", String(isOpening));
    button.setAttribute(
        "aria-label",
        isOpening ? "Fechar menu de navegação" : "Abrir menu de navegação"
    );
    button.querySelector("span").textContent = isOpening ? "×" : "☰";
}


function setView(viewId) {
    document.querySelectorAll("[data-view-panel]").forEach((panel) => {
        panel.classList.toggle("hidden", panel.id !== viewId);
    });
    document.querySelectorAll("[data-view]").forEach((button) => {
        const isActive = button.dataset.view === viewId;
        button.classList.toggle("active", isActive);
        if (isActive) {
            button.setAttribute("aria-current", "page");
        } else {
            button.removeAttribute("aria-current");
        }
    });
}


function setScanMode(mode) {
    const isFileMode = mode === "file";
    document.getElementById("linkPanel").classList.toggle("hidden", isFileMode);
    document.getElementById("filePanel").classList.toggle("hidden", !isFileMode);
    document.getElementById("linkTab").classList.toggle("active", !isFileMode);
    document.getElementById("fileTab").classList.toggle("active", isFileMode);
    document.getElementById("linkTab").setAttribute("aria-selected", String(!isFileMode));
    document.getElementById("fileTab").setAttribute("aria-selected", String(isFileMode));
    document.getElementById("error").textContent = "";
    document.getElementById("results").classList.add("hidden");
}


async function sendChatMessage(event) {
    event.preventDefault();
    const input = document.getElementById("chatInput");
    const button = document.getElementById("chatSendButton");
    const error = document.getElementById("chatError");
    const message = input.value.trim();
    error.textContent = "";

    if (!message) {
        error.textContent = "Escreva sua dúvida antes de enviar.";
        return;
    }

    appendChatMessage(message, "user");
    input.value = "";
    button.disabled = true;
    button.textContent = "Enviando...";

    try {
        const response = await fetch(`${API_URL}/assistant/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message, history: chatHistory })
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.detail || "Não foi possível consultar a IA.");
        }

        appendChatMessage(data.answer, "assistant");
        chatHistory.push(
            { role: "user", content: message },
            { role: "assistant", content: data.answer }
        );
        if (chatHistory.length > 12) {
            chatHistory.splice(0, chatHistory.length - 12);
        }
    } catch (err) {
        error.textContent = err.message || "Não foi possível conectar à IA.";
    } finally {
        button.disabled = false;
        button.textContent = "Enviar pergunta";
        input.focus();
    }
}


function appendChatMessage(text, role) {
    const message = document.createElement("div");
    message.className = `chat-message ${role}-message`;
    message.textContent = text;
    document.getElementById("chatMessages").appendChild(message);
    message.scrollIntoView({ behavior: "smooth", block: "nearest" });
}


function updateSelectedFile() {
    const input = document.getElementById("fileInput");
    const button = document.getElementById("fileScanButton");
    const name = document.getElementById("fileName");
    const file = input.files[0];

    name.textContent = file
        ? `${file.name} (${formatFileSize(file.size)})`
        : "Escolha um arquivo para analisar";
    button.disabled = !file;
}


function formatFileSize(size) {
    return size < 1024 * 1024
        ? `${(size / 1024).toFixed(1)} KB`
        : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}


async function scanWebsite() {
    const input = document.getElementById("urlInput");
    const error = document.getElementById("error");
    const button = document.getElementById("scanButton");

    const url = input.value.trim();

    error.textContent = "";

    if (!url) {
        error.textContent = "Digite uma URL para analisar.";
        return;
    }

    await runScan(button, "Verificando o link no VirusTotal...", "Aguarde a conclusão dos mecanismos de análise.", () =>
        fetch(`${API_URL}/scan/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: url })
        })
    );
}


async function scanFile() {
    const input = document.getElementById("fileInput");
    const button = document.getElementById("fileScanButton");
    const error = document.getElementById("error");
    const file = input.files[0];

    error.textContent = "";
    if (!file) {
        error.textContent = "Escolha um arquivo para analisar.";
        return;
    }
    if (!file.size) {
        error.textContent = "O arquivo está vazio.";
        return;
    }
    if (file.size > 32 * 1024 * 1024) {
        error.textContent = "O arquivo precisa ter no máximo 32 MB.";
        return;
    }

    await runScan(button, "Enviando e analisando o arquivo...", "O resultado aparecerá quando o VirusTotal concluir a análise.", () => {
        const formData = new FormData();
        formData.append("file", file);
        return fetch(`${API_URL}/file-scan/start`, {
            method: "POST",
            body: formData
        });
    });
}


async function runScan(button, loadingTitle, loadingMessage, startRequest) {
    const error = document.getElementById("error");
    const loading = document.getElementById("loading");
    const results = document.getElementById("results");
    const tabs = document.querySelectorAll("[data-scan-mode]");

    loading.classList.remove("hidden");
    document.getElementById("loadingTitle").textContent = loadingTitle;
    document.getElementById("loadingMessage").textContent = loadingMessage;
    results.classList.add("hidden");
    button.disabled = true;
    tabs.forEach((tab) => { tab.disabled = true; });

    try {
        const startResponse = await startRequest();
        const startData = await startResponse.json();

        if (!startData.success) {
            throw new Error(startData.error || "Erro durante a análise.");
        }

        let data;
        while (!data) {
            await new Promise((resolve) => setTimeout(resolve, 1000));

            const statusResponse = await fetch(
                `${API_URL}/scan/status/${encodeURIComponent(startData.scan_id)}`,
                { cache: "no-store" }
            );
            const statusData = await statusResponse.json();

            if (!statusData.success) {
                throw new Error(statusData.error || "Não foi possível consultar o andamento da análise.");
            }

            if (statusData.status === "completed") {
                data = statusData.result;
            }
        }

        if (!data.success) {
            throw new Error(data.error || "Erro durante a análise.");
        }

        showResults(data);
    } catch (err) {
        error.textContent = err.message || "Não foi possível conectar ao scanner.";
    } finally {
        loading.classList.add("hidden");
        button.disabled = false;
        tabs.forEach((tab) => { tab.disabled = false; });
    }
}


function showResults(data) {

    const results =
        document.getElementById("results");

    const status =
        document.getElementById("overallStatus");

    const scannedUrl =
        document.getElementById("scannedUrl");


    scannedUrl.textContent =
        data.url;


    status.className =
        `overall ${data.summary.overall}`;


    status.textContent =
        data.summary.overall.toUpperCase();


    document.getElementById(
        "cleanCount"
    ).textContent =
        data.summary.clean;


    document.getElementById(
        "warningCount"
    ).textContent =
        data.summary.warnings;


    document.getElementById(
        "dangerCount"
    ).textContent =
        data.summary.danger;


    document.getElementById(
        "totalCount"
    ).textContent =
        data.summary.total;

    renderNetworkInfo(data.network);

    const list = document.getElementById("engineList");
    list.innerHTML = "";

    const orderedResults = [...data.results];
    const vtIndex = orderedResults.findIndex((result) => result.name === "VirusTotal");

    if (vtIndex !== -1) {
        const [vtResult] = orderedResults.splice(vtIndex, 1);
        orderedResults.push(vtResult);
    }


    function renderNetworkInfo(network) {
        const section = document.getElementById("networkInfo");
        const ipList = document.getElementById("networkIpList");
        const mapContainer = document.getElementById("networkMapContainer");
        const map = document.getElementById("networkMap");
        const mapCaption = document.getElementById("networkMapCaption");
        const notice = document.getElementById("networkNotice");
        ipList.replaceChildren();
        map.removeAttribute("src");
        mapContainer.classList.add("hidden");

        if (!network) {
            section.classList.add("hidden");
            return;
        }

        section.classList.remove("hidden");
        notice.textContent = `${network.notice || ""} O IP consultado ao serviço ipwho.is e os pedidos de mapa ao OpenStreetMap são enviados a esses serviços externos.`;

        if (!Array.isArray(network.ips) || network.ips.length === 0) {
            const empty = document.createElement("p");
            empty.className = "network-notice";
            empty.textContent = network.error || "Nenhum endereço IP foi encontrado.";
            ipList.appendChild(empty);
            return;
        }

        let mapLocation = null;
        network.ips.forEach((item) => {
            const card = document.createElement("article");
            card.className = "network-ip-card";
            const ip = document.createElement("code");
            ip.textContent = item.ip;
            card.appendChild(ip);

            const details = document.createElement("p");
            if (!item.is_public) {
                details.textContent = "Endereço não público; localização não consultada.";
            } else if (item.location && !item.location.error) {
                const location = item.location;
                const place = [location.city, location.region, location.country].filter(Boolean).join(", ");
                const provider = location.organization || location.isp;
                const lines = [
                    place ? `Localização aproximada: ${place}` : "",
                    provider ? `Rede/provedor: ${provider}` : "",
                    location.asn ? `ASN: ${location.asn}` : "",
                    typeof location.hosting === "boolean"
                        ? `Infraestrutura de hospedagem: ${location.hosting ? "possivelmente sim" : "não identificada"}`
                        : ""
                ].filter(Boolean);
                details.textContent = lines.join(" · ") || "O serviço não retornou detalhes de hospedagem.";

                if (!mapLocation && Number.isFinite(location.latitude) && Number.isFinite(location.longitude)) {
                    mapLocation = { ...location, place: place || item.ip };
                }
            } else {
                details.textContent = item.location?.error || "Localização aproximada indisponível.";
            }
            card.appendChild(details);
            ipList.appendChild(card);
        });

        if (mapLocation) {
            const latitude = Number(mapLocation.latitude);
            const longitude = Number(mapLocation.longitude);
            const padding = 0.12;
            const bounds = [
                Math.max(-180, longitude - padding),
                Math.max(-90, latitude - padding),
                Math.min(180, longitude + padding),
                Math.min(90, latitude + padding)
            ].join(",");
            const params = new URLSearchParams({
                bbox: bounds,
                layer: "mapnik",
                marker: `${latitude},${longitude}`
            });
            map.src = `https://www.openstreetmap.org/export/embed.html?${params}`;
            mapCaption.textContent = `Área aproximada: ${mapLocation.place}. A localização do IP não identifica necessariamente o local físico do servidor.`;
            mapContainer.classList.remove("hidden");
        }
    }

    orderedResults.forEach((result) => {
        const item = document.createElement("div");
        item.className = "engine";

        const left = document.createElement("div");
        left.className = "engine-left";

        const name = document.createElement("div");
        name.className = "engine-name";
        name.textContent = result.name;

        const message = document.createElement("div");
        message.className = "engine-message";
        message.textContent = result.message;

        left.appendChild(name);
        left.appendChild(message);

        if (result.name === "VirusTotal" && Array.isArray(result.antivirus)) {
            const badge = document.createElement("div");
            badge.className = `engine-status status-${result.status}`;
            badge.textContent = result.status === "clean" ? "CLEAN" : result.status === "warning" ? "WARNING" : "DETECTED";

            const toggle = document.createElement("button");
            toggle.type = "button";
            toggle.className = "vt-toggle";
            toggle.setAttribute("aria-expanded", "false");
            toggle.title = "Expandir lista do VirusTotal";

            const arrow = document.createElement("span");
            arrow.className = "vt-arrow";
            arrow.textContent = "▸";
            toggle.appendChild(arrow);

            const panel = document.createElement("div");
            panel.className = "vt-panel hidden";

            const groups = {
                dangerous: [],
                undetected: [],
                safe: []
            };

            result.antivirus.forEach((antivirus) => {
                const value = String(antivirus.result || "unknown").toLowerCase();
                const category = String(antivirus.category || "undetected").toLowerCase();

                if (["malicious", "suspicious", "danger", "phishing"].includes(category) || ["malicious", "suspicious"].includes(value)) {
                    groups.dangerous.push(antivirus);
                } else if (["undetected", "unrated", "unknown", "notavailable"].includes(category) || ["unrated", "unknown"].includes(value)) {
                    groups.undetected.push(antivirus);
                } else {
                    groups.safe.push(antivirus);
                }
            });

            const categoryOrder = [
                { key: "dangerous", label: "Perigosos" },
                { key: "undetected", label: "Não avaliados" },
                { key: "safe", label: "Seguros" }
            ];

            const sectionList = document.createElement("ul");
            sectionList.className = "antivirus-list";

            categoryOrder.forEach(({ key, label }) => {
                const items = groups[key];
                if (!items.length) return;

                const sectionTitle = document.createElement("li");
                sectionTitle.className = "antivirus-section";
                sectionTitle.textContent = label;
                sectionList.appendChild(sectionTitle);

                items.forEach((antivirus) => {
                    const antivirusItem = document.createElement("li");
                    antivirusItem.className = "antivirus-item";

                    const dot = document.createElement("span");
                    const state = ["malicious", "suspicious", "danger", "phishing"].includes(String(antivirus.category || "").toLowerCase()) || ["malicious", "suspicious"].includes(String(antivirus.result || "").toLowerCase())
                        ? "danger"
                        : ["undetected", "unrated", "unknown", "notavailable"].includes(String(antivirus.category || "").toLowerCase()) || ["unrated", "unknown"].includes(String(antivirus.result || "").toLowerCase())
                            ? "warning"
                            : "clean";

                    dot.className = `antivirus-dot status-${state}`;

                    const labelEl = document.createElement("span");
                    labelEl.textContent = `${antivirus.engine}: ${antivirus.result || "unknown"}`;

                    antivirusItem.appendChild(dot);
                    antivirusItem.appendChild(labelEl);
                    sectionList.appendChild(antivirusItem);
                });
            });

            panel.appendChild(sectionList);

            toggle.addEventListener("click", () => {
                const isHidden = panel.classList.toggle("hidden");
                toggle.setAttribute("aria-expanded", String(!isHidden));
                arrow.style.transform = isHidden ? "rotate(0deg)" : "rotate(90deg)";
            });

            item.appendChild(left);
            item.appendChild(badge);
            item.appendChild(toggle);
            list.appendChild(item);
            list.appendChild(panel);
            return;
        }

        const badge = document.createElement("div");
        badge.className = `engine-status status-${result.status}`;

        if (result.status === "clean") {
            badge.textContent = "CLEAN";
        } else if (result.status === "warning") {
            badge.textContent = "WARNING";
        } else {
            badge.textContent = "DETECTED";
        }

        item.appendChild(left);
        item.appendChild(badge);
        list.appendChild(item);
    });

    results.classList.remove("hidden");

    results.scrollIntoView({
        behavior: "smooth"
    });
}
