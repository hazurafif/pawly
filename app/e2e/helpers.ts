import { expect, type Page } from '@playwright/test';

// The dockerized app defaults to Indonesian; tests standardize on English.
export async function setEnglish(page: Page): Promise<void> {
  await page.goto('/settings');
  await page.getByText('English', { exact: true }).click();
  await expect(page.getByText('Server address', { exact: true })).toBeVisible();
}

// Creates a pet through the UI from a fresh (empty) context.
export async function createPet(page: Page, name = 'Miko'): Promise<void> {
  await page.goto('/pet-form');
  await page.getByLabel('Name').fill(name);
  await page.getByRole('button', { name: 'Cat', exact: true }).click();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
}

// Clicks the "Add" action of a health-tab section by its title. The section
// header renders the title beside a <button aria-label="Add">, so find the
// title's following-sibling button.
export async function addInSection(page: Page, sectionTitle: string): Promise<void> {
  await page
    .locator(`xpath=//*[text()='${sectionTitle}']/parent::div/following-sibling::button[1]`)
    .click();
}
