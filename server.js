// Gérer un abonnement (INTÉGRATION STRIPE RÉELLE)
async function handleSubscription(priceIdKey, planName) {
    const token = localStorage.getItem('devispro_token');
    const user = JSON.parse(localStorage.getItem('devispro_user') || '{}');
    
    if (!token) {
        showNotification('Veuillez vous connecter pour souscrire à un abonnement', 'error');
        setTimeout(() => {
            window.location.href = 'login.html?redirect=pricing';
        }, 1500);
        return;
    }
    
    const priceId = STRIPE_PRICES[priceIdKey];
    
    if (!priceId || priceId.includes('XYZ')) {
        showNotification('Configuration Stripe incomplète. Contactez l\'administrateur.', 'error');
        console.error('❌ Price ID manquant ou invalide:', priceIdKey);
        return;
    }
    
    const button = event.target;
    const originalText = button.innerHTML;
    button.innerHTML = '<span class="loader"></span> Préparation...';
    button.disabled = true;
    
    try {
        console.log('📤 Création session Stripe pour:', { priceId, planName });
        
        // Appeler VOTRE API pour créer la session Stripe
        const response = await fetch(`${API_BASE_URL}/api/create-checkout-session`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                priceId: priceId,
                plan: planName.split(' - ')[0], // "Pro Mensuel"
                customerEmail: user.email || '',
                userId: user.id || 'anonymous',
                success_url: `${window.location.origin}/success.html?session_id={CHECKOUT_SESSION_ID}&type=subscription&plan=${encodeURIComponent(planName)}`,
                cancel_url: `${window.location.origin}/pricing.html?cancelled=true`
            })
        });
        
        const data = await response.json();
        console.log('📦 Réponse du serveur:', data);
        
        if (!response.ok) {
            throw new Error(data.error || `Erreur serveur (${response.status})`);
        }
        
        if (data.success && data.url) {
            // ⭐ REDIRECTION VERS LA PAGE DE PAIEMENT STRIPE ⭐
            console.log(`🔗 Redirection vers Stripe (mode: ${data.mode}):`, data.url);
            window.location.href = data.url;
        } else {
            throw new Error(data.error || 'Erreur lors de la création du paiement');
        }
        
    } catch (error) {
        console.error('❌ Erreur abonnement:', error);
        showNotification(`Erreur: ${error.message}`, 'error');
        button.innerHTML = originalText;
        button.disabled = false;
    }
}
