import { test, expect } from '@playwright/test';

test('parcours d’achat complet', async ({ page }) => {
  // 1. Aller sur le catalogue
  await page.goto('/catalogue');
  await expect(page).toHaveURL(/catalogue/);

  // 2. Cliquer sur le premier produit
  await page.locator('a[href*="/produit/"]').first().click();

  // 3. Ajouter au panier
  await page.locator('button[data-add-to-cart]').click();

  // 4. Attendre le toast de confirmation
  await expect(page.getByText('Produit ajouté au panier.')).toBeVisible();

  // 5. Aller sur la page panier
  await page.goto('/panier');
  await expect(page).toHaveURL(/panier/);

  // 6. Vérifier que le panier n'est PAS vide
  await expect(page.getByRole('heading', { name: /Votre panier est vide/i })).not.toBeVisible();

  // 7. Cliquer sur "Passer la commande"
  const checkoutBtn = page.getByRole('link', { name: /passer la commande|commander|valider/i })
    .or(page.getByRole('button', { name: /passer la commande|commander|valider/i }));
  await checkoutBtn.first().click();

  // 8. Remplir le formulaire
  await page.locator('input[name="fullName"]').fill('Test Utilisateur');
  await page.locator('input[name="phone"]').fill('699000000');
  await page.locator('input[name="line1"]').fill('1 rue de Test');
  await page.locator('input[name="city"]').fill('Douala');
  await page.locator('input[name="region"]').fill('Littoral');

  // 9. Soumettre la commande
  await page.getByRole('button', { name: /confirmer la commande/i }).click();

  // 10. Vérifier le message de succès
  await expect(page.locator('body')).toContainText(/succès|merci|commande (bien )?reçue|validée/i, { timeout: 10000 });
});