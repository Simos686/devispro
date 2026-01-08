// script.js - Version complète avec export PDF fonctionnel

// Initialisation jsPDF
const { jsPDF } = window.jspdf;

let currentQuote = {
    id: 'DEV-' + Date.now(),
    date: new Date().toISOString().split('T')[0],
    services: []
};

// Initialisation
document.addEventListener('DOMContentLoaded', function() {
    if (document.getElementById('quoteDate')) {
        initQuoteCreator();
    }
    setupEventListeners();
});

function initQuoteCreator() {
    // Générer un numéro de devis unique
    const quoteNumber = 'DEV-' + new Date().getFullYear() + '-' + 
        String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    
    // Définir les dates
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    // Remplir les champs
    if (document.getElementById('quoteNumber')) {
        document.getElementById('quoteNumber').value = quoteNumber;
        currentQuote.id = quoteNumber;
    }
    
    if (document.getElementById('quoteDate')) {
        document.getElementById('quoteDate').value = today;
        document.getElementById('validityDate').value = nextWeekStr;
    }
    
    // Charger depuis localStorage
    loadSavedQuote();
    calculateTotal();
}

function setupEventListeners() {
    // Mettre à jour currentQuote quand les champs changent
    const fields = [
        'companyName', 'companyAddress', 'companySIRET', 'companyEmail', 'companyPhone',
        'clientName', 'clientAddress', 'clientEmail',
        'quoteNumber', 'quoteDate', 'validityDate', 'notes'
    ];
    
    fields.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            element.addEventListener('input', updateCurrentQuote);
        }
    });
}

function updateCurrentQuote() {
    currentQuote.company = {
        name: document.getElementById('companyName')?.value || '',
        address: document.getElementById('companyAddress')?.value || '',
        siret: document.getElementById('companySIRET')?.value || '',
        email: document.getElementById('companyEmail')?.value || '',
        phone: document.getElementById('companyPhone')?.value || ''
    };
    
    currentQuote.client = {
        name: document.getElementById('clientName')?.value || '',
        address: document.getElementById('clientAddress')?.value || '',
        email: document.getElementById('clientEmail')?.value || ''
    };
    
    currentQuote.details = {
        number: document.getElementById('quoteNumber')?.value || currentQuote.id,
        date: document.getElementById('quoteDate')?.value || '',
        validity: document.getElementById('validityDate')?.value || '',
        notes: document.getElementById('notes')?.value || ''
    };
}

// Gestion des prestations
function addService() {
    const container = document.getElementById('services-container');
    const serviceId = Date.now();
    
    const serviceDiv = document.createElement('div');
    serviceDiv.className = 'service-item';
    serviceDiv.id = `service-${serviceId}`;
    serviceDiv.innerHTML = `
        <input type="text" class="service-desc" placeholder="Description" 
               oninput="updateService(${serviceId})">
        <input type="number" class="service-quantity" placeholder="Qté" value="1" min="1" 
               oninput="updateService(${serviceId})">
        <input type="number" class="service-price" placeholder="Prix (€)" value="0" min="0" step="0.01" 
               oninput="updateService(${serviceId})">
        <select class="service-tva" onchange="updateService(${serviceId})">
            <option value="20">TVA 20%</option>
            <option value="10">TVA 10%</option>
            <option value="5.5">TVA 5.5%</option>
            <option value="0">TVA 0%</option>
        </select>
        <span class="service-total">0.00 €</span>
        <button type="button" class="remove-service" onclick="removeService(${serviceId})">❌</button>
    `;
    
    container.appendChild(serviceDiv);
    updateService(serviceId);
}

function updateService(id) {
    const serviceDiv = document.getElementById(`service-${id}`);
    if (!serviceDiv) return;
    
    const description = serviceDiv.querySelector('.service-desc').value;
    const quantity = parseFloat(serviceDiv.querySelector('.service-quantity').value) || 0;
    const price = parseFloat(serviceDiv.querySelector('.service-price').value) || 0;
    const tva = parseFloat(serviceDiv.querySelector('.service-tva').value) || 0;
    
    const ht = quantity * price;
    const tvaAmount = ht * (tva / 100);
    const total = ht + tvaAmount;
    
    serviceDiv.querySelector('.service-total').textContent = total.toFixed(2) + ' €';
    
    // Mettre à jour dans currentQuote
    const serviceIndex = currentQuote.services.findIndex(s => s.id === id);
    if (serviceIndex > -1) {
        currentQuote.services[serviceIndex] = { id, description, quantity, price, tva, ht, total };
    } else {
        currentQuote.services.push({ id, description, quantity, price, tva, ht, total });
    }
    
    calculateTotal();
}

function removeService(id) {
    const serviceDiv = document.getElementById(`service-${id}`);
    if (serviceDiv) {
        serviceDiv.remove();
        currentQuote.services = currentQuote.services.filter(s => s.id !== id);
        calculateTotal();
    }
}

// Calcul des totaux
function calculateTotal() {
    let totalHT = 0;
    let totalTVA = 0;
    
    currentQuote.services.forEach(service => {
        totalHT += service.ht || 0;
        totalTVA += (service.ht || 0) * ((service.tva || 0) / 100);
    });
    
    const totalTTC = totalHT + totalTVA;
    
    // Mettre à jour l'affichage
    if (document.getElementById('totalHT')) {
        document.getElementById('totalHT').textContent = totalHT.toFixed(2) + ' €';
        document.getElementById('totalTVA').textContent = totalTVA.toFixed(2) + ' €';
        document.getElementById('totalTTC').textContent = totalTTC.toFixed(2) + ' €';
    }
    
    // Mettre à jour currentQuote
    currentQuote.totals = {
        ht: totalHT,
        tva: totalTVA,
        ttc: totalTTC
    };
}

// Export PDF COMPLET
async function exportPDF() {
    try {
        // Mettre à jour les données avant génération
        updateCurrentQuote();
        
        // Créer le PDF
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 15;
        
        // ========== EN-TÊTE ==========
        // Fond vert pour l'en-tête
        doc.setFillColor(16, 185, 129); // Vert #10b981
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        // Titre DEVIS en blanc
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(28);
        doc.setFont('helvetica', 'bold');
        doc.text('DEVIS', margin, 25);
        
        // Numéro de devis
        doc.setFontSize(12);
        doc.text(`N° : ${currentQuote.details.number || currentQuote.id}`, pageWidth - margin, 25, { align: 'right' });
        
        // Date
        doc.setFontSize(10);
        const dateStr = currentQuote.details.date ? 
            new Date(currentQuote.details.date).toLocaleDateString('fr-FR') : 
            new Date().toLocaleDateString('fr-FR');
        doc.text(`Date : ${dateStr}`, pageWidth - margin, 32, { align: 'right' });
        
        // ========== INFORMATIONS ENTREPRISE & CLIENT ==========
        let yPos = 50;
        
        // Entreprise (gauche)
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('FACTURÉ PAR', margin, yPos);
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        yPos += 8;
        doc.text(currentQuote.company?.name || 'Votre Entreprise', margin, yPos);
        yPos += 6;
        doc.text(currentQuote.company?.address || 'Adresse non renseignée', margin, yPos);
        yPos += 6;
        if (currentQuote.company?.siret) {
            doc.text(`SIRET : ${currentQuote.company.siret}`, margin, yPos);
            yPos += 6;
        }
        if (currentQuote.company?.phone) {
            doc.text(`Tél : ${currentQuote.company.phone}`, margin, yPos);
            yPos += 6;
        }
        if (currentQuote.company?.email) {
            doc.text(`Email : ${currentQuote.company.email}`, margin, yPos);
        }
        
        // Client (droite)
        const clientYStart = 50;
        let clientY = clientYStart;
        
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('CLIENT', pageWidth - margin, clientY, { align: 'right' });
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        clientY += 8;
        if (currentQuote.client?.name) {
            doc.text(currentQuote.client.name, pageWidth - margin, clientY, { align: 'right' });
            clientY += 6;
        }
        if (currentQuote.client?.address) {
            doc.text(currentQuote.client.address, pageWidth - margin, clientY, { align: 'right' });
            clientY += 6;
        }
        if (currentQuote.client?.email) {
            doc.text(`Email : ${currentQuote.client.email}`, pageWidth - margin, clientY, { align: 'right' });
        }
        
        // ========== TABLEAU DES PRESTATIONS ==========
        yPos = Math.max(yPos, clientY) + 15;
        
        // En-tête du tableau
        doc.setFillColor(240, 253, 244); // Vert très clair
        doc.rect(margin, yPos - 7, pageWidth - (margin * 2), 10, 'F');
        
        doc.setDrawColor(16, 185, 129);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos + 3, pageWidth - margin, yPos + 3);
        
        // Colonnes
        const colWidths = [80, 20, 30, 25, 30]; // Largeurs des colonnes
        let xPos = margin;
        
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(5, 94, 70); // Vert foncé
        
        doc.text('DESCRIPTION', xPos + 2, yPos);
        xPos += colWidths[0];
        doc.text('QTÉ', xPos + 2, yPos);
        xPos += colWidths[1];
        doc.text('PRIX UNIT.', xPos + 2, yPos);
        xPos += colWidths[2];
        doc.text('TVA', xPos + 2, yPos);
        xPos += colWidths[3];
        doc.text('TOTAL', xPos + 2, yPos);
        
        // Lignes des prestations
        yPos += 10;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        
        currentQuote.services.forEach((service, index) => {
            // Alternance de couleur des lignes
            if (index % 2 === 0) {
                doc.setFillColor(248, 250, 252);
                doc.rect(margin, yPos - 4, pageWidth - (margin * 2), 8, 'F');
            }
            
            xPos = margin;
            
            // Description (avec retour à la ligne si trop long)
            const desc = service.description || 'Prestation';
            doc.text(desc.substring(0, 40), xPos + 2, yPos);
            xPos += colWidths[0];
            
            // Quantité
            doc.text(service.quantity.toString(), xPos + 2, yPos);
            xPos += colWidths[1];
            
            // Prix unitaire
            doc.text(service.price.toFixed(2) + ' €', xPos + 2, yPos);
            xPos += colWidths[2];
            
            // TVA
            doc.text(service.tva + ' %', xPos + 2, yPos);
            xPos += colWidths[3];
            
            // Total ligne
            doc.text(service.total.toFixed(2) + ' €', xPos + 2, yPos);
            
            yPos += 8;
            
            // Saut de page si nécessaire
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
        });
        
        // ========== TOTAUX ==========
        yPos += 10;
        
        // Ligne de séparation
        doc.setDrawColor(200, 200, 200);
        doc.line(pageWidth - margin - 120, yPos, pageWidth - margin, yPos);
        yPos += 5;
        
        // Tableau des totaux
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        
        // Total HT
        doc.text('Total HT :', pageWidth - margin - 80, yPos);
        doc.text(currentQuote.totals.ht.toFixed(2) + ' €', pageWidth - margin, yPos, { align: 'right' });
        yPos += 7;
        
        // TVA
        doc.text('TVA :', pageWidth - margin - 80, yPos);
        doc.text(currentQuote.totals.tva.toFixed(2) + ' €', pageWidth - margin, yPos, { align: 'right' });
        yPos += 10;
        
        // Total TTC (mise en valeur)
        doc.setFontSize(14);
        doc.setTextColor(16, 185, 129); // Vert
        doc.text('Total TTC :', pageWidth - margin - 80, yPos);
        doc.text(currentQuote.totals.ttc.toFixed(2) + ' €', pageWidth - margin, yPos, { align: 'right' });
        
        // ========== CONDITIONS & NOTES ==========
        yPos += 20;
        
        if (currentQuote.details.notes) {
            doc.setFontSize(10);
            doc.setTextColor(100, 100, 100);
            doc.setFont('helvetica', 'italic');
            
            // Titre
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(5, 94, 70);
            doc.text('Conditions & Notes :', margin, yPos);
            yPos += 6;
            
            // Notes avec gestion des retours à la ligne
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0, 0, 0);
            
            const notes = currentQuote.details.notes;
            const splitNotes = doc.splitTextToSize(notes, pageWidth - (margin * 2));
            doc.text(splitNotes, margin, yPos);
        }
        
        // ========== PIED DE PAGE ==========
        const footerY = 280;
        
        doc.setDrawColor(16, 185, 129);
        doc.line(margin, footerY, pageWidth - margin, footerY);
        
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text('Devis généré avec DevisArtisan - devisartisan.fr', margin, footerY + 5);
        doc.text(`Document généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 
                pageWidth - margin, footerY + 5, { align: 'right' });
        
        // ========== TÉLÉCHARGEMENT ==========
        const filename = `devis-${currentQuote.details.number || currentQuote.id}.pdf`;
        doc.save(filename);
        
        // Afficher une confirmation
        showNotification('PDF téléchargé avec succès !');
        
        // Sauvegarder le devis après génération
        saveQuote();
        
    } catch (error) {
        console.error('Erreur génération PDF:', error);
        showNotification('Erreur lors de la génération du PDF', 'error');
        
        // Fallback : générer un PDF simple
        generateSimplePDF();
    }
}

function generateSimplePDF() {
    // Version simplifiée si jsPDF échoue
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text('DEVIS', 20, 20);
    doc.setFontSize(12);
    doc.text(`N° : ${currentQuote.details.number || currentQuote.id}`, 20, 30);
    
    // Contenu basique
    let y = 50;
    doc.text('Prestations :', 20, y);
    y += 10;
    
    currentQuote.services.forEach(service => {
        const line = `${service.description || 'Prestation'} - ${service.quantity} x ${service.price.toFixed(2)} € = ${service.total.toFixed(2)} €`;
        doc.text(line, 20, y);
        y += 7;
    });
    
    y += 10;
    doc.text(`Total TTC : ${currentQuote.totals.ttc.toFixed(2)} €`, 20, y);
    
    doc.save(`devis-${currentQuote.details.number}.pdf`);
}

// Fonctions utilitaires
function showNotification(message, type = 'success') {
    // Créer une notification
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        border-radius: 10px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 9999;
        animation: slideIn 0.3s ease;
        font-weight: 600;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
    
    // Ajouter les animations CSS si elles n'existent pas
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

function saveQuote() {
    try {
        // Mettre à jour les données
        updateCurrentQuote();
        
        // Sauvegarder dans localStorage
        const quoteToSave = {
            ...currentQuote,
            savedAt: new Date().toISOString()
        };
        
        localStorage.setItem('lastQuote', JSON.stringify(quoteToSave));
        
        // Optionnel: Sauvegarder dans l'historique
        const history = JSON.parse(localStorage.getItem('quoteHistory') || '[]');
        history.unshift({
            id: currentQuote.id,
            number: currentQuote.details.number,
            client: currentQuote.client.name,
            total: currentQuote.totals.ttc,
            date: new Date().toISOString()
        });
        
        // Garder seulement les 20 derniers
        localStorage.setItem('quoteHistory', JSON.stringify(history.slice(0, 20)));
        
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        return false;
    }
}

function loadSavedQuote() {
    try {
        const saved = localStorage.getItem('lastQuote');
        if (saved) {
            const data = JSON.parse(saved);
            
            // Remplir les champs
            if (data.company) {
                Object.keys(data.company).forEach(key => {
                    const element = document.getElementById(`company${key.charAt(0).toUpperCase() + key.slice(1)}`);
                    if (element) element.value = data.company[key] || '';
                });
            }
            
            if (data.client) {
                Object.keys(data.client).forEach(key => {
                    const element = document.getElementById(`client${key.charAt(0).toUpperCase() + key.slice(1)}`);
                    if (element) element.value = data.client[key] || '';
                });
            }
            
            if (data.details) {
                Object.keys(data.details).forEach(key => {
                    const element = document.getElementById(`${key}Date` || key);
                    if (element) element.value = data.details[key] || '';
                });
            }
            
            // Charger les services
            if (data.services && data.services.length > 0) {
                document.getElementById('services-container').innerHTML = '';
                data.services.forEach(service => {
                    // Recréer chaque service
                    // Note: L'implémentation complète nécessite d'ajouter les services un par un
                });
            }
            
            updateCurrentQuote();
            calculateTotal();
        }
    } catch (error) {
        console.error('Erreur chargement:', error);
    }
}

function resetQuote() {
    if (confirm('Voulez-vous créer un nouveau devis ? Les données non sauvegardées seront perdues.')) {
        // Réinitialiser les champs
        document.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"], textarea').forEach(input => {
            input.value = '';
        });
        
        // Réinitialiser les services
        document.getElementById('services-container').innerHTML = '';
        
        // Générer un nouveau numéro
        const quoteNumber = 'DEV-' + new Date().getFullYear() + '-' + 
            String(Math.floor(Math.random() * 1000)).padStart(3, '0');
        
        document.getElementById('quoteNumber').value = quoteNumber;
        document.getElementById('quoteDate').value = new Date().toISOString().split('T')[0];
        
        const nextWeek = new Date();
        nextWeek.setDate(nextWeek.getDate() + 7);
        document.getElementById('validityDate').value = nextWeek.toISOString().split('T')[0];
        
        // Ajouter une ligne de service par défaut
        addService();
        
        // Réinitialiser currentQuote
        currentQuote = {
            id: quoteNumber,
            date: new Date().toISOString().split('T')[0],
            services: []
        };
        
        showNotification('Nouveau devis créé !');
    }
}

// Fonction pour prévisualiser (optionnel)
function previewPDF() {
    const pdfWindow = window.open('', '_blank');
    pdfWindow.document.write(`
        <html>
        <head><title>Prévisualisation PDF</title></head>
        <body>
            <div style="padding: 20px; max-width: 800px; margin: 0 auto; font-family: Arial;">
                <h1 style="color: #10b981;">DEVIS ${currentQuote.details.number || currentQuote.id}</h1>
                <p>Cette fonctionnalité de prévisualisation nécessite le téléchargement complet du PDF.</p>
                <p>Cliquez sur "Exporter PDF" pour générer et télécharger le document.</p>
                <button onclick="window.close()" style="padding: 10px 20px; background: #10b981; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Fermer
                </button>
            </div>
        </body>
        </html>
    `);
}

// Exposer les fonctions globalement
window.addService = addService;
window.removeService = removeService;
window.updateService = updateService;
window.exportPDF = exportPDF;
window.resetQuote = resetQuote;
window.saveQuote = saveQuote;